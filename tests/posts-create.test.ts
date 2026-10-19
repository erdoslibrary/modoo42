import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost } from '@/lib/posts';
import { createPostSchema } from '@/lib/validation';
import { computeStudyEndDate } from '@/lib/end-date';
import { participants } from '@/db/schema';

const baseInput = {
  type: 'STUDY' as const,
  title: '코테 스터디',
  tags: ['코딩테스트'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/abc123',
};

describe('게시글 생성 및 유효성 (Test Suite 1)', () => {
  it('TC-POST-01: 유효한 정규 스터디 생성 시 RECRUITING + currentMembers 1 + 리더 JOINED 자동 삽입', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(baseInput, leader!.id, tx, new Date());

      expect(post.id).toBeTruthy();
      expect(post.status).toBe('RECRUITING');
      expect(post.currentMembers).toBe(1);

      const rows = await tx
        .select()
        .from(participants)
        .where(and(eq(participants.postId, post.id), eq(participants.userId, leader!.id)));
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('JOINED');
    });
  });

  it('TC-POST-02: 제목 41자 → 400 (Zod 거부)', () => {
    const r = createPostSchema.safeParse({ ...baseInput, title: 'a'.repeat(41) });
    expect(r.success).toBe(false);
  });

  it('TC-POST-03: 정원 1명 또는 11명 → 400 (허용 2~10)', () => {
    expect(createPostSchema.safeParse({ ...baseInput, maxMembers: 1 }).success).toBe(false);
    expect(createPostSchema.safeParse({ ...baseInput, maxMembers: 11 }).success).toBe(false);
    expect(createPostSchema.safeParse({ ...baseInput, maxMembers: 2 }).success).toBe(true);
    expect(createPostSchema.safeParse({ ...baseInput, maxMembers: 10 }).success).toBe(true);
  });

  it('TC-POST-04: google.com 차단, open.kakao.com 통과', () => {
    expect(createPostSchema.safeParse({ ...baseInput, chatUrl: 'https://google.com' }).success).toBe(false);
    expect(createPostSchema.safeParse({ ...baseInput, chatUrl: 'http://open.kakao.com/o/x' }).success).toBe(false);
    expect(createPostSchema.safeParse({ ...baseInput, chatUrl: 'https://open.kakao.com/o/xxx' }).success).toBe(true);
    expect(createPostSchema.safeParse({ ...baseInput, chatUrl: 'https://discord.gg/abc' }).success).toBe(true);
    expect(createPostSchema.safeParse({ ...baseInput, chatUrl: 'https://discord.com/invite/abc' }).success).toBe(true);
  });

  it('태그 4개 → 400 (최대 3개)', () => {
    expect(createPostSchema.safeParse({ ...baseInput, tags: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(createPostSchema.safeParse({ ...baseInput, tags: [] }).success).toBe(false);
  });

  it('STUDY end_date 자동 산출: 1~14일 개설 → 당월 말일', () => {
    // 2026-03-10 KST 개설 → 2026-03-31 (당월 말일) KST 말.
    const opened = new Date(Date.UTC(2026, 2, 10, 1, 0, 0)); // 10:00 KST
    const end = computeStudyEndDate(opened);
    const endKst = new Date(end.getTime() + 9 * 3600 * 1000);
    expect(endKst.getUTCFullYear()).toBe(2026);
    expect(endKst.getUTCMonth()).toBe(2); // 3월
    expect(endKst.getUTCDate()).toBe(31);
  });

  it('STUDY end_date 자동 산출: 15일~말일 개설 → 익월 말일 (연말 롤오버 포함)', () => {
    // 2026-12-20 KST 개설 → 2027-01-31 KST 말.
    const opened = new Date(Date.UTC(2026, 11, 20, 1, 0, 0));
    const end = computeStudyEndDate(opened);
    const endKst = new Date(end.getTime() + 9 * 3600 * 1000);
    expect(endKst.getUTCFullYear()).toBe(2027);
    expect(endKst.getUTCMonth()).toBe(0); // 1월
    expect(endKst.getUTCDate()).toBe(31);
  });

  it('2월(28일) 경계: 2026-02-05 개설 → 2026-02-28', () => {
    const opened = new Date(Date.UTC(2026, 1, 5, 1, 0, 0));
    const end = computeStudyEndDate(opened);
    const endKst = new Date(end.getTime() + 9 * 3600 * 1000);
    expect(endKst.getUTCMonth()).toBe(1);
    expect(endKst.getUTCDate()).toBe(28);
  });
});
