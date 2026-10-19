import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/mock-auth/route';

const COOKIE = 'modoo42_mock_user';

// 게이트는 NODE_ENV가 아니라 개발자 콘솔 하나다 (FR-027, 2026-10-19 사용자 결정).
// 라우트를 직접 호출하면 cookies()가 요청 스코프 밖이라 던지므로 판정 함수를 대역으로 바꾼다.
const { isPersonaSwitchEnabled } = vi.hoisted(() => ({ isPersonaSwitchEnabled: vi.fn() }));
vi.mock('@/lib/auth', async () => {
  const personas = await import('@/lib/personas');
  return {
    MOCK_COOKIE_NAME: 'modoo42_mock_user',
    PERSONAS: personas.PERSONAS,
    isPersonaSwitchEnabled,
  };
});

function req(body: unknown) {
  return new Request('http://localhost:3000/api/mock-auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  isPersonaSwitchEnabled.mockReset();
  isPersonaSwitchEnabled.mockReturnValue(true);
});

describe('POST /api/mock-auth — 콘솔 세션 (US1)', () => {
  it('gs_leader → 200, modoo42_mock_user 쿠키 세팅', async () => {
    const res = await POST(req({ persona: 'gs_leader' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ persona: 'gs_leader' });
    expect(res.cookies.get(COOKIE)?.value).toBe('gs_leader');
  });

  it('guest → 200, 쿠키 삭제(로그아웃)', async () => {
    const res = await POST(req({ persona: 'guest' }));
    expect(res.status).toBe(200);
    // 삭제된 쿠키는 빈 값 + 과거 만료(epoch)로 내려간다.
    expect(res.cookies.get(COOKIE)?.value).toBe('');
    expect(res.headers.get('set-cookie')).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });
});

describe('POST /api/mock-auth — 입력 검증 (US2, FR-005)', () => {
  it('알 수 없는 persona → 400 BAD_REQUEST, 쿠키 세팅 없음', async () => {
    const res = await POST(req({ persona: 'bogus_value' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'BAD_REQUEST' });
    expect(res.cookies.get(COOKIE)).toBeUndefined();
  });

  it('persona 누락 → 400', async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/mock-auth — 콘솔 게이트 차단 (US2, FR-027, 보안)', () => {
  it('콘솔 게이트가 닫히면 404, 세션 불변', async () => {
    isPersonaSwitchEnabled.mockReturnValue(false);
    const res = await POST(req({ persona: 'gs_leader' }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'NOT_FOUND' });
    expect(res.cookies.get(COOKIE)).toBeUndefined();
  });

  it('게이트가 닫히면 NODE_ENV=development여도 404다 — 게이트는 하나다', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    isPersonaSwitchEnabled.mockReturnValue(false);
    const res = await POST(req({ persona: 'gs_leader' }));
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });
});
