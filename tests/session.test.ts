// 세션 쿠키 서명·검증 (FR-015). 서명 키는 GITHUB_CLIENT_SECRET에서 파생한다.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  SESSION_MAX_AGE,
  createSessionToken,
  safeEqual,
  verifySessionToken,
} from '@/lib/session';

const USER_ID = '00000000-0000-4000-8000-000000000001';

beforeAll(() => {
  process.env.GITHUB_CLIENT_SECRET ??= 'test-secret';
});

describe('TC-AUTH-SESSION', () => {
  it('서명한 토큰을 같은 키로 검증하면 userId를 돌려준다', () => {
    const token = createSessionToken(USER_ID, new Date());
    expect(verifySessionToken(token, new Date())).toBe(USER_ID);
  });

  it('서명이 위조된 토큰은 거부한다', () => {
    const token = createSessionToken(USER_ID, new Date());
    const forged = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(verifySessionToken(forged, new Date())).toBeNull();
  });

  it('payload를 바꾸면 서명이 깨져 거부한다', () => {
    const [, exp, sig] = createSessionToken(USER_ID, new Date()).split('.');
    const other = '00000000-0000-4000-8000-000000000002';
    expect(verifySessionToken(`${other}.${exp}.${sig}`, new Date())).toBeNull();
  });

  it('만료된 토큰은 거부한다', () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const token = createSessionToken(USER_ID, issuedAt);
    const afterExpiry = new Date(issuedAt.getTime() + (SESSION_MAX_AGE + 1) * 1000);
    expect(verifySessionToken(token, afterExpiry)).toBeNull();
    expect(verifySessionToken(token, new Date(issuedAt.getTime() + 1000))).toBe(USER_ID);
  });

  it('TC-DEV-04: dev 시계를 +31일 옮겨도 realNow() 기준 검증은 유효를 유지한다', () => {
    // 세션 만료만 실제 시각을 본다 (FR-006). 미래로 점프해도 로그아웃되지 않아야 한다.
    const issuedAt = new Date('2026-10-19T00:00:00Z');
    const token = createSessionToken(USER_ID, issuedAt);

    // 개발 시계가 +31일 앞서 있는 상황. 도메인 판단은 이 값을 쓰지만 세션은 쓰지 않는다.
    const devNow = new Date(issuedAt.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(token, devNow)).toBeNull();

    // 실제 시각은 발급 직후다 — realNow()를 주입하면 유효 판정이 유지된다.
    const realNowValue = new Date(issuedAt.getTime() + 60 * 1000);
    expect(verifySessionToken(token, realNowValue)).toBe(USER_ID);
  });

  it('형식이 어긋난 토큰은 예외 없이 null이다', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', `${USER_ID}.notanumber.sig`]) {
      expect(verifySessionToken(bad, new Date())).toBeNull();
    }
  });

  it('safeEqual은 길이가 달라도 예외를 던지지 않는다', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
});
