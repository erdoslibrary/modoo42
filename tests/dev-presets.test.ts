// 시나리오 프리셋 산출 (FR-027, requirement.md §3 Test Suite 10).
// presetTime은 순수 함수라 DB 없이 돈다 (contracts/dev-console-api.md C7).
import { describe, it, expect } from 'vitest';
import { computeVerdictWindow, kstDayRange } from '@/lib/end-date';
import {
  POST_REQUIRED_PRESETS,
  PresetContextError,
  SCENARIO_PRESETS,
  presetTime,
} from '@/lib/dev/presets';

/** 실제 시각을 KST 벽시계 문자열로 (단정 가독성용). */
function kst(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().replace('Z', '+09:00');
}

// 2026-10-19 12:00 KST.
const NOW = new Date('2026-10-19T03:00:00.000Z');
// 2026-11-30 23:59:59.999 KST — 11월 말일에 끝나는 정규 스터디.
const END_DATE = new Date('2026-11-30T14:59:59.999Z');
const EXPIRES_AT = new Date('2026-10-19T04:00:00.000Z');

describe('TC-DEV-01 프리셋 8종의 KST 경계 산출', () => {
  it('모집창 시작: 당월 15일 00:05 KST', () => {
    expect(kst(presetTime('recruit_open', { now: NOW }))).toBe('2026-10-15T00:05:00.000+09:00');
  });

  it('모집창 밖: 당월 3일 00:05 KST', () => {
    expect(kst(presetTime('recruit_closed', { now: NOW }))).toBe('2026-10-03T00:05:00.000+09:00');
  });

  it('판정창 열림: end_date 월의 15일 00:05 KST — 실제로 판정 창 안이다', () => {
    const at = presetTime('verdict_open', {
      now: NOW,
      post: { endDate: END_DATE, expiresAt: null },
    });
    expect(kst(at)).toBe('2026-11-15T00:05:00.000+09:00');

    const { opensAt, closesAt } = computeVerdictWindow(END_DATE);
    expect(at.getTime()).toBeGreaterThan(opensAt.getTime());
    expect(at.getTime()).toBeLessThan(closesAt.getTime());
  });

  it('Grace 만료: end_date 월 기준 익월 11일 00:01 KST — 판정 창이 닫힌 직후다', () => {
    const at = presetTime('grace_expired', {
      now: NOW,
      post: { endDate: END_DATE, expiresAt: null },
    });
    expect(kst(at)).toBe('2026-12-11T00:01:00.000+09:00');
    expect(at.getTime()).toBeGreaterThan(computeVerdictWindow(END_DATE).closesAt.getTime());
  });

  it('글이 없으면 verdict_open·grace_expired는 당월 기준이다', () => {
    expect(kst(presetTime('verdict_open', { now: NOW }))).toBe('2026-10-15T00:05:00.000+09:00');
    expect(kst(presetTime('grace_expired', { now: NOW }))).toBe('2026-11-11T00:01:00.000+09:00');
  });

  it('파티 종료 직후: end_date + 1분', () => {
    const at = presetTime('party_ended', {
      now: NOW,
      post: { endDate: END_DATE, expiresAt: null },
    });
    expect(at.getTime()).toBe(END_DATE.getTime() + 60_000);
  });

  it('LIVE 만료 직전/직후: expires_at ∓ 1분', () => {
    const ctx = { now: NOW, post: { endDate: null, expiresAt: EXPIRES_AT } };
    expect(presetTime('live_before_expiry', ctx).getTime()).toBe(EXPIRES_AT.getTime() - 60_000);
    expect(presetTime('live_after_expiry', ctx).getTime()).toBe(EXPIRES_AT.getTime() + 60_000);
  });

  it('다음 KST 자정: 다음 날 00:01 KST — LIVE 1일 1회가 리셋된다', () => {
    const at = presetTime('next_kst_midnight', { now: NOW });
    expect(kst(at)).toBe('2026-10-20T00:01:00.000+09:00');
    // 이동 후의 KST 날짜 구간이 NOW의 구간과 다르다.
    expect(kstDayRange(at).start.getTime()).not.toBe(kstDayRange(NOW).start.getTime());
  });

  it('연말 경계에서도 달이 롤오버된다', () => {
    const december = new Date('2026-12-31T14:00:00.000Z'); // 2026-12-31 23:00 KST
    expect(kst(presetTime('grace_expired', { now: december }))).toBe(
      '2027-01-11T00:01:00.000+09:00',
    );
  });

  it('글이 필수인 3종에 글이 없으면 PresetContextError를 던진다', () => {
    for (const preset of POST_REQUIRED_PRESETS) {
      expect(() => presetTime(preset, { now: NOW })).toThrow(PresetContextError);
    }
  });

  it('프리셋 키는 8종이고 글이 필수인 것은 3종이다', () => {
    expect(SCENARIO_PRESETS).toHaveLength(8);
    expect(POST_REQUIRED_PRESETS).toHaveLength(3);
  });
});
