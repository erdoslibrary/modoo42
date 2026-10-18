// 단기 파티 마감 Lazy Filter (FR-020, Test Suite 6). contracts/party-expiry.md
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { createPost, joinPost, listForCli, listPosts, getPostDetail } from '@/lib/posts';
import { posts } from '@/db/schema';

// 공용 Supabase에 다른 글이 섞여 있다. 개수가 아니라 id의 포함/불포함으로 단언한다.
const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id as string);

const DAY = 24 * 60 * 60 * 1000;

const partyInput = (endDate: Date) => ({
  type: 'PARTY' as const,
  title: '파티 마감 테스트',
  tags: ['해커톤'],
  locationType: 'ONLINE' as const,
  maxMembers: 4,
  chatUrl: 'https://discord.gg/party',
  endDate,
});

const studyInput = {
  type: 'STUDY' as const,
  title: '파티 마감 테스트용 스터디',
  tags: ['모각코'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/study',
};

describe('단기 파티 마감 (Test Suite 6)', () => {
  it('TC-PARTY-01: 마감일이 지난 파티는 조회에서 제외되고 상태는 전이되지 않는다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-03-15T03:00:00.000Z');

      const open = await createPost(partyInput(new Date(now.getTime() + 3 * DAY)), leader!.id, tx);
      const past = await createPost(partyInput(new Date(now.getTime() - 1 * DAY)), leader!.id, tx);
      const study = await createPost(studyInput, leader!.id, tx);

      // end_date가 null인 파티는 만료 개념이 없다. 서비스가 null을 허용하므로 직접 넣는다.
      const [noDeadline] = await tx
        .insert(posts)
        .values({
          leaderId: leader!.id,
          type: 'PARTY',
          title: '마감일 없는 파티',
          tags: ['자유'],
          locationType: 'ONLINE',
          maxMembers: 4,
          chatUrl: 'https://discord.gg/nodeadline',
          endDate: null,
        })
        .returning({ id: posts.id });

      // (a) 모집 피드: 마감 지난 파티만 빠진다.
      const all = await listPosts({}, tx, now);
      expect(ids(all)).toContain(open.id);
      expect(ids(all)).not.toContain(past.id);
      expect(ids(all)).toContain(noDeadline.id);
      expect(ids(all)).toContain(study.id);

      const partyOnly = await listPosts({ type: 'PARTY', sort: 'deadline' }, tx, now);
      expect(ids(partyOnly)).toContain(open.id);
      expect(ids(partyOnly)).not.toContain(past.id);

      // (b) 정규 스터디는 end_date가 지나도 이 규칙의 대상이 아니다.
      await tx
        .update(posts)
        .set({ endDate: new Date(now.getTime() - 10 * DAY) })
        .where(eq(posts.id, study.id));
      const afterStudyPast = await listPosts({ type: 'STUDY' }, tx, now);
      expect(ids(afterStudyPast)).toContain(study.id);

      // (c) CLI 출력도 같은 조회 경로를 쓰므로 함께 좁아진다.
      const cli = await listForCli(tx, now);
      expect(cli.parties.map((p) => p.id)).toContain(open.id);
      expect(cli.parties.map((p) => p.id)).not.toContain(past.id);

      // (d) 상태 전이가 아니다. DB에는 그대로 RECRUITING으로 남는다.
      const [row] = await tx.select({ status: posts.status }).from(posts).where(eq(posts.id, past.id));
      expect(row.status).toBe('RECRUITING');

      // (e) 상세 조회는 계속 허용된다.
      const detail = await getPostDetail(past.id, leader!.id, tx);
      expect(detail.id).toBe(past.id);
    });
  });

  it('TC-PARTY-01: 파티 end_date는 KST 당일 끝으로 정규화되어 저장된다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);

      // 달력이 보내는 값: UTC 자정 = KST 09:00.
      const created = await createPost(
        partyInput(new Date('2030-10-14T00:00:00.000Z')),
        leader!.id,
        tx,
      );
      const [party] = await tx
        .select({ endDate: posts.endDate })
        .from(posts)
        .where(eq(posts.id, created.id));
      expect(party.endDate?.toISOString()).toBe('2030-10-14T14:59:59.999Z');

      // 정규 스터디는 입력을 무시하고 자동 산출한다 (변경 없음).
      const study = await createPost(
        { ...studyInput, endDate: new Date('2030-10-14T00:00:00.000Z') },
        leader!.id,
        tx,
      );
      const [studyRow] = await tx
        .select({ endDate: posts.endDate })
        .from(posts)
        .where(eq(posts.id, study.id));
      expect(studyRow.endDate?.toISOString()).not.toBe('2030-10-14T14:59:59.999Z');
      // 말일 23:59:59.999 KST = UTC 14:59:59.999.
      expect(studyRow.endDate?.toISOString()).toMatch(/T14:59:59\.999Z$/);
    });
  });

  it('TC-PARTY-02: 마감일이 지난 파티 참여는 400 CLOSED로 막고 기존 참여자는 링크를 유지한다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const now = new Date();

      const party = await createPost(
        partyInput(new Date(now.getTime() + 2 * DAY)),
        leader!.id,
        tx,
      );

      // 마감 전에는 참여가 된다.
      const joined = await joinPost(party.id, member!.id, tx);
      expect(joined.reJoined).toBe(false);
      expect(joined.chatUrl).toBe('https://discord.gg/party');

      // 마감일을 과거로 돌린다 (상태는 RECRUITING 그대로).
      await tx
        .update(posts)
        .set({ endDate: new Date(now.getTime() - 1 * DAY) })
        .where(eq(posts.id, party.id));

      // (a) 비참여자는 400 CLOSED. 카운트 불변.
      const seoul = await resolvePersonaUser('seoul_member', tx);
      const before = await tx
        .select({ n: posts.currentMembers })
        .from(posts)
        .where(eq(posts.id, party.id));
      await expect(joinPost(party.id, seoul!.id, tx)).rejects.toMatchObject({ code: 'CLOSED' });
      const after = await tx
        .select({ n: posts.currentMembers })
        .from(posts)
        .where(eq(posts.id, party.id));
      expect(after[0].n).toBe(before[0].n);

      // (b) 이미 참여한 유저는 멱등 반환으로 기존 링크를 다시 받는다 (FR-021).
      const again = await joinPost(party.id, member!.id, tx);
      expect(again.reJoined).toBe(true);
      expect(again.chatUrl).toBe('https://discord.gg/party');

      // (c) 리더도 자기 글의 참여 행을 갖고 있으므로 멱등 반환이다.
      const leaderAgain = await joinPost(party.id, leader!.id, tx);
      expect(leaderAgain.reJoined).toBe(true);

      // (d) 에러는 AppError이고 HTTP 400으로 매핑된다.
      await joinPost(party.id, seoul!.id, tx).catch((err) => {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).status).toBe(400);
      });
    });
  });

  it('TC-PARTY-02: 마감 경계는 KST 23:59:59.999까지 유효하다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const endDate = new Date('2030-10-14T14:59:59.999Z'); // KST 10/14 23:59:59.999

      const party = await createPost(partyInput(endDate), leader!.id, tx);
      await tx.update(posts).set({ endDate }).where(eq(posts.id, party.id));

      // 마감 1ms 전까지는 유효하다.
      const beforeBoundary = await listPosts(
        { type: 'PARTY' },
        tx,
        new Date(endDate.getTime() - 1),
      );
      expect(ids(beforeBoundary)).toContain(party.id);

      // 경계 시각부터 조회에서 빠진다. LIVE 핑 만료(expires_at > now)와 같은 배타 비교다.
      const atBoundary = await listPosts({ type: 'PARTY' }, tx, endDate);
      expect(ids(atBoundary)).not.toContain(party.id);

      // 참여도 1ms 뒤에는 막힌다. joinPost는 서버 시각을 쓰므로 end_date를 과거로 옮겨 검증한다.
      await tx
        .update(posts)
        .set({ endDate: new Date(Date.now() - 1000) })
        .where(eq(posts.id, party.id));
      await expect(joinPost(party.id, member!.id, tx)).rejects.toMatchObject({ code: 'CLOSED' });
    });
  });
});
