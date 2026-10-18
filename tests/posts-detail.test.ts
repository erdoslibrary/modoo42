import { describe, it, expect } from 'vitest';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, getPostDetail, listPosts } from '@/lib/posts';

const input = {
  type: 'STUDY' as const,
  title: '마스킹 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/secret',
  referenceUrl: 'https://github.com/x/y',
};

describe('링크 가시성 (FR-006, SC-005)', () => {
  it('비참여자 상세 → chatUrl 키 없음, chatPlatform·referenceUrl은 공개', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const outsider = await resolvePersonaUser('seoul_member', tx);
      const post = await createPost(input, leader!.id, tx);

      const detail = await getPostDetail(post.id, outsider!.id, tx);
      expect('chatUrl' in detail).toBe(false);
      expect(detail.chatPlatform).toBe('kakao');
      expect(detail.referenceUrl).toBe('https://github.com/x/y');
      expect(detail.expiresAt).toBeNull(); // LIVE 전용 필드. STUDY는 null.
    });
  });

  it('참여자(리더) 상세 → chatUrl 포함', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx);

      const detail = await getPostDetail(post.id, leader!.id, tx);
      expect(detail.chatUrl).toBe('https://open.kakao.com/o/secret');
    });
  });

  it('존재하지 않는 글 상세 → NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      const viewer = await resolvePersonaUser('gs_member', tx);
      await expect(
        getPostDetail('00000000-0000-0000-0000-000000000000', viewer!.id, tx),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('리스트 → 모든 항목에 chatUrl 키 없음', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      await createPost(input, leader!.id, tx);

      const rows = await listPosts({ type: 'STUDY' }, tx);
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect('chatUrl' in r).toBe(false);
      }
    });
  });
});
