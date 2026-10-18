// 모집·참여·완주 도메인 서비스 (Phase 1, Phase 2 A). Route Handler는 얇게 두고 로직은 여기 모은다.
// 모든 함수는 db(또는 tx)를 주입받아 Vitest에서 트랜잭션 롤백으로 격리 테스트한다
// (auth.ts의 DbLike 주입 패턴 답습). 동시성 참여 구현 원본은 trd.md §4.1, 완주 판정은 §4.2.
import { and, eq, desc, asc, inArray, ne, sql, isNotNull, isNull, or, gt, gte, lt } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { posts, participants, users } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { computeStudyEndDate, computeVerdictWindow, endOfKstDay, kstDayRange } from '@/lib/end-date';
import { deriveChatPlatform } from '@/lib/validation';
import { resolveTemplate } from '@/lib/templates';
import { campusToLocationType, toPublicUser, type PublicUser } from '@/lib/public-user';
import type { CliData, CliItem } from '@/lib/cli-format';
import type { FeedPost, PostDetail } from '@/lib/view-types';

type DefaultDb = typeof defaultDb;
type Tx = Parameters<Parameters<DefaultDb['transaction']>[0]>[0];
/** 최상위 db와 트랜잭션 tx 모두를 받는다 (tx.transaction()은 savepoint로 중첩된다). */
export type Database = DefaultDb | Tx;

export type NewPostInput = {
  type: 'STUDY' | 'PARTY';
  templateId?: string | null;
  templateData?: Record<string, unknown> | null;
  title: string;
  tags: string[];
  locationType: 'ONLINE' | 'OFFLINE_GS' | 'OFFLINE_SEOUL' | 'HYBRID';
  place?: string | null;
  maxMembers: number;
  chatUrl?: string | null; // 오프라인 전용 모집은 없을 수 있다 (CLAUDE.md §7.1)
  referenceUrl?: string | null;
  description?: string | null;
  endDate?: Date | null;
};

export type UpdatePatch = {
  title?: string;
  description?: string | null;
  chatUrl?: string;
  place?: string | null;
};

export type ListFilter = {
  type?: 'STUDY' | 'PARTY' | 'LIVE';
  status?: 'RECRUITING' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  sort?: 'latest' | 'deadline';
};


// ── US1: 개설 ────────────────────────────────────────────────────────────────

export async function createPost(
  input: NewPostInput,
  leaderId: string,
  database: Database = defaultDb,
): Promise<{ id: string; status: string; currentMembers: number }> {
  // STUDY는 end_date를 개설일 기준 자동 산출(입력 무시), PARTY는 입력값을 쓴다.
  // PARTY는 KST 당일 끝으로 정규화한다 — 달력이 보낸 UTC 자정은 KST 09:00이라 그대로 두면
  // 마감일 당일 오전에 이미 마감된 것으로 판정된다 (FR-020, research R3).
  const endDate =
    input.type === 'STUDY'
      ? computeStudyEndDate(new Date())
      : input.endDate
        ? endOfKstDay(input.endDate)
        : null;
  // 템플릿 ID·특화 데이터 검증 (FR-007). 위반 시 BAD_REQUEST로 글을 만들지 않는다.
  const template = resolveTemplate(input.type, input.templateId, input.templateData);

  return database.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        leaderId,
        type: input.type,
        templateId: template.templateId,
        templateData: template.templateData,
        proofType: template.proofType,
        title: input.title,
        tags: input.tags,
        locationType: input.locationType,
        place: input.place ?? null,
        maxMembers: input.maxMembers,
        currentMembers: 1, // 리더 포함 1명 시작
        endDate,
        chatUrl: input.chatUrl ?? null,
        referenceUrl: input.referenceUrl ?? null,
        description: input.description ?? null,
        status: 'RECRUITING',
      })
      .returning({ id: posts.id, status: posts.status, currentMembers: posts.currentMembers });

    // 개설 시 리더 자동 참여 (FR-001).
    await tx.insert(participants).values({ postId: post.id, userId: leaderId, status: 'JOINED' });

    return post;
  });
}

// ── Phase 2 B US1: LIVE 핑 개설 ───────────────────────────────────────────────

export type NewLivePingInput = {
  text: string;
  place: string;
  durationMinutes: 30 | 60 | 120 | 180;
};

