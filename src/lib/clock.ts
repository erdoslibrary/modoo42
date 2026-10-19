// 서버 시각 단일 소스 (FR-027). RSC·Route Handler는 new Date()를 직접 호출하지 않고
// serverNow()를 쓰며, 도메인 함수에는 그 값을 인자로 주입한다 (CLAUDE.md §7.2).
//
// 이 파일은 dev/ 밖에 둔다 — 상용에서도 serverNow()가 호출되는 정상 경로이기 때문이다
// (plan.md Structure Decision).
import { cookies } from 'next/headers';
import {
  CLOCK_COOKIE_NAME,
  hasValidConsoleSession,
  isDevConsoleEnabled,
} from '@/lib/dev/console-session';

/** 오프셋 쿠키 값 형식. 벗어나면 0으로 본다 — 쿠키 하나 때문에 화면을 죽이지 않는다 (R5). */
const OFFSET_PATTERN = /^-?\d{1,15}$/;

/**
 * 실제 시각. 개발 시계와 무관하게 흐른다.
 * 세션 만료 검증이 이 값을 쓴다 — 미래로 점프해도 로그아웃되지 않아야 한다 (FR-006).
 */
export function realNow(): Date {
  return new Date();
}

/**
 * 개발 시계 오프셋(ms). 반영 조건은 **게이트가 열렸고 그리고 콘솔 세션이 유효할 때**다.
 * 하나라도 거짓이면 modoo42_dev_clock을 **읽지 않고** 0을 반환한다 (FR-009).
 */
export function serverOffsetMs(): number {
  if (!isDevConsoleEnabled()) return 0;
  if (!hasValidConsoleSession()) return 0;

  const raw = cookies().get(CLOCK_COOKIE_NAME)?.value;
  if (!raw || !OFFSET_PATTERN.test(raw)) return 0;

  const offset = Number(raw);
  return Number.isSafeInteger(offset) ? offset : 0;
}

/** 유효 시각 = 실제 시각 + 오프셋. 서버의 모든 시각 판단이 이 값을 쓴다. */
export function serverNow(): Date {
  return new Date(realNow().getTime() + serverOffsetMs());
}

/** 목표 절대 시각을 오프셋으로 환산한다. 순수 함수 — 쿠키·환경변수를 보지 않는다. */
export function offsetForTarget(target: Date, from: Date): number {
  return target.getTime() - from.getTime();
}
