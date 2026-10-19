// 콘솔 라우트의 게이트 차단 (FR-027 US2, contracts/dev-console-api.md C1).
//
// quickstart.md §1을 자동화한다 — 키를 비운 상태에서 /api/dev/* 가 404임을 라우트 호출로
// 확인한다. 쿠키를 읽는 모듈이 섞여 있으므로 next/headers를 모킹한다.
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

function req(url: string, body?: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  jar.clear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('TC-DEV-03 게이트가 닫히면 콘솔 라우트가 404다', () => {
  beforeEach(() => {
    vi.stubEnv('DEV_CONSOLE_PASSWORD', '');
  });

  it('POST·DELETE /api/dev/console → 404 NOT_FOUND', async () => {
    const route = await import('@/app/api/dev/console/route');
    const post = await route.POST(req('/api/dev/console', { password: 'x' }));
    expect(post.status).toBe(404);
    expect(await post.json()).toEqual({ error: 'NOT_FOUND' });

    const del = await route.DELETE();
    expect(del.status).toBe(404);
  });

  it('POST·DELETE /api/dev/clock → 404 NOT_FOUND', async () => {
    const route = await import('@/app/api/dev/clock/route');
    const post = await route.POST(req('/api/dev/clock', { at: '2026-11-15T00:05:00+09:00' }));
    expect(post.status).toBe(404);
    expect(await post.json()).toEqual({ error: 'NOT_FOUND' });

    const del = await route.DELETE();
    expect(del.status).toBe(404);
  });

  it('위조된 오프셋 쿠키를 심어도 유효 시각이 변하지 않는다', async () => {
    jar.set('modoo42_dev_clock', '86400000');
    const { serverNow, serverOffsetMs } = await import('@/lib/clock');
    expect(serverOffsetMs()).toBe(0);
    expect(Math.abs(serverNow().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it('요청 핸들이 public이고 구독 스키마도 public이다', async () => {
    jar.set('modoo42_dev_console', 'anything');
    const { requestSchemaName } = await import('@/lib/dev/sandbox');
    expect(requestSchemaName()).toBe('public');
  });
});

describe('TC-DEV-10 게이트는 열렸지만 콘솔 세션이 없으면 시계를 못 바꾼다', () => {
  beforeEach(() => {
    vi.stubEnv('DEV_CONSOLE_PASSWORD', 'test-console-password');
  });

  it('POST /api/dev/clock → 403 FORBIDDEN', async () => {
    const route = await import('@/app/api/dev/clock/route');
    const res = await route.POST(req('/api/dev/clock', { at: '2026-11-15T00:05:00+09:00' }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'FORBIDDEN' });
  });

  it('DELETE /api/dev/clock → 403 FORBIDDEN', async () => {
    const route = await import('@/app/api/dev/clock/route');
    const res = await route.DELETE();
    expect(res.status).toBe(403);
  });

  it('비밀번호가 틀리면 POST /api/dev/console → 401 UNAUTHORIZED', async () => {
    const route = await import('@/app/api/dev/console/route');
    const res = await route.POST(req('/api/dev/console', { password: 'wrong' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('콘솔 세션 쿠키가 없으면 요청 핸들이 public이다', async () => {
    const { requestSchemaName } = await import('@/lib/dev/sandbox');
    expect(requestSchemaName()).toBe('public');
  });

  it('유효한 콘솔 세션 쿠키가 있으면 요청 핸들이 dev_sandbox다', async () => {
    const { createConsoleToken } = await import('@/lib/dev/console-session');
    jar.set('modoo42_dev_console', createConsoleToken(new Date(), 'test-console-password'));
    const { requestSchemaName, DEV_SANDBOX_SCHEMA } = await import('@/lib/dev/sandbox');
    expect(requestSchemaName()).toBe(DEV_SANDBOX_SCHEMA);
  });
});

describe('TC-DEV-11 requestDatabase()가 콘솔 세션에 따라 다른 핸들을 준다', () => {
  beforeEach(() => {
    vi.stubEnv('DEV_CONSOLE_PASSWORD', 'test-console-password');
  });

  it('콘솔 세션이 없으면 public 핸들, 있으면 샌드박스 핸들이다 — 같은 조회가 다른 행 집합을 준다', async () => {
    const { createConsoleToken } = await import('@/lib/dev/console-session');
    const { requestDatabase } = await import('@/lib/dev/sandbox');
    const { sql } = await import('drizzle-orm');

    const publicDb = requestDatabase();

    jar.set('modoo42_dev_console', createConsoleToken(new Date(), 'test-console-password'));
    const sandboxDb = requestDatabase();
    expect(sandboxDb).not.toBe(publicDb);

    // 수식 없는 조회가 각자의 스키마로 간다 (search_path에 public을 넣지 않았기 때문이다).
    const where = (await sandboxDb.execute(sql`select current_schemas(false) as s`)) as unknown as {
      s: string[];
    }[];
    expect(where[0].s).toContain('dev_sandbox');
    expect(where[0].s).not.toContain('public');

    // 같은 모듈에서 두 번 불러도 샌드박스 인스턴스는 1개다 (연결 풀 중복 방지, S7).
    expect(requestDatabase()).toBe(sandboxDb);
  });
});

describe('TC-DEV-08 프리셋은 유효 시각을 기준으로 나아간다', () => {
  beforeEach(() => {
    vi.stubEnv('DEV_CONSOLE_PASSWORD', 'test-console-password');
  });

  it('이미 옮긴 시계 위에서 "다음 KST 자정"이 과거로 되돌아가지 않는다', async () => {
    const { createConsoleToken } = await import('@/lib/dev/console-session');
    jar.set('modoo42_dev_console', createConsoleToken(new Date(), 'test-console-password'));

    // 30일 앞으로 옮겨 둔 상태에서 프리셋을 누른다.
    const shift = 30 * 24 * 60 * 60 * 1000;
    jar.set('modoo42_dev_clock', String(shift));

    const route = await import('@/app/api/dev/clock/route');
    const res = await route.POST(req('/api/dev/clock', { preset: 'next_kst_midnight' }));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { offsetMs: number; effectiveAt: string };
    const effective = new Date(body.effectiveAt).getTime();
    const shiftedNow = Date.now() + shift;

    // 기준이 실제 시각이면 effectiveAt이 shiftedNow보다 29일 과거가 된다.
    expect(effective).toBeGreaterThan(shiftedNow);
    expect(effective - shiftedNow).toBeLessThan(25 * 60 * 60 * 1000);
    // 오프셋 환산 기준은 실제 시각이므로 누적되지 않는다.
    expect(Math.abs(body.offsetMs - (effective - Date.now()))).toBeLessThan(5_000);
  });
});