/**
 * LIVE 핑 생성 (FR-011). 기존 posts 컬럼에 매핑한다 (research R3, data-model.md).
 * 1일 1회 제한은 작성자 users 행을 FOR UPDATE로 잠가 직렬화한다 (research R1) —
 * 동시 요청이 모두 "오늘 0건"을 읽고 둘 다 insert하는 경합을 막는다.
 * now는 KST 날짜 경계 테스트용 시각 주입.
 */
export async function createLivePing(
  input: NewLivePingInput,
  userId: string,
  database: Database = defaultDb,
  now: Date = new Date(),
): Promise<{ id: string; status: string; expiresAt: Date }> {
  return database.transaction(async (tx) => {
    const [author] = await tx
      .select({ id: users.id, campus: users.campus })
      .from(users)
      .where(eq(users.id, userId))
      .for('update');
    if (!author) throw new AppError('NOT_FOUND', '유저가 존재하지 않습니다.');

    // KST 자정 기준 1일 1회 (CLAUDE.md §7.2). 상태와 무관하게 당일 생성 건수로 센다.
    const { start, end } = kstDayRange(now);
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(posts)
      .where(
        and(
          eq(posts.leaderId, userId),
          eq(posts.type, 'LIVE'),
          gte(posts.createdAt, start),
          lt(posts.createdAt, end),
        ),
      );
    if (count >= 1) {
      throw new AppError('BAD_REQUEST', 'LIVE 핑은 하루에 한 번만 올릴 수 있습니다.');
    }

    const expiresAt = new Date(now.getTime() + input.durationMinutes * 60_000);
    const [post] = await tx
      .insert(posts)
      .values({
        leaderId: userId,
        type: 'LIVE',
        title: input.text,
        tags: [],
        // LIVE는 클러스터 찾아가기 용도라 항상 오프라인. 캠퍼스는 표기용이다 (research R4).
        // 캠퍼스 미인증 작성자는 OFFLINE_ETC로 기록하고 등록을 막지 않는다 (FR-016).
        locationType: campusToLocationType(author.campus),
        place: input.place,
        maxMembers: null,
        chatUrl: null,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        status: 'RECRUITING',
      })
      .returning({ id: posts.id, status: posts.status, expiresAt: posts.expiresAt });

    // participants 행은 만들지 않는다 — LIVE에 참여 개념이 없다 (research R5).
    return { id: post.id, status: post.status, expiresAt: post.expiresAt! };
  });
}

/**
 * LIVE 핑 작성자의 조기 완료 (FR-011). contracts/posts-complete-ping.md 순서 그대로.
 * 행 락으로 동시 완료 요청과 상태 판정 사이 경합을 막는다. 이미 CLOSED면 멱등 성공한다.
 */
export async function completeLivePing(
  postId: string,
  userId: string,
  database: Database = defaultDb,
): Promise<{ id: string; status: string }> {
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    if (post.type !== 'LIVE') throw new AppError('BAD_REQUEST', 'LIVE 핑만 완료할 수 있습니다.');
    if (post.leaderId !== userId) throw new AppError('FORBIDDEN', '작성자만 완료할 수 있습니다.');
    if (post.status === 'CLOSED') return { id: post.id, status: post.status };

    const [updated] = await tx
      .update(posts)
      .set({ status: 'CLOSED', updatedAt: new Date() })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id, status: posts.status });
    return updated;
  });
}

/** LIVE 핑에는 참여·수정·취소·마감 토글이 없다 (research R6). 유형 위반은 권한보다 먼저 막는다. */
function assertNotLivePing(type: 'STUDY' | 'PARTY' | 'LIVE') {
  if (type === 'LIVE') {
    throw new AppError('BAD_REQUEST', 'LIVE 핑에는 사용할 수 없는 동작입니다.');
  }
}

// ── US2: 참여 / 상세 / 리스트 ─────────────────────────────────────────────────

