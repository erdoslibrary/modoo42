import { describe, it, expect, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/mock-auth/route';

const COOKIE = 'modoo42_mock_user';

function req(body: unknown) {
  return new Request('http://localhost:3000/api/mock-auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/mock-auth — 개발 환경 (US1)', () => {
  it('gs_leader → 200, modoo42_mock_user 쿠키 세팅', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(req({ persona: 'gs_leader' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ persona: 'gs_leader' });
    expect(res.cookies.get(COOKIE)?.value).toBe('gs_leader');
  });

  it('guest → 200, 쿠키 삭제(로그아웃)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(req({ persona: 'guest' }));
    expect(res.status).toBe(200);
    // 삭제된 쿠키는 빈 값 + 과거 만료(epoch)로 내려간다.
    expect(res.cookies.get(COOKIE)?.value).toBe('');
    expect(res.headers.get('set-cookie')).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe('POST /api/mock-auth — 입력 검증 (US2, FR-005)', () => {
  it('알 수 없는 persona → 400 BAD_REQUEST, 쿠키 세팅 없음', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(req({ persona: 'bogus_value' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'BAD_REQUEST' });
    expect(res.cookies.get(COOKIE)).toBeUndefined();
  });

  it('persona 누락 → 400', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/mock-auth — 상용 차단 (US2, FR-004, 보안)', () => {
  it('NODE_ENV=production → 404, 세션 불변', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await POST(req({ persona: 'gs_leader' }));
    expect(res.status).toBe(404);
    expect(res.cookies.get(COOKIE)).toBeUndefined();
  });
});
