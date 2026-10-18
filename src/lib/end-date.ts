// 정규 스터디 end_date 자동 산출 (CLAUDE.md §7.2). 리더가 직접 지정하지 않는다.
// 규칙: 개설일(KST)이 1~14일이면 당월 말일, 15일~말일이면 익월 말일.
// 반환은 해당 말일 23:59:59.999 (KST 기준)의 UTC 시각.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function computeStudyEndDate(openedAt: Date): Date {
  // openedAt을 KST 벽시계로 환산해 달력상의 연/월/일을 얻는다.
  const kstWall = new Date(openedAt.getTime() + KST_OFFSET_MS);
  const year = kstWall.getUTCFullYear();
  const month = kstWall.getUTCMonth(); // 0-based
  const day = kstWall.getUTCDate();

  // 1~14 → 당월, 15~말일 → 익월. (targetMonth가 12여도 Date.UTC가 연도 롤오버 처리)
  const targetMonth = day <= 14 ? month : month + 1;

  // (targetMonth+1)월 1일 00:00 KST - 1ms = targetMonth 말일 23:59:59.999 KST.
  const nextMonthStartKstWallMs = Date.UTC(year, targetMonth + 1, 1, 0, 0, 0, 0);
  const endKstWallMs = nextMonthStartKstWallMs - 1;

  // KST 벽시계 ms → 실제 UTC 시각.
  return new Date(endKstWallMs - KST_OFFSET_MS);
}

// 실제 시각 → KST 벽시계. 반환된 Date의 getUTC* 계열이 KST 달력값을 준다.
// 표시용(CLI 출력 등)과 날짜 경계 계산에 쓴다.
export function toKstWall(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

// LIVE 핑 1일 1회 제한의 날짜 구간 (FR-011). now가 속한 KST 날짜의 00:00:00.000부터
// 다음날 00:00:00.000까지. start는 포함, end는 배타다.
export function kstDayRange(now: Date): { start: Date; end: Date } {
  const kstWall = new Date(now.getTime() + KST_OFFSET_MS);
  const startKstWallMs = Date.UTC(
    kstWall.getUTCFullYear(),
    kstWall.getUTCMonth(),
    kstWall.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  const start = new Date(startKstWallMs - KST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

// 완주 판정 창 (FR-008, Grace Period FR-018). end_date가 속한 KST 달을 M이라 하면
// M월 15일 00:00 KST에 열리고 (M+1)월 10일 23:59:59.999 KST에 닫힌다.
// 회고(Post-mortem)는 opensAt 이후 종료 기한 없이 허용한다.
export function computeVerdictWindow(endDate: Date): { opensAt: Date; closesAt: Date } {
  const kstWall = new Date(endDate.getTime() + KST_OFFSET_MS);
  const year = kstWall.getUTCFullYear();
  const month = kstWall.getUTCMonth(); // 0-based

  const opensAtKstWallMs = Date.UTC(year, month, 15, 0, 0, 0, 0);
  // (M+1)월 11일 00:00 KST - 1ms. month+1이 12여도 Date.UTC가 연도 롤오버 처리.
  const closesAtKstWallMs = Date.UTC(year, month + 1, 11, 0, 0, 0, 0) - 1;

  return {
    opensAt: new Date(opensAtKstWallMs - KST_OFFSET_MS),
    closesAt: new Date(closesAtKstWallMs - KST_OFFSET_MS),
  };
}
