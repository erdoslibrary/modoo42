'use client';

// 클라이언트 쪽 유효 시각 (FR-027, research.md R10).
// 서버가 offsetMs를 prop으로 내려주고, 1초 인터벌을 쓰는 컴포넌트가 useDevClock()을 쓴다.
// 게이트가 닫힌 환경에서는 서버가 쿠키를 읽지 않고 0을 넘기므로 실제 시각 그대로다.
import { createContext, useContext, type ReactNode } from 'react';

const ClockContext = createContext(0);

export function ClockProvider({ offsetMs, children }: { offsetMs: number; children: ReactNode }) {
  return <ClockContext.Provider value={offsetMs}>{children}</ClockContext.Provider>;
}

/** 유효 시각을 만드는 함수와 오프셋. Context 밖에서는 오프셋이 0이라 실제 시각이 나온다. */
export function useDevClock(): { now: () => Date; offsetMs: number } {
  const offsetMs = useContext(ClockContext);
  return { now: () => new Date(Date.now() + offsetMs), offsetMs };
}