export async function joinPost(
  postId: string,
  userId: string,
  database: Database = defaultDb,
): Promise<{ chatUrl: string | null; reJoined: boolean }> {
  // trd.md §4.1: 행 락 → 상태 검증 → 멱등 → 정원 검증 → 기록 → 카운트 증가.
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');

    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    assertNotLivePing(post.type);
    if (post.status !== 'RECRUITING') throw new AppError('CLOSED', '모집이 마감된 스터디입니다.');

    const [existing] = await tx
      .select()
      .from(participants)
      .where(and(eq(participants.postId, postId), eq(participants.userId, userId)));

    if (existing && existing.status === 'JOINED') {
      return { chatUrl: post.chatUrl, reJoined: true }; // 멱등: 카운트 미증가
    }

    // 마감일이 지난 단기 파티는 신규 참여를 막는다 (FR-020). 상태값이 RECRUITING으로 남으므로
    // 위 상태 검증으로는 통과한다. 멱등 반환 뒤에 두는 이유: 기존 참여자는 마감 후에도
    // 채팅 링크를 재열람할 수 있어야 한다 (FR-021, data-model.md §3).
    if (post.type === 'PARTY' && post.endDate && post.endDate.getTime() <= Date.now()) {
      throw new AppError('CLOSED', '마감일이 지난 파티입니다.');
    }

    if (post.maxMembers && post.currentMembers >= post.maxMembers) {
      throw new AppError('FULL', '정원이 초과되었습니다.');
    }

    if (existing) {
      await tx
        .update(participants)
        .set({ status: 'JOINED', joinedAt: new Date() })
        .where(eq(participants.id, existing.id));
    } else {
      await tx.insert(participants).values({ postId, userId, status: 'JOINED' });
    }

    const nextCount = post.currentMembers + 1;
    const isClosed = post.maxMembers ? nextCount >= post.maxMembers : false;
    await tx
      .update(posts)
      .set({ currentMembers: nextCount, status: isClosed ? 'CLOSED' : 'RECRUITING' })
      .where(eq(posts.id, postId));

    return { chatUrl: post.chatUrl, reJoined: false };
  });
}

export async function getPostDetail(
  postId: string,
  viewerId: string,
  database: Database = defaultDb,
): Promise<PostDetail> {
  const [post] = await database.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');

  const rows = await database
    .select({
      login: users.login,
      campus: users.campus,
      userId: participants.userId,
      status: participants.status,
    })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.postId, postId))
    // ORDER BY가 없으면 반환 순서가 보장되지 않는다 (FR-014). 리더를 별도 정렬 키로 올리지
    // 않는다 — createPost가 리더를 첫 참여 행으로 기록하므로 자연히 맨 앞에 온다.
    .orderBy(asc(participants.joinedAt), asc(users.login));

  const [leaderRow] = await database
    .select({ login: users.login, campus: users.campus })
    .from(users)
    .where(eq(users.id, post.leaderId));

  const isParticipant = rows.some((r) => r.userId === viewerId);

  const base: PostDetail = {
    id: post.id,
    type: post.type,
    templateId: post.templateId,
    templateData: post.templateData, // 전체 공개
    title: post.title,
    tags: post.tags,
    locationType: post.locationType,
    place: post.place,
    maxMembers: post.maxMembers,
    currentMembers: post.currentMembers,
    status: post.status,
    chatPlatform: post.chatUrl ? deriveChatPlatform(post.chatUrl) : null, // 전체 공개
    referenceUrl: post.referenceUrl, // 전체 공개
    description: post.description,
    endDate: post.endDate,
    expiresAt: post.expiresAt, // LIVE 핑 만료 시각. 그 외 유형은 null.
    cancelReason: post.cancelReason,
    proofUrl: post.proofUrl,
    postmortemText: post.postmortemText,
    // leader_id는 NOT NULL이고 FK가 restrict이므로 리더 행은 항상 존재한다.
    leader: toPublicUser(leaderRow),
    participants: rows.map(toPublicUser),
  };

  // chat_url은 참여자에게만 공개. 비참여자는 키 자체를 제외한다 (헌법 V, 헌법·CLAUDE.md §6.2).
  if (isParticipant) base.chatUrl = post.chatUrl;

  // 완주 판정 체크박스용 팀원 목록은 리더 본인에게만 내려준다 (specs/007b-completion-lifecycle/data-model.md §2).
  // 일반 participants 배열은 PublicUser를 그대로 유지해 TC-IDENT-04를 보존한다.
  if (viewerId === post.leaderId) {
    base.verdictMembers = rows
      .filter((r) => r.userId !== post.leaderId && r.status === 'JOINED')
      .map((r) => ({ userId: r.userId, ...toPublicUser(r) }));
  }

  return base;
}

