import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/posts/route';

// Route Handler 레벨 검증: 인증·Zod·type 분기. 서비스는 호출 전에 차단되어야 한다.
const { getCurrentUser, createPost, createLivePing } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createPost: vi.fn(),
  createLivePing: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/posts', () => ({ createPost, createLivePing, listPosts: vi.fn() }));

const USER = { id: '7b2e9d14-6a3f-4c58-8e71-2d9a0b4c6f83' };

const liveBody = {
  type: 'LIVE',
  text: 'philosopher 데드락 헬프',
  place: '클러스터 2층',
  durationMinutes: 30,
};

const studyBody = {
  type: 'STUDY',
  title: '알고리즘 정복',
  tags: ['코딩테스트'],
  locationType: 'ONLINE',
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/abc',
};

function req(body: unknown) {
  return new Request('http://localhost:3000/api/posts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  getCurrentUser.mockReset();
  createPost.mockReset();
  createLivePing.mockReset();
});

describe('POST /api/posts — LIVE 핑 분기 (TC-LIVE-01)', () => {
  it('비로그인 → 403, 서비스 미호출', async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST(req(liveBody));
    expect(res.status).toBe(403);
    expect(createLivePing).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('text 51자 → 400, createLivePing 미호출', async () => {
    getCurrentUser.mockResolvedValue(USER);
    const res = await POST(req({ ...liveBody, text: 'ㄱ'.repeat(51) }));
    expect(res.status).toBe(400);
    expect(createLivePing).not.toHaveBeenCalled();
  });

  it('유효한 LIVE → createLivePing 호출 + 201', async () => {
    getCurrentUser.mockResolvedValue(USER);
    const expiresAt = new Date('2026-10-18T05:30:00.000Z');
    createLivePing.mockResolvedValue({ id: 'ping-id', status: 'RECRUITING', expiresAt });

    const res = await POST(req(liveBody));
    expect(res.status).toBe(201);
    expect(createLivePing).toHaveBeenCalledWith(expect.objectContaining(liveBody), USER.id);
    expect(createPost).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ id: 'ping-id', status: 'RECRUITING' });
  });

  it('유효한 STUDY → createPost 호출, createLivePing 미호출', async () => {
    getCurrentUser.mockResolvedValue(USER);
    createPost.mockResolvedValue({ id: 'study-id', status: 'RECRUITING', currentMembers: 1 });

    const res = await POST(req(studyBody));
    expect(res.status).toBe(201);
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ type: 'STUDY' }), USER.id);
    expect(createLivePing).not.toHaveBeenCalled();
  });
});
