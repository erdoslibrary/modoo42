// 모집·참여 도메인 서비스 (Phase 1). Route Handler는 얇게 두고 로직은 여기 모은다.
// 모든 함수는 db(또는 tx)를 주입받아 Vitest에서 트랜잭션 롤백으로 격리 테스트한다
// (auth.ts의 DbLike 주입 패턴 답습). 동시성 참여 구현 원본은 trd.md §4.1.
import { and, eq, desc, asc } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { posts, participants, users } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { computeStudyEndDate } from '@/lib/end-date';
import { deriveChatPlatform } from '@/lib/validation';

type DefaultDb = typeof defaultDb;
type Tx = Parameters<Parameters<DefaultDb['transaction']>[0]>[0];
/** 최상위 db와 트랜잭션 tx 모두를 받는다 (tx.transaction()은 savepoint로 중첩된다). */
export type Database = DefaultDb | Tx;

export type NewPostInput = {
  type: 'STUDY' | 'PARTY';
  templateId?: string | null;
  title: string;
  tags: string[];
  locationType: 'ONLINE' | 'OFFLINE_GS' | 'OFFLINE_SEOUL' | 'HYBRID';
  place?: string | null;
  maxMembers: number;
  chatUrl: string;
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
  type?: 'STUDY' | 'PARTY';
  status?: 'RECRUITING' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
  sort?: 'latest' | 'deadline';
};

/** 참여자/리더 공개용 최소 프로필 (avatar_url 미수집, 이니셜 뱃지용). */
function publicUser(u: { intraId: string; campus: 'GS' | 'SEOUL' }) {
  return { intraId: u.intraId, campus: u.campus };
}

// ── US1: 개설 ────────────────────────────────────────────────────────────────

export async function createPost(
  input: NewPostInput,
  leaderId: string,
  database: Database = defaultDb,
): Promise<{ id: string; status: string; currentMembers: number }> {
  // STUDY는 end_date를 개설일 기준 자동 산출(입력 무시), PARTY는 입력값 사용.
  const endDate =
    input.type === 'STUDY' ? computeStudyEndDate(new Date()) : (input.endDate ?? null);

  return database.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        leaderId,
        type: input.type,
        templateId: input.templateId ?? null,
        title: input.title,
        tags: input.tags,
        locationType: input.locationType,
        place: input.place ?? null,
        maxMembers: input.maxMembers,
        currentMembers: 1, // 리더 포함 1명 시작
        endDate,
        chatUrl: input.chatUrl,
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
    if (post.status !== 'RECRUITING') throw new AppError('CLOSED', '모집이 마감된 스터디입니다.');

    const [existing] = await tx
      .select()
      .from(participants)
      .where(and(eq(participants.postId, postId), eq(participants.userId, userId)));

    if (existing && existing.status === 'JOINED') {
      return { chatUrl: post.chatUrl, reJoined: true }; // 멱등: 카운트 미증가
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
): Promise<Record<string, unknown>> {
  const [post] = await database.select().from(posts).where(eq(posts.id, postId));
  if (!post) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');

  const rows = await database
    .select({ intraId: users.intraId, campus: users.campus, userId: participants.userId })
    .from(participants)
    .innerJoin(users, eq(participants.userId, users.id))
    .where(eq(participants.postId, postId));

  const [leaderRow] = await database
    .select({ intraId: users.intraId, campus: users.campus })
    .from(users)
    .where(eq(users.id, post.leaderId));

  const isParticipant = rows.some((r) => r.userId === viewerId);

  const base: Record<string, unknown> = {
    id: post.id,
    type: post.type,
    templateId: post.templateId,
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
    cancelReason: post.cancelReason,
    leader: leaderRow ? publicUser(leaderRow) : null,
    participants: rows.map(publicUser),
  };

  // chat_url은 참여자에게만 공개. 비참여자는 키 자체를 제외한다 (헌법 V, 헌법·CLAUDE.md §6.2).
  if (isParticipant) base.chatUrl = post.chatUrl;
  return base;
}

export async function listPosts(
  filter: ListFilter,
  database: Database = defaultDb,
): Promise<Record<string, unknown>[]> {
  const conds = [];
  if (filter.type) conds.push(eq(posts.type, filter.type));
  if (filter.status) conds.push(eq(posts.status, filter.status));

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
      leaderIntra: users.intraId,
      leaderCampus: users.campus,
    })
    .from(posts)
    .innerJoin(users, eq(posts.leaderId, users.id))
    .where(conds.length ? and(...conds) : undefined)
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
    leader: { intraId: r.leaderIntra, campus: r.leaderCampus },
  }));
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
