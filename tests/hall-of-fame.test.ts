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
  listHallOfFame,
  type Database,
} from '@/lib/posts';
import { posts } from '@/db/schema';

const kst = (iso: string) => new Date(`${iso}+09:00`);
const END_DATE = kst('2026-10-31T23:59:59.999');

const input = (type: 'STUDY' | 'PARTY', title: string) => ({
  type,
  title,
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 5,
  chatUrl: 'https://open.kakao.com/o/hall',
  ...(type === 'PARTY' ? { endDate: END_DATE } : {}),
});

/** 리더 + gs_member·seoul_member 참여, end_date 10월 사이클 고정. */
async function seed(tx: Database, title: string, type: 'STUDY' | 'PARTY' = 'STUDY') {
  const leader = (await resolvePersonaUser('gs_leader', tx))!;
  const member = (await resolvePersonaUser('gs_member', tx))!;
  const seoul = (await resolvePersonaUser('seoul_member', tx))!;
  const post = await createPost(input(type, title), leader.id, tx);
  await joinPost(post.id, member.id, tx);
  await joinPost(post.id, seoul.id, tx);
  await tx.update(posts).set({ endDate: END_DATE }).where(eq(posts.id, post.id));
  return { leader, member, seoul, postId: post.id };
}

describe('명예의 전당 / Post-mortem 목록 (FR-010, research R7)', () => {
  it('completed: 완주 STUDY만 포함, 회고·취소·PARTY·미판정 제외, chatUrl 없음', async () => {
    await withRollback(async (tx) => {
      const done = await seed(tx, '완주 글');
      await completePost(
        done.postId,
        done.leader.id,
        [
          { userId: done.member.id, isCompleted: true },
          { userId: done.seoul.id, isCompleted: false },
        ],
        'https://github.com/done',
        tx,
        kst('2026-10-20T12:00:00.000'),
      );
      const failed = await seed(tx, '회고 글');
      await postmortemPost(failed.postId, failed.leader.id, '실패', tx, kst('2026-10-20T12:00:00.000'));
      const cancelled = await seed(tx, '취소 글');
      await cancelPost(cancelled.postId, cancelled.leader.id, '취소', tx);
      const party = await seed(tx, '파티 글', 'PARTY');
      const pending = await seed(tx, '미판정 글');

      const list = await listHallOfFame('completed', tx);
      const ids = list.map((r) => r.id);
      expect(ids).toContain(done.postId);
      for (const id of [failed.postId, cancelled.postId, party.postId, pending.postId]) {
        expect(ids).not.toContain(id);
      }

      const item = list.find((r) => r.id === done.postId)!;
      expect(item).toMatchObject({
        title: '완주 글',
        templateId: null,
        proofUrl: 'https://github.com/done',
        leader: { login: 'gs_leader', campus: 'GS' },
        completedMembers: [{ login: 'gs_member', campus: 'GS' }], // 리더·미완주 제외
      });
      expect(item.endDate).toEqual(END_DATE);
      expect(item.completedAt).toEqual(kst('2026-10-20T12:00:00.000'));
      expect(item).not.toHaveProperty('chatUrl');
    });
  });

  it('postmortem: 회고 STUDY만 포함, 본문·작성 시각 포함, chatUrl 없음', async () => {
    await withRollback(async (tx) => {
      const failed = await seed(tx, '회고 글');
      await postmortemPost(failed.postId, failed.leader.id, '일정이 겹쳤다', tx, kst('2026-10-21T09:00:00.000'));
      const pending = await seed(tx, '미판정 글');

      const list = await listHallOfFame('postmortem', tx);
      const ids = list.map((r) => r.id);
      expect(ids).toContain(failed.postId);
      expect(ids).not.toContain(pending.postId);

      const item = list.find((r) => r.id === failed.postId)!;
      expect(item).toMatchObject({
        title: '회고 글',
        postmortemText: '일정이 겹쳤다',
        leader: { login: 'gs_leader', campus: 'GS' },
      });
      expect(item.writtenAt).toEqual(kst('2026-10-21T09:00:00.000'));
      expect(item).not.toHaveProperty('chatUrl');
    });
  });

  it('정렬: 나중에 완주 판정한 글이 앞에 온다 (updated_at DESC)', async () => {
    await withRollback(async (tx) => {
      const first = await seed(tx, '먼저 완주');
      const second = await seed(tx, '나중 완주');
      const evals = (s: Awaited<ReturnType<typeof seed>>) => [
        { userId: s.member.id, isCompleted: true },
        { userId: s.seoul.id, isCompleted: true },
      ];
      await completePost(first.postId, first.leader.id, evals(first), undefined, tx, kst('2026-10-20T00:00:00.000'));
      await completePost(second.postId, second.leader.id, evals(second), undefined, tx, kst('2026-10-25T00:00:00.000'));

      const ids = (await listHallOfFame('completed', tx)).map((r) => r.id);
      expect(ids.indexOf(second.postId)).toBeLessThan(ids.indexOf(first.postId));
    });
  });
});