export async function listPosts(
  filter: ListFilter,
  database: Database = defaultDb,
  now: Date = new Date(),
): Promise<FeedPost[]> {
  const conds = [];
  if (filter.type) conds.push(eq(posts.type, filter.type));
  if (filter.status) conds.push(eq(posts.status, filter.status));

  // LIVE 핑 Lazy Filter (FR-011). 만료는 상태 전이가 아니므로 조회에서 제외만 한다.
  // cron을 두지 않는다 (CLAUDE.md §6.4). 비 LIVE 글은 이 조건을 통과한다.
  conds.push(
    or(
      ne(posts.type, 'LIVE'),
      and(eq(posts.status, 'RECRUITING'), gt(posts.expiresAt, now)),
    )!,
  );

  // 단기 파티 Lazy Filter (FR-020). 마감일이 지난 파티를 모집 피드에서 뺀다. 상태 전이도
  // cron도 없다. end_date가 null인 파티는 만료 개념이 없으므로 통과시킨다.
  conds.push(or(ne(posts.type, 'PARTY'), isNull(posts.endDate), gt(posts.endDate, now))!);

  const order = filter.sort === 'deadline' ? asc(posts.endDate) : desc(posts.createdAt);

  const rows = await database
    .select({
      id: posts.id,
      type: posts.type,
      title: posts.title,
      tags: posts.tags,
      locationType: posts.locationType,
      place: posts.place,
      maxMembers: posts.maxMembers,
      currentMembers: posts.currentMembers,
      status: posts.status,
      chatUrl: posts.chatUrl,
      referenceUrl: posts.referenceUrl,
      endDate: posts.endDate,
      expiresAt: posts.expiresAt,
      leaderLogin: users.login,
      leaderCampus: users.campus,
    })
    .from(posts)
    .innerJoin(users, eq(posts.leaderId, users.id))
    .where(and(...conds))
    .orderBy(order);

  // 리스트는 참여 여부와 무관하게 chat_url을 절대 포함하지 않는다. 링크는 상세+참여자만.
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    tags: r.tags,
    locationType: r.locationType,
    place: r.place,
    maxMembers: r.maxMembers,
    currentMembers: r.currentMembers,
    status: r.status,
    chatPlatform: r.chatUrl ? deriveChatPlatform(r.chatUrl) : null,
    referenceUrl: r.referenceUrl,
    endDate: r.endDate,
    expiresAt: r.expiresAt,
    leader: { login: r.leaderLogin, campus: r.leaderCampus },
  }));
}

/**
 * CLI 조회 데이터 (FR-012). listPosts를 유형별로 호출해 Lazy Filter와
 * chat_url 미노출 규칙을 그대로 재사용한다 (research R10).
 * 노출 필드는 data-model.md "CLI 목록 항목" 표로 제한한다 — 공개 엔드포인트라 최소 노출.
 */
export async function listForCli(
  database: Database = defaultDb,
  now: Date = new Date(),
): Promise<CliData> {
  const toItem = (r: Record<string, unknown>): CliItem => ({
    id: r.id as string,
    title: r.title as string,
    place: (r.place as string | null) ?? null,
    tags: (r.tags as string[]) ?? [],
    currentMembers: (r.currentMembers as number | null) ?? null,
    maxMembers: (r.maxMembers as number | null) ?? null,
    endDate: (r.endDate as Date | null) ?? null,
    expiresAt: (r.expiresAt as Date | null) ?? null,
    leader: r.leader as CliItem['leader'],
  });

  const [pings, parties, studies] = await Promise.all([
    listPosts({ type: 'LIVE' }, database, now),
    listPosts({ type: 'PARTY', status: 'RECRUITING', sort: 'deadline' }, database, now),
    listPosts({ type: 'STUDY', status: 'RECRUITING', sort: 'latest' }, database, now),
  ]);

  return {
    // 만료 임박순. "지금 당장" 정보가 위로 온다.
    pings: pings
      .map(toItem)
      .sort((a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0)),
    parties: parties.map(toItem),
    studies: studies.map(toItem),
  };
}

// ── US4: 수정 ────────────────────────────────────────────────────────────────

