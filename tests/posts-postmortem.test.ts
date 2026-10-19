import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import {
  createPost,
  joinPost,
  cancelPost,
  completePost,
  postmortemPost,
  type Database,
} from '@/lib/posts';
import { posts, users } from '@/db/schema';

const kst = (iso: string) => new Date(`${iso}+09:00`);
const END_DATE = kst('2026-10-31T23:59:59.999');
const NOW = kst('2026-10-20T12:00:00.000');

const input = (type: 'STUDY' | 'PARTY' = 'STUDY') => ({
  type,
  title: '회고 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 5,
  chatUrl: 'https://open.kakao.com/o/postmortem',
  ...(type === 'PARTY' ? { endDate: END_DATE } : {}),
});

async function fixture(tx: Database, type: 'STUDY' | 'PARTY' = 'STUDY') {
  const leader = (await resolvePersonaUser('gs_leader', tx))!;
  const member = (await resolvePersonaUser('gs_member', tx))!;
  const post = await createPost(input(type), leader.id, tx, new Date());
  await joinPost(post.id, member.id, tx, new Date());
  await tx.update(posts).set({ endDate: END_DATE }).where(eq(posts.id, post.id));
  return { leader, member, postId: post.id };
}

async function counts(tx: Database, userId: string) {
  const [u] = await tx
    .select({ completed: users.completedCount, leader: users.leaderCount })
    .from(users)
    .where(eq(users.id, userId));
  return u;
}

describe('Post-mortem 실패 회고 (FR-009)', () => {
  it('FR-009: 회고 등록 → 본문 저장, 상태 유지, 카운트 미가산', async () => {
    await withRollback(async (tx) => {
      const { leader, member, postId } = await fixture(tx);
      const [before] = await tx.select().from(posts).where(eq(posts.id, postId));
      const beforeCounts = { leader: await counts(tx, leader.id), member: await counts(tx, member.id) };

      const res = await postmortemPost(postId, leader.id, '과제 일정이 겹쳐 무너졌다.', tx, NOW);
      expect(res).toEqual({ id: postId, status: before.status, postmortemText: '과제 일정이 겹쳐 무너졌다.' });

      const [row] = await tx.select().from(posts).where(eq(posts.id, postId));
      expect(row.postmortemText).toBe('과제 일정이 겹쳐 무너졌다.');
      expect(row.status).toBe(before.status);
      expect(await counts(tx, leader.id)).toEqual(beforeCounts.leader);
      expect(await counts(tx, member.id)).toEqual(beforeCounts.member);
    });
  });

  it('두 번째 등록은 덮어쓴다', async () => {
    await withRollback(async (tx) => {
      const { leader, postId } = await fixture(tx);
      await postmortemPost(postId, leader.id, '첫 회고', tx, NOW);
      await postmortemPost(postId, leader.id, '보강한 회고', tx, NOW);
      const [row] = await tx.select().from(posts).where(eq(posts.id, postId));
      expect(row.postmortemText).toBe('보강한 회고');
    });
  });

  it('배타성: 회고 후 판정 → BAD_REQUEST, COMPLETED 글 회고 → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const { leader, member, postId } = await fixture(tx);
      await postmortemPost(postId, leader.id, '실패', tx, NOW);
      await expect(
        completePost(postId, leader.id, [{ userId: member.id, isCompleted: true }], undefined, tx, NOW),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
    await withRollback(async (tx) => {
      const { leader, member, postId } = await fixture(tx);
      await completePost(postId, leader.id, [{ userId: member.id, isCompleted: true }], undefined, tx, NOW);
      await expect(postmortemPost(postId, leader.id, '실패', tx, NOW)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('CANCELLED 글 회고 → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const { leader, postId } = await fixture(tx);
      await cancelPost(postId, leader.id, '취소', tx, new Date());
      await expect(postmortemPost(postId, leader.id, '실패', tx, NOW)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('창 시작 전(10/14 KST) → BAD_REQUEST, 창 종료 후(12/1 KST) → 허용', async () => {
    await withRollback(async (tx) => {
      const { leader, postId } = await fixture(tx);
      await expect(
        postmortemPost(postId, leader.id, '실패', tx, kst('2026-10-14T23:59:59.999')),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      await expect(
        postmortemPost(postId, leader.id, '뒤늦은 회고', tx, kst('2026-12-01T00:00:00.000')),
      ).resolves.toMatchObject({ postmortemText: '뒤늦은 회고' });
    });
  });

  it('PARTY → BAD_REQUEST, 비리더 → FORBIDDEN(TC-LEADER-01), 없는 글 → NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      const party = await fixture(tx, 'PARTY');
      await expect(postmortemPost(party.postId, party.leader.id, '실패', tx, NOW)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });

      const study = await fixture(tx);
      await expect(postmortemPost(study.postId, study.member.id, '실패', tx, NOW)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
      await expect(
        postmortemPost('00000000-0000-0000-0000-000000000000', study.leader.id, '실패', tx, NOW),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
