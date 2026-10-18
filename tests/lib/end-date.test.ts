import { describe, it, expect } from 'vitest';
import { computeVerdictWindow, kstDayRange } from '@/lib/end-date';

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

describe('kstDayRange — LIVE 핑 1일 1회 날짜 경계 (FR-011, research R2)', () => {
  it('KST 23:59:59.999는 그날 몫', () => {
    const r = kstDayRange(kst('2026-10-18T23:59:59.999'));
    expect(r.start.toISOString()).toBe(kst('2026-10-18T00:00:00.000').toISOString());
    expect(r.end.toISOString()).toBe(kst('2026-10-19T00:00:00.000').toISOString());
  });

  it('KST 00:00:00.000은 다음날 몫 (경계는 start 포함, end 배타)', () => {
    const r = kstDayRange(kst('2026-10-19T00:00:00.000'));
    expect(r.start.toISOString()).toBe(kst('2026-10-19T00:00:00.000').toISOString());
    expect(r.end.toISOString()).toBe(kst('2026-10-20T00:00:00.000').toISOString());
  });

  it('UTC 날짜와 KST 날짜가 다른 시각도 KST 기준으로 묶는다', () => {
    // 2026-10-18T14:59:59.999Z = 2026-10-18 23:59:59.999 KST.
    const r = kstDayRange(new Date('2026-10-18T14:59:59.999Z'));
    expect(r.start.toISOString()).toBe('2026-10-17T15:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-10-18T15:00:00.000Z');
  });

  it('연말 경계: KST 2027-01-01 00:30', () => {
    const r = kstDayRange(new Date('2026-12-31T15:30:00.000Z'));
    expect(r.start.toISOString()).toBe('2026-12-31T15:00:00.000Z');
    expect(r.end.toISOString()).toBe('2027-01-01T15:00:00.000Z');
  });

  it('구간 길이는 정확히 24시간', () => {
    const r = kstDayRange(kst('2026-10-18T12:34:56.789'));
    expect(r.end.getTime() - r.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
