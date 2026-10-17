import { describe, it, expect } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { withRollback, createRacePool } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import type { AppError } from '@/lib/errors';
import {
  createPost,
  joinPost,
  cancelPost,
  updatePost,
  toggleStatus,
  completePost,
  type Database,
} from '@/lib/posts';
import { posts, participants, users } from '@/db/schema';

// KST 벽시계 문자열 → 실제 시각.
const kst = (iso: string) => new Date(`${iso}+09:00`);
const END_DATE = kst('2026-10-31T23:59:59.999'); // 10월 사이클
const NOW = kst('2026-10-20T12:00:00.000'); // 판정 창 안

const input = (type: 'STUDY' | 'PARTY' = 'STUDY') => ({
  type,
  title: '완주 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 5,
  chatUrl: 'https://open.kakao.com/o/complete',
  ...(type === 'PARTY' ? { endDate: END_DATE } : {}),
});

/** 리더 + 멤버 2명이 참여한 글. end_date를 10월 사이클로 고정한다. */
async function fixture(tx: Database, type: 'STUDY' | 'PARTY' = 'STUDY') {
  const leader = (await resolvePersonaUser('gs_leader', tx))!;
  const member = (await resolvePersonaUser('gs_member', tx))!;
  const seoul = (await resolvePersonaUser('seoul_member', tx))!;
  const post = await createPost(input(type), leader.id, tx);
  await joinPost(post.id, member.id, tx);
  await joinPost(post.id, seoul.id, tx);
  await tx.update(posts).set({ endDate: END_DATE }).where(eq(posts.id, post.id));
  return { leader, member, seoul, postId: post.id };
}

async function counts(tx: Database, userId: string) {
  const [u] = await tx
    .select({ completed: users.completedCount, leader: users.leaderCount })
    .from(users)
    .where(eq(users.id, userId));
  return u;
}

async function participantStatus(tx: Database, postId: string, userId: string) {
  const [p] = await tx
    .select({ status: participants.status })
    .from(participants)
    .where(and(eq(participants.postId, postId), eq(participants.userId, userId)));
  return p?.status;
}

