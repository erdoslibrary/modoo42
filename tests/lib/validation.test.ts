import { describe, it, expect } from 'vitest';
import { createPostRequestSchema } from '@/lib/validation';

const liveInput = {
  type: 'LIVE' as const,
  text: 'philosopher 데드락 30분 헬프 구합니다',
  place: '클러스터 2층',
  durationMinutes: 30,
};

const studyInput = {
  type: 'STUDY' as const,
  title: '알고리즘 정복',
  tags: ['코딩테스트'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/abc',
};

describe('createPostRequestSchema — LIVE 핑 입력 검증 (TC-LIVE-01)', () => {
  it('유효한 LIVE 입력은 통과한다', () => {
    const r = createPostRequestSchema.safeParse(liveInput);
    expect(r.success).toBe(true);
  });

  it('text 50자는 통과, 51자는 실패 (CLAUDE.md §7.1)', () => {
    expect(createPostRequestSchema.safeParse({ ...liveInput, text: 'ㄱ'.repeat(50) }).success).toBe(true);
    expect(createPostRequestSchema.safeParse({ ...liveInput, text: 'ㄱ'.repeat(51) }).success).toBe(false);
  });

  it.each([
    ['text 빈 문자열', { ...liveInput, text: '' }],
    ['place 누락', { type: 'LIVE', text: '점심 밥친구', durationMinutes: 60 }],
    ['place 빈 문자열', { ...liveInput, place: '' }],
    ['durationMinutes 45 (허용 외)', { ...liveInput, durationMinutes: 45 }],
    ['durationMinutes 문자열', { ...liveInput, durationMinutes: '30' }],
    ['durationMinutes 누락', { type: 'LIVE', text: '점심 밥친구', place: '오아시스' }],
    ['LIVE에 chatUrl 포함 (strict)', { ...liveInput, chatUrl: 'https://open.kakao.com/o/abc' }],
    ['LIVE에 maxMembers 포함 (strict)', { ...liveInput, maxMembers: 4 }],
    ['LIVE에 title 포함 (strict)', { ...liveInput, title: '제목' }],
    ['LIVE에 STUDY 필드만', { type: 'LIVE', title: '제목', tags: ['x'], locationType: 'ONLINE' }],
  ])('%s → 실패', (_label, input) => {
    expect(createPostRequestSchema.safeParse(input).success).toBe(false);
  });

  // FR-005a: OFFLINE_ETC는 LIVE 핑 서버 파생 전용 값이다. DB 열거형은 5값이지만 입력은 4값으로 둔다.
  it('개설 입력의 locationType은 4종만 허용한다 — OFFLINE_ETC는 실패', () => {
    for (const locationType of ['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID'] as const) {
      expect(createPostRequestSchema.safeParse({ ...studyInput, locationType }).success).toBe(true);
    }
    expect(createPostRequestSchema.safeParse({ ...studyInput, locationType: 'OFFLINE_ETC' }).success).toBe(false);
  });

  it.each([30, 60, 120, 180])('durationMinutes %i는 통과', (durationMinutes) => {
    expect(createPostRequestSchema.safeParse({ ...liveInput, durationMinutes }).success).toBe(true);
  });

  it('회귀: 기존 STUDY 입력은 그대로 통과한다', () => {
    const r = createPostRequestSchema.safeParse(studyInput);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe('STUDY');
  });

  it('회귀: STUDY의 title 41자는 여전히 실패한다', () => {
    expect(createPostRequestSchema.safeParse({ ...studyInput, title: 'ㄱ'.repeat(41) }).success).toBe(false);
  });
});
