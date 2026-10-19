// 개발자 콘솔 게이트와 admin 세션 쿠키 (FR-027·FR-028, trd.md §2.4).
//
// 게이트가 열리는 조건은 하나다 — DEV_CONSOLE_PASSWORD가 비어 있지 않다.
// NODE_ENV는 이 판정에 쓰지 않는다. 게이트를 둘로 두지 않는 것이 2026-10-19 결정이다
// (CLAUDE.md §6.1, contracts/dev-console-api.md C1).
//
// 서명 키는 비밀번호 자체다 (research.md R4) — 비밀번호를 바꾸면 발급된 콘솔 세션이
// 전부 무효가 되는데, 그것이 원하는 성질이다. 포맷은 session.ts와 같은 `payload.sig`다.
import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { safeEqual } from '@/lib/session';

export const CONSOLE_COOKIE_NAME = 'modoo42_dev_console';
export const CLOCK_COOKIE_NAME = 'modoo42_dev_clock';

/** 게이트. 이 함수가 거짓이면 콘솔 라우트는 404이고 쿠키를 읽지 않는다. */
export function isDevConsoleEnabled(): boolean {
  return Boolean(process.env.DEV_CONSOLE_PASSWORD);
}

/** 설정된 콘솔 비밀번호. 게이트가 닫혔으면 null이다. */
export function consolePassword(): string | null {
  return process.env.DEV_CONSOLE_PASSWORD || null;
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest('base64url');
}

/** 콘솔 세션 토큰. payload는 발급 시각(ms)이고 만료는 두지 않는다. */
export function createConsoleToken(issuedAt: Date, key: string): string {
  const payload = String(issuedAt.getTime());
  return `${payload}.${sign(payload, key)}`;
}

/** 서명이 유효할 때만 참이다. 비밀번호가 바뀌면 자동으로 거짓이 된다. */
export function verifyConsoleToken(token: string, key: string): boolean {
  const sep = token.lastIndexOf('.');
  if (sep <= 0) return false;
  const payload = token.slice(0, sep);
  const sig = token.slice(sep + 1);
  if (!/^\d{1,15}$/.test(payload) || !sig) return false;
  return safeEqual(sig, sign(payload, key));
}

/** 입력 비밀번호 검증. 길이가 달라도 비교 시간이 값에 의존하지 않는다. */
export function isConsolePassword(input: string): boolean {
  const key = consolePassword();
  if (!key) return false;
  // 길이가 다르면 safeEqual이 즉시 false이므로, 먼저 해시로 길이를 맞춘다
  // (contracts/dev-console-api.md C2-2).
  return safeEqual(sign(input, key), sign(key, key));
}

/**
 * 현재 요청에 유효한 콘솔 세션이 있는지. 게이트가 닫혔으면 쿠키를 **읽지 않는다** —
 * 상용에서 cookies()를 건드리면 모든 페이지가 동적 렌더로 바뀐다 (research.md R10).
 */
export function hasValidConsoleSession(): boolean {
  const key = consolePassword();
  if (!key) return false;

  const token = cookies().get(CONSOLE_COOKIE_NAME)?.value;
  if (!token) return false;
  return verifyConsoleToken(token, key);
}
