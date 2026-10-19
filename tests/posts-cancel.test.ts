import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, cancelPost, joinPost, updatePost } from '@/lib/posts';
import { posts } from '@/db/schema';

const input = {
  type: 'STUDY' as const,
  title: '취소 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/cancel',
};

describe('스터디 중도 취소 (FR-005, NFR-003)', () => {
  it('TC-CANCEL-01: 리더 취소 → CANCELLED + 사유 저장, 이후 참여 차단', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input, leader!.id, tx, new Date());

      const res = await cancelPost(post.id, leader!.id, '모집 인원 미달', tx, new Date());
      expect(res.status).toBe('CANCELLED');

      const [row] = await tx.select().from(posts).where(eq(posts.id, post.id));
      expect(row.status).toBe('CANCELLED');
      expect(row.cancelReason).toBe('모집 인원 미달');

      // 취소 후 신규 참여 차단 (RECRUITING 아님 → CLOSED 에러).
      await expect(joinPost(post.id, member!.id, tx, new Date())).rejects.toMatchObject({ code: 'CLOSED' });
    });
  });

  it('TC-COMPLETE-02류: CANCELLED 후 수정 시도 → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx, new Date());
      await cancelPost(post.id, leader!.id, '취소', tx, new Date());

      await expect(
        updatePost(post.id, leader!.id, { title: '취소 후 수정' }, tx, new Date()),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('비리더 취소 → FORBIDDEN (403)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const post = await createPost(input, leader!.id, tx, new Date());

      await expect(cancelPost(post.id, other!.id, '침범', tx, new Date())).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });
  });

  it('이미 CANCELLED 재취소 → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx, new Date());
      await cancelPost(post.id, leader!.id, '취소', tx, new Date());

      await expect(cancelPost(post.id, leader!.id, '재취소', tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });
});
