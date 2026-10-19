import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/posts/[id]/complete/route';

// Route Handler 레벨 검증: 인증·Zod. 서비스는 호출 전에 차단되어야 한다.
// vi.mock은 import보다 먼저 끌어올려지므로 mock 함수도 vi.hoisted로 만든다.
const { getCurrentUser, completePost } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  completePost: vi.fn(),
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
vi.mock('@/lib/posts', () => ({ completePost }));

// Zod v4 z.uuid()는 RFC 9562 형식(버전·variant 니블)을 검사하므로 실제 v4 형태를 쓴다.
const ID = '3f6c1a52-8d4e-4b7a-9c21-5e0f7a8b9c10';
const UID = '7b2e9d14-6a3f-4c58-8e71-2d9a0b4c6f83';

function req(body: unknown) {
  return new Request(`http://localhost:3000/api/posts/${ID}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentUser.mockReset();
  completePost.mockReset();
});

describe('POST /api/posts/:id/complete — 인증·입력 검증', () => {
  it('비로그인 → 403', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(req({ evaluations: [{ userId: UID, isCompleted: true }] }), { params: { id: ID } });
    expect(res.status).toBe(403);
    expect(completePost).not.toHaveBeenCalled();
  });

  it.each([
    ['evaluations 빈 배열', { evaluations: [] }],
    ['userId 비 uuid', { evaluations: [{ userId: 'nope', isCompleted: true }] }],
    ['proofUrl http://', { evaluations: [{ userId: UID, isCompleted: true }], proofUrl: 'http://x' }],
  ])('Zod 실패(%s) → 400', async (_label, body) => {
    getCurrentUser.mockResolvedValue({ id: UID });
    const res = await POST(req(body), { params: { id: ID } });
    expect(res.status).toBe(400);
    expect(completePost).not.toHaveBeenCalled();
  });

  it('유효 입력 → 서비스 호출 후 200', async () => {
    getCurrentUser.mockResolvedValue({ id: UID });
    completePost.mockResolvedValue({ id: ID, status: 'COMPLETED', completedCount: 1, incompleteCount: 0 });
    const res = await POST(
      req({ evaluations: [{ userId: UID, isCompleted: true }], proofUrl: 'https://github.com/x' }),
      { params: { id: ID } },
    );
    expect(res.status).toBe(200);
    expect(completePost).toHaveBeenCalledWith(
      ID,
      UID,
      [{ userId: UID, isCompleted: true }],
      'https://github.com/x',
      FAKE_DB,
      FIXED_NOW,
    );
  });
});