describe('완주 벌크 판정 (FR-008, NFR-003)', () => {
  it('TC-COMPLETE-01: 판정 → COMPLETED, 완주 멤버 completed_count+1, 리더 leader_count+1 (증빙 없음)', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      const before = {
        leader: await counts(tx, leader.id),
        member: await counts(tx, member.id),
        seoul: await counts(tx, seoul.id),
      };

      const res = await completePost(
        postId,
        leader.id,
        [
          { userId: member.id, isCompleted: true },
          { userId: seoul.id, isCompleted: false },
        ],
        undefined,
        tx,
        NOW,
      );
      expect(res).toEqual({ id: postId, status: 'COMPLETED', completedCount: 1, incompleteCount: 1 });

      const [row] = await tx.select().from(posts).where(eq(posts.id, postId));
      expect(row.status).toBe('COMPLETED');
      expect(row.proofUrl).toBeNull();

      expect(await counts(tx, member.id)).toEqual({ ...before.member, completed: before.member.completed + 1 });
      expect(await counts(tx, seoul.id)).toEqual(before.seoul);
      expect(await counts(tx, leader.id)).toEqual({ ...before.leader, leader: before.leader.leader + 1 });

      expect(await participantStatus(tx, postId, member.id)).toBe('COMPLETED');
      expect(await participantStatus(tx, postId, seoul.id)).toBe('INCOMPLETE');
      expect(await participantStatus(tx, postId, leader.id)).toBe('COMPLETED');
    });
  });

  it('TC-COMPLETE-01: 증빙 URL을 넣으면 저장한다', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      await completePost(
        postId,
        leader.id,
        [
          { userId: member.id, isCompleted: true },
          { userId: seoul.id, isCompleted: true },
        ],
        'https://github.com/x',
        tx,
        NOW,
      );
      const [row] = await tx.select().from(posts).where(eq(posts.id, postId));
      expect(row.proofUrl).toBe('https://github.com/x');
    });
  });

  it('TC-COMPLETE-02: COMPLETED 후 참여·취소·수정·토글·재판정 → 400 차단', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      const evals = [
        { userId: member.id, isCompleted: true },
        { userId: seoul.id, isCompleted: true },
      ];
      await completePost(postId, leader.id, evals, undefined, tx, NOW);

      const outsider = await tx
        .insert(users)
        .values({ intraId: `outsider_${Date.now()}`, campus: 'GS' })
        .returning({ id: users.id });
      await expect(joinPost(postId, outsider[0].id, tx)).rejects.toMatchObject({ code: 'CLOSED' });
      await expect(cancelPost(postId, leader.id, '취소', tx)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      await expect(updatePost(postId, leader.id, { title: 'x' }, tx)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(toggleStatus(postId, leader.id, 'RECRUITING', tx)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(completePost(postId, leader.id, evals, undefined, tx, NOW)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('TC-LEADER-01: 비리더 판정 → FORBIDDEN', async () => {
    await withRollback(async (tx) => {
      const { member, seoul, postId } = await fixture(tx);
      await expect(
        completePost(postId, member.id, [{ userId: seoul.id, isCompleted: true }], undefined, tx, NOW),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  it('판정 창 경계: 10/14 23:59:59·11/11 00:00 KST 차단, 10/15 00:00·11/10 23:59:59 KST 허용', async () => {
    const cases: [string, boolean][] = [
      ['2026-10-14T23:59:59.999', false],
      ['2026-10-15T00:00:00.000', true],
      ['2026-11-10T23:59:59.999', true],
      ['2026-11-11T00:00:00.000', false],
    ];
    for (const [at, allowed] of cases) {
      await withRollback(async (tx) => {
        const { leader, member, seoul, postId } = await fixture(tx);
        const run = completePost(
          postId,
          leader.id,
          [
            { userId: member.id, isCompleted: true },
            { userId: seoul.id, isCompleted: false },
          ],
          undefined,
          tx,
          kst(at),
        );
        if (allowed) await expect(run).resolves.toMatchObject({ status: 'COMPLETED' });
        else await expect(run).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      });
    }
  }, 30_000); // 경계 4건 × 픽스처 생성 — 원격 Supabase 왕복이 많다.

  it('판정 목록 불일치(누락·중복·비참여자·리더 포함) → BAD_REQUEST, 아무것도 바뀌지 않음', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      const [outsider] = await tx
        .insert(users)
        .values({ intraId: `outsider_${Date.now()}`, campus: 'GS' })
        .returning({ id: users.id });
      const before = { leader: await counts(tx, leader.id), member: await counts(tx, member.id) };

      const bad = [
        [{ userId: member.id, isCompleted: true }], // 누락
        [
          { userId: member.id, isCompleted: true },
          { userId: member.id, isCompleted: true },
          { userId: seoul.id, isCompleted: true },
        ], // 중복
        [
          { userId: member.id, isCompleted: true },
          { userId: seoul.id, isCompleted: true },
          { userId: outsider.id, isCompleted: true },
        ], // 비참여자
        [
          { userId: member.id, isCompleted: true },
          { userId: seoul.id, isCompleted: true },
          { userId: leader.id, isCompleted: true },
        ], // 리더 포함
      ];
      for (const evals of bad) {
        await expect(completePost(postId, leader.id, evals, undefined, tx, NOW)).rejects.toMatchObject({
          code: 'BAD_REQUEST',
        });
      }

      const [row] = await tx.select().from(posts).where(eq(posts.id, postId));
      expect(row.status).not.toBe('COMPLETED');
      expect(await counts(tx, leader.id)).toEqual(before.leader);
      expect(await counts(tx, member.id)).toEqual(before.member);
      expect(await participantStatus(tx, postId, member.id)).toBe('JOINED');
    });
  });

  it('완주 0명(전원 미완주) → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      await expect(
        completePost(
          postId,
          leader.id,
          [
            { userId: member.id, isCompleted: false },
            { userId: seoul.id, isCompleted: false },
          ],
          undefined,
          tx,
          NOW,
        ),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('PARTY 판정 → BAD_REQUEST (정규 스터디 전용, FR-012)', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx, 'PARTY');
      await expect(
        completePost(
          postId,
          leader.id,
          [
            { userId: member.id, isCompleted: true },
            { userId: seoul.id, isCompleted: true },
          ],
          undefined,
          tx,
          NOW,
        ),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('CANCELLED 판정 → BAD_REQUEST, 없는 글 → NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      const { leader, member, seoul, postId } = await fixture(tx);
      await cancelPost(postId, leader.id, '취소', tx);
      const evals = [
        { userId: member.id, isCompleted: true },
        { userId: seoul.id, isCompleted: true },
      ];
      await expect(completePost(postId, leader.id, evals, undefined, tx, NOW)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(
        completePost('00000000-0000-0000-0000-000000000000', leader.id, evals, undefined, tx, NOW),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('동시 판정 2건 → 정확히 1건 성공, 카운트는 1회만 가산 (FR-011)', async () => {
    // 롤백 격리로는 커넥션 경합을 못 만든다 → 전용 풀 + 실제 커밋 후 수동 정리.
    // 공용 페르소나 카운트를 건드리지 않도록 전용 유저를 만든다.
    const pool = createRacePool(4);
    const createdUserIds: string[] = [];
    let postId = '';
    try {
      const mk = async (tag: string) => {
        const [u] = await pool.db
          .insert(users)
          .values({ intraId: `cmp_${tag}_${Date.now()}`, campus: 'GS' })
          .returning({ id: users.id });
        createdUserIds.push(u.id);
        return u.id;
      };
      const leaderId = await mk('leader');
      const memberId = await mk('member');

      const post = await createPost(input(), leaderId, pool.db);
      postId = post.id;
      await joinPost(postId, memberId, pool.db);
      await pool.db.update(posts).set({ endDate: END_DATE }).where(eq(posts.id, postId));

      const evals = [{ userId: memberId, isCompleted: true }];
      const results = await Promise.allSettled([
        completePost(postId, leaderId, evals, undefined, pool.db, NOW),
        completePost(postId, leaderId, evals, undefined, pool.db, NOW),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
      expect(rejected).toHaveLength(1);
      expect((rejected[0].reason as AppError).code).toBe('BAD_REQUEST');

      expect(await counts(pool.db, leaderId)).toEqual({ completed: 0, leader: 1 });
      expect(await counts(pool.db, memberId)).toEqual({ completed: 1, leader: 0 });
    } finally {
      if (postId) await pool.db.delete(posts).where(eq(posts.id, postId));
      if (createdUserIds.length) {
        await pool.db.delete(participants).where(inArray(participants.userId, createdUserIds));
        await pool.db.delete(users).where(inArray(users.id, createdUserIds));
      }
      await pool.client.end({ timeout: 5 });
    }
  });
});