export async function updatePost(
  postId: string,
  leaderId: string,
  patch: UpdatePatch,
  database: Database = defaultDb,
): Promise<{ id: string; updatedAt: Date }> {
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    assertNotLivePing(post.type);
    if (post.leaderId !== leaderId) throw new AppError('FORBIDDEN', '리더만 수정할 수 있습니다.');
    if (post.status !== 'RECRUITING') {
      throw new AppError('BAD_REQUEST', '모집 중인 글만 수정할 수 있습니다.');
    }

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.chatUrl !== undefined) set.chatUrl = patch.chatUrl;
    if (patch.place !== undefined) set.place = patch.place;

    const [updated] = await tx
      .update(posts)
      .set(set)
      .where(eq(posts.id, postId))
      .returning({ id: posts.id, updatedAt: posts.updatedAt });
    return updated;
  });
}

// ── US5: 취소 ────────────────────────────────────────────────────────────────

export async function cancelPost(
  postId: string,
  leaderId: string,
  reason: string,
  database: Database = defaultDb,
): Promise<{ id: string; status: string }> {
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    assertNotLivePing(post.type);
    if (post.leaderId !== leaderId) throw new AppError('FORBIDDEN', '리더만 취소할 수 있습니다.');
    if (post.status === 'CANCELLED' || post.status === 'COMPLETED') {
      throw new AppError('BAD_REQUEST', '이미 종료되었거나 취소된 스터디입니다.');
    }

    const [updated] = await tx
      .update(posts)
      .set({ status: 'CANCELLED', cancelReason: reason, updatedAt: new Date() })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id, status: posts.status });
    return updated;
  });
}

// ── US3: 수동 마감 / 재모집 토글 ──────────────────────────────────────────────

export async function toggleStatus(
  postId: string,
  leaderId: string,
  nextStatus: 'RECRUITING' | 'CLOSED',
  database: Database = defaultDb,
): Promise<{ id: string; status: string }> {
  if (nextStatus !== 'RECRUITING' && nextStatus !== 'CLOSED') {
    throw new AppError('BAD_REQUEST', '전환할 수 없는 상태입니다.');
  }
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    assertNotLivePing(post.type);
    if (post.leaderId !== leaderId) throw new AppError('FORBIDDEN', '리더만 전환할 수 있습니다.');
    if (post.status !== 'RECRUITING' && post.status !== 'CLOSED') {
      throw new AppError('BAD_REQUEST', '최종 상태에서는 전환할 수 없습니다.');
    }

    const [updated] = await tx
      .update(posts)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id, status: posts.status });
    return updated;
  });
}

// ── Phase 2 A US1: 완주 벌크 판정 ─────────────────────────────────────────────

export type Evaluation = { userId: string; isCompleted: boolean };

/**
 * 리더의 완주 벌크 판정 (FR-008). contracts/posts-complete.md 1~8단계 순서 그대로.
 * 글 행을 FOR UPDATE로 잠가 동시 판정의 이중 가산과 판정 중 신규 참여 경합을 막는다 (research R1).
 * now는 판정 창 경계 테스트용 시각 주입 (research R3).
 */
