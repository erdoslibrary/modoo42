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
    const token = createSessionToken(USER_ID);
    expect(verifySessionToken(token)).toBe(USER_ID);
  });

  it('서명이 위조된 토큰은 거부한다', () => {
    const token = createSessionToken(USER_ID);
    const forged = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(verifySessionToken(forged)).toBeNull();
  });

  it('payload를 바꾸면 서명이 깨져 거부한다', () => {
    const [, exp, sig] = createSessionToken(USER_ID).split('.');
    const other = '00000000-0000-4000-8000-000000000002';
    expect(verifySessionToken(`${other}.${exp}.${sig}`)).toBeNull();
  });

  it('만료된 토큰은 거부한다', () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const token = createSessionToken(USER_ID, issuedAt);
    const afterExpiry = new Date(issuedAt.getTime() + (SESSION_MAX_AGE + 1) * 1000);
    expect(verifySessionToken(token, afterExpiry)).toBeNull();
    expect(verifySessionToken(token, new Date(issuedAt.getTime() + 1000))).toBe(USER_ID);
  });

  it('형식이 어긋난 토큰은 예외 없이 null이다', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', `${USER_ID}.notanumber.sig`]) {
      expect(verifySessionToken(bad)).toBeNull();
    }
  });

  it('safeEqual은 길이가 달라도 예외를 던지지 않는다', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
});
