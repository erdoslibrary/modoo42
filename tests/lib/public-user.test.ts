// 캠퍼스 → 장소 분류 파생 (FR-006). data-model.md §3 표가 기준이다.
import { describe, it, expect } from 'vitest';
import { campusToLocationType } from '@/lib/public-user';

describe('campusToLocationType (FR-006)', () => {
  it('GS → OFFLINE_GS', () => {
    expect(campusToLocationType('GS')).toBe('OFFLINE_GS');
  });

  it('SEOUL → OFFLINE_SEOUL', () => {
    expect(campusToLocationType('SEOUL')).toBe('OFFLINE_SEOUL');
  });

  it('캠퍼스 미인증(null) → OFFLINE_ETC', () => {
    expect(campusToLocationType(null)).toBe('OFFLINE_ETC');
  });
});
