// OAuth 세션 쿠키 서명·검증 (trd.md §2.2-5). 추가 환경변수 없이 GITHUB_CLIENT_SECRET에서
// 파생한 키로 HMAC-SHA256 서명한다. 토큰 형식은 `userId.exp.sig`다.
import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE_NAME = 'modoo42_session';
export const OAUTH_STATE_COOKIE_NAME = 'modoo42_oauth_state';

/** 30일 (초). trd.md §2.2-5. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
/** state 쿠키는 1회용 단기 쿠키다 (초). */
export const OAUTH_STATE_MAX_AGE = 600;

function signingKey(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error('GITHUB_CLIENT_SECRET 미설정 — 세션 쿠키를 서명할 수 없습니다.');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

/** 길이가 달라도 예외를 던지지 않는 상수 시간 비교. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createSessionToken(userId: string, now: Date = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + SESSION_MAX_AGE;
  const payload = `${userId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** 서명과 만료가 모두 유효할 때만 userId를 돌려준다. 그 외에는 null이다. */
export function verifySessionToken(token: string, now: Date = new Date()): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  if (!userId || !expRaw || !sig) return null;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp)) return null;
  if (exp * 1000 <= now.getTime()) return null;

  if (!safeEqual(sig, sign(`${userId}.${expRaw}`))) return null;
  return userId;
}

/** 쿠키 공통 옵션. Secure는 프로덕션에서만 붙인다 (로컬 http 개발 때문). */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
