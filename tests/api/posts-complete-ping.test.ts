import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/posts/[id]/complete-ping/route';
import { AppError } from '@/lib/errors';

// Route Handler 레벨 검증: 인증·서비스 위임·에러 매핑.
const { getCurrentUser, completeLivePing } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  completeLivePing: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/posts', () => ({ completeLivePing }));

const ID = '3f6c1a52-8d4e-4b7a-9c21-5e0f7a8b9c10';
const USER = { id: '7b2e9d14-6a3f-4c58-8e71-2d9a0b4c6f83' };

const req = () =>
  new Request(`http://localhost:3000/api/posts/${ID}/complete-ping`, { method: 'POST' });

beforeEach(() => {
  getCurrentUser.mockReset();
  completeLivePing.mockReset();
});

describe('POST /api/posts/:id/complete-ping', () => {
  it('비로그인 → 403, 서비스 미호출', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(req(), { params: { id: ID } });
    expect(res.status).toBe(403);
    expect(completeLivePing).not.toHaveBeenCalled();
  });

  it('로그인 → completeLivePing(postId, userId) 호출 + 200', async () => {
    getCurrentUser.mockResolvedValue(USER);
    completeLivePing.mockResolvedValue({ id: ID, status: 'CLOSED' });

    const res = await POST(req(), { params: { id: ID } });
    expect(res.status).toBe(200);
    expect(completeLivePing).toHaveBeenCalledWith(ID, USER.id);
    await expect(res.json()).resolves.toEqual({ id: ID, status: 'CLOSED' });
  });

  it('서비스가 FORBIDDEN을 던지면 403으로 매핑된다', async () => {
    getCurrentUser.mockResolvedValue(USER);
    completeLivePing.mockRejectedValue(new AppError('FORBIDDEN', '작성자만 완료할 수 있습니다.'));

    const res = await POST(req(), { params: { id: ID } });
    expect(res.status).toBe(403);
  });

  it('서비스가 BAD_REQUEST를 던지면 400으로 매핑된다', async () => {
    getCurrentUser.mockResolvedValue(USER);
    completeLivePing.mockRejectedValue(new AppError('BAD_REQUEST', 'LIVE 핑만 완료할 수 있습니다.'));

    const res = await POST(req(), { params: { id: ID } });
    expect(res.status).toBe(400);
  });
});
