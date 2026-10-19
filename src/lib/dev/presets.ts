// 시나리오 프리셋 (FR-027, data-model.md §4가 산출식의 SSOT).
//
// 순수 함수다 — 쿠키·DB·환경변수를 보지 않는다. 반환은 **절대 시각**이고 오프셋 환산은
// 라우트가 한다. KST 경계 계산은 end-date.ts의 기존 함수를 재사용하고 새 날짜 유틸을
// 만들지 않는다 (research.md R12).
import { kstDayRange, toKstWall } from '@/lib/end-date';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const SCENARIO_PRESETS = [
  'recruit_open',
  'recruit_closed',
  'verdict_open',
  'grace_expired',
  'party_ended',
  'live_before_expiry',
  'live_after_expiry',
  'next_kst_midnight',
] as const;

export type ScenarioPreset = (typeof SCENARIO_PRESETS)[number];

/** ctx.post가 **필수**인 프리셋. 패널의 시나리오 섹션에서는 비활성이고 글 기준 점프에서만 활성이다. */
export const POST_REQUIRED_PRESETS: readonly ScenarioPreset[] = [
  'party_ended',
  'live_before_expiry',
  'live_after_expiry',
];

export type PresetContext = {
  now: Date;
  post?: { endDate: Date | null; expiresAt: Date | null };
};

/** 패널 버튼 라벨. 화면 카피는 한국어로 쓴다 (CLAUDE.md §11). */
export const PRESET_LABELS: Record<ScenarioPreset, string> = {
  recruit_open: '모집창 시작 (15일)',
  recruit_closed: '모집창 밖 (3일)',
  verdict_open: '판정창 열림',
  grace_expired: 'Grace 만료',
  party_ended: '파티 종료 직후',
  live_before_expiry: 'LIVE 만료 직전',
  live_after_expiry: 'LIVE 만료 직후',
  next_kst_midnight: '다음 KST 자정',
};

/** KST 달력값(연·월·일·시·분)을 실제 UTC 시각으로 되돌린다. */
function fromKstWall(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0) - KST_OFFSET_MS);
}

/** 기준 달. post.endDate가 있으면 그 달, 없으면 now의 달이다. */
function anchorMonth(ctx: PresetContext): { year: number; month: number } {
  const anchor = ctx.post?.endDate ?? ctx.now;
  const wall = toKstWall(anchor);
  return { year: wall.getUTCFullYear(), month: wall.getUTCMonth() };
}

export class PresetContextError extends Error {}

/**
 * 프리셋이 가리키는 절대 시각.
 * ctx.post가 필수인 프리셋에 글이 없으면 PresetContextError를 던진다 — 라우트가 400으로 바꾼다.
 */
export function presetTime(preset: ScenarioPreset, ctx: PresetContext): Date {
  switch (preset) {
    case 'recruit_open': {
      // 당월 15일 00:05 KST.
      const wall = toKstWall(ctx.now);
      return fromKstWall(wall.getUTCFullYear(), wall.getUTCMonth(), 15, 0, 5);
    }
    case 'recruit_closed': {
      // 당월 3일 00:05 KST.
      const wall = toKstWall(ctx.now);
      return fromKstWall(wall.getUTCFullYear(), wall.getUTCMonth(), 3, 0, 5);
    }
    case 'verdict_open': {
      // end_date 월의 15일 00:05 KST — 판정 창(그 달 15일 00:00 KST)이 열린 직후다.
      const { year, month } = anchorMonth(ctx);
      return fromKstWall(year, month, 15, 0, 5);
    }
    case 'grace_expired': {
      // end_date 월 기준 익월 11일 00:01 KST — 판정 창(익월 10일 23:59:59.999)이 닫힌 직후다.
      const { year, month } = anchorMonth(ctx);
      return fromKstWall(year, month + 1, 11, 0, 1);
    }
    case 'party_ended': {
      const endDate = ctx.post?.endDate;
      if (!endDate) throw new PresetContextError('마감일이 있는 글이 필요합니다.');
      return new Date(endDate.getTime() + MINUTE_MS);
    }
    case 'live_before_expiry': {
      const expiresAt = ctx.post?.expiresAt;
      if (!expiresAt) throw new PresetContextError('만료 시각이 있는 LIVE 핑이 필요합니다.');
      return new Date(expiresAt.getTime() - MINUTE_MS);
    }
    case 'live_after_expiry': {
      const expiresAt = ctx.post?.expiresAt;
      if (!expiresAt) throw new PresetContextError('만료 시각이 있는 LIVE 핑이 필요합니다.');
      return new Date(expiresAt.getTime() + MINUTE_MS);
    }
    case 'next_kst_midnight': {
      // 다음 KST 자정 + 1분. LIVE 핑 1일 1회 리셋을 넘긴다 (FR-011).
      return new Date(kstDayRange(ctx.now).end.getTime() + MINUTE_MS);
    }
  }
}
