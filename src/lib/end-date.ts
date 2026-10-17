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
