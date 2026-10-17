import { describe, it, expect } from 'vitest';
import { computeVerdictWindow } from '@/lib/end-date';

// KST 벽시계 문자열 → 실제 시각.
const kst = (iso: string) => new Date(`${iso}+09:00`);

describe('computeVerdictWindow — 판정 창 (FR-008, research R2)', () => {
  it('10월 사이클: 10/15 00:00 KST ~ 11/10 23:59:59.999 KST', () => {
    const w = computeVerdictWindow(kst('2026-10-31T23:59:59.999'));
    expect(w.opensAt.toISOString()).toBe(kst('2026-10-15T00:00:00.000').toISOString());
    expect(w.closesAt.toISOString()).toBe(kst('2026-11-10T23:59:59.999').toISOString());
  });

  it('12월 사이클: 익년 1/10 연도 경계', () => {
    const w = computeVerdictWindow(kst('2026-12-31T23:59:59.999'));
    expect(w.opensAt.toISOString()).toBe(kst('2026-12-15T00:00:00.000').toISOString());
    expect(w.closesAt.toISOString()).toBe(kst('2027-01-10T23:59:59.999').toISOString());
  });

  it('end_date가 UTC로는 전날이어도 KST 달 기준으로 계산', () => {
    // 2026-11-01 00:30 KST = 2026-10-31 15:30 UTC → KST 기준 11월 사이클.
    const w = computeVerdictWindow(kst('2026-11-01T00:30:00.000'));
    expect(w.opensAt.toISOString()).toBe(kst('2026-11-15T00:00:00.000').toISOString());
  });
});
