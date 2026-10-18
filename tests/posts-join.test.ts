import { describe, it, expect } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { withRollback, createRacePool } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, joinPost, toggleStatus } from '@/lib/posts';
import { AppError } from '@/lib/errors';
import { posts, participants, users } from '@/db/schema';

const input = (maxMembers: number) => ({
  type: 'STUDY' as const,
  title: '참여 테스트',
  tags: ['모각코'],
  locationType: 'ONLINE' as const,
  maxMembers,
  chatUrl: 'https://open.kakao.com/o/join',
});

describe('참여 및 동시성 제어 (Test Suite 2)', () => {
  it('TC-JOIN-01: 참여 시 current_members+1, JOINED 레코드, chat_url 반환', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input(6), leader!.id, tx);

      const result = await joinPost(post.id, member!.id, tx);
      expect(result.chatUrl).toBe('https://open.kakao.com/o/join');
      expect(result.reJoined).toBe(false);

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.currentMembers).toBe(2);
      const parts = await tx
        .select()
        .from(participants)
        .where(and(eq(participants.postId, post.id), eq(participants.userId, member!.id)));
      expect(parts).toHaveLength(1);
      expect(parts[0].status).toBe('JOINED');
    });
  });

  it('TC-JOIN-02: 중복 참여 멱등 → 카운트 미증가, 기존 chat_url, reJoined true', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input(6), leader!.id, tx);

      await joinPost(post.id, member!.id, tx);
      const second = await joinPost(post.id, member!.id, tx);
      expect(second.reJoined).toBe(true);
      expect(second.chatUrl).toBe('https://open.kakao.com/o/join');

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.currentMembers).toBe(2); // 리더1 + member1, 재참여로 안 늘어남
    });
  });

  it('TC-JOIN-03: 마지막 자리 참여 시 자동 CLOSED', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input(2), leader!.id, tx); // 정원 2, 리더로 1

      await joinPost(post.id, member!.id, tx); // 2 도달
      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.currentMembers).toBe(2);
      expect(row.status).toBe('CLOSED');
    });
  });

  it('정원 찬 글을 재모집으로 다시 열고 참여 → FULL (400)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const m1 = await resolvePersonaUser('gs_member', tx);
      const m2 = await resolvePersonaUser('seoul_member', tx);
      const post = await createPost(input(2), leader!.id, tx); // 정원 2
      await joinPost(post.id, m1!.id, tx); // 2 도달 → CLOSED
      await toggleStatus(post.id, leader!.id, 'RECRUITING', tx); // 정원 찬 채로 재모집

      await expect(joinPost(post.id, m2!.id, tx)).rejects.toMatchObject({ code: 'FULL' });
    });
  });

  it('CLOSED 글 참여 시도 → CLOSED 에러 (400)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const m1 = await resolvePersonaUser('gs_member', tx);
      const m2 = await resolvePersonaUser('seoul_member', tx);
      const post = await createPost(input(2), leader!.id, tx);
      await joinPost(post.id, m1!.id, tx); // CLOSED

      await expect(joinPost(post.id, m2!.id, tx)).rejects.toMatchObject({ code: 'CLOSED' });
    });
  });

  it('TC-RACE-01: 정원 1자리에 5명 동시 참여 → 정확히 1명 성공, 4명 FULL, 초과 0', async () => {
    // 롤백 격리로는 실제 커넥션 경합을 못 만든다 → 전용 풀 + 실제 커밋 후 수동 정리 (research R2).
    const pool = createRacePool(6);
    const createdUserIds: string[] = [];
    let postId = '';
    try {
      // 리더 + 참여 후보 5명 (고유 intraId) 실제 생성.
      const leader = await resolvePersonaUser('gs_leader', pool.db);
      const racers: string[] = [];
      for (let i = 0; i < 5; i++) {
        const tag = `race_${Date.now()}_${i}`;
        const [u] = await pool.db
          .insert(users)
          .values({ githubId: `gh_${tag}`, login: tag, campus: 'GS' })
          .returning({ id: users.id });
        racers.push(u.id);
        createdUserIds.push(u.id);
      }

      // 정원 2(리더 포함 1 → 1자리 남음) 글 실제 생성.
      const post = await createPost(input(2), leader!.id, pool.db);
      postId = post.id;

      // 5명 동시 참여.
      const results = await Promise.allSettled(racers.map((uid) => joinPost(postId, uid, pool.db)));
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      // 마지막 1자리 경합: 승자가 정원을 채우며 CLOSED로 전이하므로 패자는 FULL 또는 CLOSED.
      // 둘 다 "정원 마감"(400)이다. 핵심 불변식은 성공 1 · 실패 4 · 초과 0.
      const rejectedMaxed = results.filter(
        (r) => r.status === 'rejected' && ['FULL', 'CLOSED'].includes((r.reason as AppError)?.code),
      ).length;

      expect(ok).toBe(1);
      expect(rejectedMaxed).toBe(4);

      // 정원 초과 0건 검증.
      const [row] = await pool.db.select().from(posts).where(eq(posts.id, postId));
      expect(row.currentMembers).toBe(2);
      expect(row.currentMembers).toBeLessThanOrEqual(row.maxMembers!);
      expect(row.status).toBe('CLOSED');
    } finally {
      // 정리: 글 삭제(참여 cascade) → 생성 유저 삭제.
      if (postId) await pool.db.delete(posts).where(eq(posts.id, postId));
      if (createdUserIds.length) {
        await pool.db.delete(participants).where(inArray(participants.userId, createdUserIds));
        await pool.db.delete(users).where(inArray(users.id, createdUserIds));
      }
      await pool.client.end({ timeout: 5 });
    }
  });
});
