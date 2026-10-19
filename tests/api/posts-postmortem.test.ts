import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/posts/[id]/postmortem/route';

const { getCurrentUser, postmortemPost } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  postmortemPost: vi.fn(),
}));
const { FIXED_NOW, FAKE_DB } = vi.hoisted(() => ({
  FIXED_NOW: new Date('2026-10-19T03:00:00.000Z'),
  FAKE_DB: { __fake: 'db' },
}));
// 라우트를 직접 호출하면 next/headers의 cookies()가 요청 스코프 밖이라 던진다.
// 이 테스트는 라우트 배선을 보는 것이므로 시각·핸들 모듈을 대역으로 바꾼다 (FR-027).
vi.mock('@/lib/clock', () => ({ serverNow: () => FIXED_NOW, realNow: () => FIXED_NOW }));
vi.mock('@/lib/dev/sandbox', () => ({ requestDatabase: () => FAKE_DB }));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/posts', () => ({ postmortemPost }));

const ID = '3f6c1a52-8d4e-4b7a-9c21-5e0f7a8b9c10';
const UID = '7b2e9d14-6a3f-4c58-8e71-2d9a0b4c6f83';

function req(body: unknown) {
  return new Request(`http://localhost:3000/api/posts/${ID}/postmortem`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentUser.mockReset();
  postmortemPost.mockReset();
});

describe('POST /api/posts/:id/postmortem — 인증·입력 검증', () => {
  it('비로그인 → 403', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(req({ text: '실패' }), { params: { id: ID } });
    expect(res.status).toBe(403);
    expect(postmortemPost).not.toHaveBeenCalled();
  });

  it.each([
    ['공백만', { text: '   ' }],
    ['1001자', { text: 'a'.repeat(1001) }],
  ])('Zod 실패(%s) → 400', async (_label, body) => {
    getCurrentUser.mockResolvedValue({ id: UID });
    const res = await POST(req(body), { params: { id: ID } });
    expect(res.status).toBe(400);
    expect(postmortemPost).not.toHaveBeenCalled();
  });

  it('유효 입력 → 앞뒤 공백을 다듬어 서비스 호출 후 200', async () => {
    getCurrentUser.mockResolvedValue({ id: UID });
    postmortemPost.mockResolvedValue({ id: ID, status: 'CLOSED', postmortemText: '실패' });
    const res = await POST(req({ text: '  실패  ' }), { params: { id: ID } });
    expect(res.status).toBe(200);
    expect(postmortemPost).toHaveBeenCalledWith(ID, UID, '실패', FAKE_DB, FIXED_NOW);
  });
});