export async function completePost(
  postId: string,
  leaderId: string,
  evaluations: Evaluation[],
  proofUrl: string | undefined,
  database: Database = defaultDb,
  now: Date = new Date(),
): Promise<{ id: string; status: string; completedCount: number; incompleteCount: number }> {
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    if (post.leaderId !== leaderId) throw new AppError('FORBIDDEN', '리더만 판정할 수 있습니다.');
    if (post.type !== 'STUDY') throw new AppError('BAD_REQUEST', '완주 판정은 정규 스터디 전용입니다.');
    if (post.status !== 'RECRUITING' && post.status !== 'CLOSED') {
      throw new AppError('BAD_REQUEST', '이미 종료되었거나 취소된 스터디입니다.');
    }
    if (post.postmortemText !== null) {
      throw new AppError('BAD_REQUEST', '회고가 등록된 스터디는 완주 판정할 수 없습니다.');
    }
    if (!post.endDate) throw new AppError('BAD_REQUEST', '사이클 종료일이 없는 스터디입니다.');
    const { opensAt, closesAt } = computeVerdictWindow(post.endDate);
    if (now < opensAt || now > closesAt) {
      throw new AppError('BAD_REQUEST', '완주 판정 기간이 아닙니다.');
    }

    // 리더 제외 JOINED 참여자 집합과 판정 목록이 정확히 일치해야 한다 (research R4).
    const joined = await tx
      .select({ userId: participants.userId })
      .from(participants)
      .where(
        and(
          eq(participants.postId, postId),
          eq(participants.status, 'JOINED'),
          ne(participants.userId, leaderId),
        ),
      );
    const expected = new Set(joined.map((r) => r.userId));
    const given = new Set(evaluations.map((e) => e.userId));
    const exactMatch =
      given.size === evaluations.length &&
      given.size === expected.size &&
      evaluations.every((e) => expected.has(e.userId));
    if (!exactMatch) {
      throw new AppError('BAD_REQUEST', '판정 목록이 참여자와 일치하지 않습니다.');
    }

    const completedIds = evaluations.filter((e) => e.isCompleted).map((e) => e.userId);
    const incompleteIds = evaluations.filter((e) => !e.isCompleted).map((e) => e.userId);
    if (completedIds.length === 0) {
      throw new AppError('BAD_REQUEST', '완주 멤버가 1명 이상이어야 합니다.');
    }

    // 참여자 상태: 완주 멤버·리더 COMPLETED, 미완주 멤버 INCOMPLETE (research R5).
    await tx
      .update(participants)
      .set({ status: 'COMPLETED' })
      .where(and(eq(participants.postId, postId), inArray(participants.userId, [...completedIds, leaderId])));
    if (incompleteIds.length) {
      await tx
        .update(participants)
        .set({ status: 'INCOMPLETE' })
        .where(and(eq(participants.postId, postId), inArray(participants.userId, incompleteIds)));
    }

    // 카운트 가산: 완주 멤버 completed_count +1, 리더 leader_count +1 (리더는 completed_count 미가산).
    await tx
      .update(users)
      .set({ completedCount: sql`${users.completedCount} + 1` })
      .where(inArray(users.id, completedIds));
    await tx
      .update(users)
      .set({ leaderCount: sql`${users.leaderCount} + 1` })
      .where(eq(users.id, leaderId));

    await tx
      .update(posts)
      .set({ status: 'COMPLETED', proofUrl: proofUrl ?? null, updatedAt: now })
      .where(eq(posts.id, postId));

    return {
      id: postId,
      status: 'COMPLETED',
      completedCount: completedIds.length,
      incompleteCount: incompleteIds.length,
    };
  });
}

// ── Phase 2 A US2: Post-mortem 실패 회고 ───────────────────────────────────────

/**
 * 리더의 실패 회고 등록·덮어쓰기 (FR-009). 상태 전이가 아니며 카운트도 가산하지 않는다.
 * 판정 창이 열린 뒤(opensAt)부터 종료 기한 없이 허용한다. 완주와 배타적이다 (research R9).
 */
export async function postmortemPost(
  postId: string,
  leaderId: string,
  text: string,
  database: Database = defaultDb,
  now: Date = new Date(),
): Promise<{ id: string; status: string; postmortemText: string | null }> {
  return database.transaction(async (tx) => {
    const [post] = await tx.select().from(posts).where(eq(posts.id, postId)).for('update');
    if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
    if (post.leaderId !== leaderId) throw new AppError('FORBIDDEN', '리더만 회고를 작성할 수 있습니다.');
    if (post.type !== 'STUDY') throw new AppError('BAD_REQUEST', 'Post-mortem은 정규 스터디 전용입니다.');
    if (post.status === 'COMPLETED' || post.status === 'CANCELLED') {
      throw new AppError('BAD_REQUEST', '이미 종료되었거나 취소된 스터디입니다.');
    }
    if (!post.endDate || now < computeVerdictWindow(post.endDate).opensAt) {
      throw new AppError('BAD_REQUEST', '아직 회고를 작성할 수 있는 기간이 아닙니다.');
    }

    const [updated] = await tx
      .update(posts)
      .set({ postmortemText: text, updatedAt: now })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id, status: posts.status, postmortemText: posts.postmortemText });
    return updated;
  });
}

// ── Phase 2 A US4: 명예의 전당 / Post-mortem / 랭킹 (조회 전용) ──────────────────

type ArchiveBase = {
  id: string;
  title: string;
  templateId: string | null;
  endDate: Date | null;
  leader: PublicUser;
};
export type HallOfFameItem = ArchiveBase & {
  proofUrl: string | null;
  completedMembers: PublicUser[];
  completedAt: Date;
};
export type PostmortemItem = ArchiveBase & { postmortemText: string; writtenAt: Date };
export type HallKind = 'completed' | 'postmortem';

