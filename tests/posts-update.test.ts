import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, updatePost, toggleStatus } from '@/lib/posts';
import { updatePostSchema } from '@/lib/validation';
import { posts } from '@/db/schema';

const input = {
  type: 'STUDY' as const,
  title: '수정 전 제목',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/upd',
};

describe('리더 게시글 수정 (FR-009, US4)', () => {
  it('리더 수정 → title/place 반영', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);

      await updatePost(post.id, leader!.id, { title: '수정 후 제목', place: '3층 클러스터' }, tx);
      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.title).toBe('수정 후 제목');
      expect(row.place).toBe('3층 클러스터');
    });
  });

  it('TC-LEADER-01: 비리더 수정 → FORBIDDEN (403)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input, leader!.id, tx);

      await expect(
        updatePost(post.id, other!.id, { title: '침범' }, tx),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });

  it('RECRUITING 아닌 글 수정 → BAD_REQUEST (400)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);
      await toggleStatus(post.id, leader!.id, 'CLOSED', tx);

      await expect(
        updatePost(post.id, leader!.id, { title: '마감 후 수정' }, tx),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('chatUrl 수정은 화이트리스트 재검증, 허용 외 필드는 거부', () => {
    expect(updatePostSchema.safeParse({ chatUrl: 'https://google.com' }).success).toBe(false);
    expect(updatePostSchema.safeParse({ chatUrl: 'https://discord.gg/x' }).success).toBe(true);
    expect(updatePostSchema.safeParse({ maxMembers: 3 }).success).toBe(false); // 허용 외 필드
  });
});
