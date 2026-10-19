// 도메인 레코드 타임스탬프가 유효 시각을 따른다 (FR-027, research.md R6).
// 공용 Supabase 인스턴스에 붙으므로 트랜잭션 롤백으로 격리한다 (CLAUDE.md §9).
import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, joinPost } from '@/lib/posts';
import { computeStudyEndDate } from '@/lib/end-date';
import { participants, posts } from '@/db/schema';

const baseInput = {
  type: 'STUDY' as const,
  title: '과거 사이클 스터디',
  tags: ['코딩테스트'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/abc123',
};

// 2026-08-20 KST 09:00. 15일 이후 개설이므로 end_date는 9월 말일이어야 한다.
const PAST = new Date('2026-08-20T00:00:00.000Z');

describe('개발자 콘솔 시각 주입과 레코드 타임스탬프 (Test Suite 10)', () => {
  it('TC-DEV-08: 과거 now로 만든 정규 스터디의 end_date가 그 시점 기준이다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(baseInput, leader!.id, tx, PAST);

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.endDate).not.toBeNull();
      // 실제 시각이 아니라 주입된 과거 시각 기준으로 산출된다.
      expect(row.endDate!.toISOString()).toBe(computeStudyEndDate(PAST).toISOString());
      expect(row.endDate!.toISOString()).not.toBe(computeStudyEndDate(new Date()).toISOString());
    });
  });

  it('TC-DEV-12: created_at과 리더 joined_at이 주입된 과거 시각이다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(baseInput, leader!.id, tx, PAST);

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.createdAt.toISOString()).toBe(PAST.toISOString());
      expect(row.updatedAt.toISOString()).toBe(PAST.toISOString());

      const [leaderRow] = await tx
        .select()
        .from(participants)
        .where(and(eq(participants.postId, post.id), eq(participants.userId, leader!.id)));
      expect(leaderRow.joinedAt.toISOString()).toBe(PAST.toISOString());
    });
  });

  it('TC-DEV-12: 참여 행의 joined_at도 주입된 시각을 쓴다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(baseInput, leader!.id, tx, PAST);

      // 참여는 개설보다 1일 뒤 시각으로 주입한다.
      const joinedNow = new Date(PAST.getTime() + 24 * 60 * 60 * 1000);
      await joinPost(post.id, member!.id, tx, joinedNow);

      const [memberRow] = await tx
        .select()
        .from(participants)
        .where(and(eq(participants.postId, post.id), eq(participants.userId, member!.id)));
      expect(memberRow.joinedAt.toISOString()).toBe(joinedNow.toISOString());
    });
  });
});