/**
 * 🏆명예의 전당(completed) / 🪦Post-mortem(postmortem) 목록 (FR-010, research R7). 정규 스터디 전용.
 * 완료 시각 전용 컬럼이 없어 판정·회고 시 갱신하는 updated_at을 쓴다. chat_url은 포함하지 않는다.
 */
export async function listHallOfFame(kind: 'completed', database?: Database): Promise<HallOfFameItem[]>;
export async function listHallOfFame(kind: 'postmortem', database?: Database): Promise<PostmortemItem[]>;
export async function listHallOfFame(
  kind: HallKind,
  database?: Database,
): Promise<HallOfFameItem[] | PostmortemItem[]>;
export async function listHallOfFame(
  kind: HallKind,
  database: Database = defaultDb,
): Promise<HallOfFameItem[] | PostmortemItem[]> {
  const cond =
    kind === 'completed'
      ? and(eq(posts.type, 'STUDY'), eq(posts.status, 'COMPLETED'))
      : and(eq(posts.type, 'STUDY'), isNotNull(posts.postmortemText), ne(posts.status, 'CANCELLED'));

  const rows = await database
    .select({
      id: posts.id,
      title: posts.title,
      templateId: posts.templateId,
      endDate: posts.endDate,
      leaderId: posts.leaderId,
      proofUrl: posts.proofUrl,
      postmortemText: posts.postmortemText,
      updatedAt: posts.updatedAt,
      leaderLogin: users.login,
      leaderCampus: users.campus,
    })
    .from(posts)
    .innerJoin(users, eq(posts.leaderId, users.id))
    .where(cond)
    .orderBy(desc(posts.updatedAt));

  const base = (r: (typeof rows)[number]): ArchiveBase => ({
    id: r.id,
    title: r.title,
    templateId: r.templateId,
    endDate: r.endDate,
    leader: toPublicUser({ login: r.leaderLogin, campus: r.leaderCampus }),
  });

  if (kind === 'postmortem') {
    return rows.map((r) => ({ ...base(r), postmortemText: r.postmortemText!, writtenAt: r.updatedAt }));
  }

  // 완주 멤버: 리더 제외 participants.status = 'COMPLETED'. 글별로 묶는다.
  const membersByPost = new Map<string, PublicUser[]>();
  if (rows.length) {
    const members = await database
      .select({ postId: participants.postId, userId: participants.userId, login: users.login, campus: users.campus })
      .from(participants)
      .innerJoin(users, eq(participants.userId, users.id))
      .where(and(inArray(participants.postId, rows.map((r) => r.id)), eq(participants.status, 'COMPLETED')))
      .orderBy(asc(users.login));
    const leaderOf = new Map(rows.map((r) => [r.id, r.leaderId]));
    for (const m of members) {
      if (m.userId === leaderOf.get(m.postId)) continue;
      const list = membersByPost.get(m.postId) ?? [];
      list.push(toPublicUser(m));
      membersByPost.set(m.postId, list);
    }
  }

  return rows.map((r) => ({
    ...base(r),
    proofUrl: r.proofUrl,
    completedMembers: membersByPost.get(r.id) ?? [],
    completedAt: r.updatedAt,
  }));
}

export type LeaderboardItem = PublicUser & { rank: number; completedCount: number; leaderCount: number };

/**
 * 성실 멤버 랭킹 TOP 5 (FR-010, research R8). 완주 횟수 → 리더 횟수 → login 순.
 * 마지막 정렬 키 login이 유일하므로 공동 순위는 없다. 캠퍼스 필터 없음, avatar_url 없음.
 */
export async function getLeaderboard(database: Database = defaultDb): Promise<LeaderboardItem[]> {
  const rows = await database
    .select({
      login: users.login,
      campus: users.campus,
      completedCount: users.completedCount,
      leaderCount: users.leaderCount,
    })
    .from(users)
    .where(or(gt(users.completedCount, 0), gt(users.leaderCount, 0)))
    .orderBy(desc(users.completedCount), desc(users.leaderCount), asc(users.login))
    .limit(5);

  return rows.map((r, i) => ({ rank: i + 1, ...toPublicUser(r), completedCount: r.completedCount, leaderCount: r.leaderCount }));
}
