import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, toggleStatus, cancelPost } from '@/lib/posts';
import { posts } from '@/db/schema';

const input = {
  type: 'STUDY' as const,
  title: '토글 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/toggle',
};

describe('리더 수동 마감/재모집 토글 (FR-004, US3)', () => {
  it('마감 → 재모집 복귀', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);

      const closed = await toggleStatus(post.id, leader!.id, 'CLOSED', tx);
      expect(closed.status).toBe('CLOSED');

      const reopened = await toggleStatus(post.id, leader!.id, 'RECRUITING', tx);
      expect(reopened.status).toBe('RECRUITING');
    });
  });

  it('비리더 토글 → FORBIDDEN (403)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input, leader!.id, tx);

      await expect(toggleStatus(post.id, other!.id, 'CLOSED', tx)).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  it('허용 외 상태값으로 토글 → BAD_REQUEST (400)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);

      await expect(
        toggleStatus(post.id, leader!.id, 'COMPLETED' as 'CLOSED', tx),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('CANCELLED(최종) 글 토글 → BAD_REQUEST (400)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);
      await cancelPost(post.id, leader!.id, '취소', tx);

      await expect(toggleStatus(post.id, leader!.id, 'CLOSED', tx)).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.status).toBe('CANCELLED');
    });
  });
});
