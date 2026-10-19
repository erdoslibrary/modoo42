// 개발자 콘솔 시계 (FR-027, requirement.md §3 Test Suite 10).
// 쿠키를 읽는 모듈이므로 next/headers를 모킹하고, 게이트 분기는 stubEnv + resetModules로
// 모듈을 다시 읽어 확인한다 (contracts/dev-console-api.md C7).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConsoleToken } from '@/lib/dev/console-session';

const PASSWORD = 'test-console-password';

/** next/headers의 cookies()를 흉내내는 쿠키 저장소. 테스트마다 비운다. */
const jar = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  }),
}));

/** 게이트와 쿠키를 세운 뒤 clock 모듈을 새로 읽는다. */
async function loadClock(opts: { password: string; offset?: string; console?: boolean }) {
  jar.clear();
  vi.resetModules();
  vi.stubEnv('DEV_CONSOLE_PASSWORD', opts.password);
  if (opts.offset !== undefined) jar.set('modoo42_dev_clock', opts.offset);
  if (opts.console) jar.set('modoo42_dev_console', createConsoleToken(new Date(), opts.password));
  return import('@/lib/clock');
}

beforeEach(() => {
  jar.clear();
  vi.stubEnv('DEV_CONSOLE_PASSWORD', PASSWORD);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('TC-DEV-02 절대 시각 → offsetMs → 유효 시각 왕복', () => {
  it('미래 오프셋이 유효 시각에 그대로 반영된다', async () => {
    const { offsetForTarget } = await import('@/lib/clock');
    const realNow = new Date('2026-10-19T12:00:00.000Z');
    const target = new Date('2026-11-15T00:05:00+09:00');

    const offsetMs = offsetForTarget(target, realNow);
    expect(offsetMs).toBe(target.getTime() - realNow.getTime());
    expect(new Date(realNow.getTime() + offsetMs).toISOString()).toBe(target.toISOString());
  });

  it('과거로 되돌리는 음수 오프셋도 왕복한다', async () => {
    const { offsetForTarget } = await import('@/lib/clock');
    const realNow = new Date('2026-10-19T12:00:00.000Z');
    const target = new Date('2026-08-03T00:05:00+09:00');

    const offsetMs = offsetForTarget(target, realNow);
    expect(offsetMs).toBeLessThan(0);
    expect(new Date(realNow.getTime() + offsetMs).toISOString()).toBe(target.toISOString());
  });

  it('콘솔 세션이 있으면 serverNow()가 오프셋을 반영한다', async () => {
    const clock = await loadClock({ password: PASSWORD, offset: '86400000', console: true });
    expect(clock.serverOffsetMs()).toBe(86_400_000);
    const drift = clock.serverNow().getTime() - clock.realNow().getTime();
    expect(Math.abs(drift - 86_400_000)).toBeLessThan(1_000);
  });

  it('복귀(쿠키 삭제) 후 serverNow()가 실제 시각과 1초 이내로 같아진다', async () => {
    const clock = await loadClock({ password: PASSWORD, console: true });
    expect(clock.serverOffsetMs()).toBe(0);
    expect(Math.abs(clock.serverNow().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it('손상된 오프셋 쿠키는 0으로 본다 — 요청을 실패시키지 않는다', async () => {
    for (const bad of ['abc', '', '12.5', '1e5', '1'.repeat(16)]) {
      const clock = await loadClock({ password: PASSWORD, offset: bad, console: true });
      expect(clock.serverOffsetMs()).toBe(0);
    }
  });
});

describe('TC-DEV-03 DEV_CONSOLE_PASSWORD 미설정 시 modoo42_dev_clock 무시', () => {
  it('게이트가 닫히면 오프셋 쿠키가 있어도 실제 시각을 반환한다', async () => {
    const clock = await loadClock({ password: '', offset: '86400000' });
    expect(clock.serverOffsetMs()).toBe(0);
    expect(Math.abs(clock.serverNow().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it('게이트가 닫히면 isDevConsoleEnabled()가 거짓이다', async () => {
    vi.resetModules();
    vi.stubEnv('DEV_CONSOLE_PASSWORD', '');
    const { isDevConsoleEnabled } = await import('@/lib/dev/console-session');
    expect(isDevConsoleEnabled()).toBe(false);
  });
});

describe('TC-DEV-10 콘솔 세션 없이 오프셋 쿠키만 심으면 시각이 변하지 않는다', () => {
  it('게이트는 열렸지만 콘솔 세션 쿠키가 없으면 오프셋을 반영하지 않는다', async () => {
    const clock = await loadClock({ password: PASSWORD, offset: '86400000' });
    expect(clock.serverOffsetMs()).toBe(0);
    expect(Math.abs(clock.serverNow().getTime() - Date.now())).toBeLessThan(1_000);
  });

  it('서명이 깨진 콘솔 세션 쿠키도 오프셋을 반영하지 않는다', async () => {
    jar.clear();
    vi.resetModules();
    vi.stubEnv('DEV_CONSOLE_PASSWORD', PASSWORD);
    jar.set('modoo42_dev_clock', '86400000');
    jar.set('modoo42_dev_console', `${Date.now()}.forged-signature`);
    const clock = await import('@/lib/clock');
    expect(clock.serverOffsetMs()).toBe(0);
  });

  it('다른 비밀번호로 발급된 콘솔 세션 쿠키는 무효다', async () => {
    jar.clear();
    vi.resetModules();
    vi.stubEnv('DEV_CONSOLE_PASSWORD', PASSWORD);
    jar.set('modoo42_dev_clock', '86400000');
    jar.set('modoo42_dev_console', createConsoleToken(new Date(), 'another-password'));
    const clock = await import('@/lib/clock');
    expect(clock.serverOffsetMs()).toBe(0);
  });
});
