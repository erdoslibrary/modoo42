import { describe, it, expect } from 'vitest';
import { leaderActionStateOf, buildUpdatePatch } from '@/lib/leader-actions';

const now = new Date('2026-10-18T12:00:00+09:00');
const futureDate = new Date('2026-10-31T23:59:59+09:00');
const pastDate = new Date('2026-10-10T23:59:59+09:00');

const baseStudy = {
  type: 'STUDY' as const,
  status: 'RECRUITING' as const,
  currentMembers: 3,
  maxMembers: 6,
  endDate: futureDate,
};

describe('leaderActionStateOf — 리더 기본 액션 노출·활성 파생 (FR-004, FR-005, FR-006)', () => {
  it.each(['participant', 'visitor', 'guest'] as const)(
    '리더가 아닌 역할(%s)은 visible: false',
    (role) => {
      const state = leaderActionStateOf(baseStudy, role, now);
      expect(state.visible).toBe(false);
      expect(state.canEdit).toBe(false);
      expect(state.canToggleStatus).toBe(false);
      expect(state.canCancel).toBe(false);
    },
  );

  it('LIVE 핑은 리더여도 visible: false', () => {
    const state = leaderActionStateOf(
      { ...baseStudy, type: 'LIVE', maxMembers: null },
      'leader',
      now,
    );
    expect(state.visible).toBe(false);
  });

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    '최종 상태(%s)는 visible: false (NFR-003)',
    (status) => {
      const state = leaderActionStateOf({ ...baseStudy, status }, 'leader', now);
      expect(state.visible).toBe(false);
      expect(state.canEdit).toBe(false);
      expect(state.canToggleStatus).toBe(false);
      expect(state.canCancel).toBe(false);
    },
  );

  it('모집 중(RECRUITING) 글은 수정·마감하기·취소 모두 활성화', () => {
    const state = leaderActionStateOf(baseStudy, 'leader', now);
    expect(state).toEqual({
      visible: true,
      canEdit: true,
      canToggleStatus: true,
      nextToggleStatus: 'CLOSED',
      toggleLabel: '마감하기',
      canCancel: true,
    });
  });

  it('마감(CLOSED) 상태에서 정원 여유가 있으면 수정은 비활성화되고 재모집하기·취소는 활성화', () => {
    const state = leaderActionStateOf(
      { ...baseStudy, status: 'CLOSED', currentMembers: 4, maxMembers: 6 },
      'leader',
      now,
    );
    expect(state).toEqual({
      visible: true,
      canEdit: false,
      canToggleStatus: true,
      nextToggleStatus: 'RECRUITING',
      toggleLabel: '재모집하기',
      canCancel: true,
    });
  });

  it('마감(CLOSED) 상태에서 정원이 가득 찬 경우(currentMembers >= maxMembers) 재모집 토글 비활성화', () => {
    const state = leaderActionStateOf(
      { ...baseStudy, status: 'CLOSED', currentMembers: 6, maxMembers: 6 },
      'leader',
      now,
    );
    expect(state.visible).toBe(true);
    expect(state.canEdit).toBe(false);
    expect(state.canToggleStatus).toBe(false);
    expect(state.nextToggleStatus).toBe('RECRUITING');
    expect(state.canCancel).toBe(true);
  });

  it('마감일이 지난 단기 파티(PARTY)는 수정·상태 토글이 모두 비활성화되고 취소만 가능 (FR-020)', () => {
    const expiredParty = {
      type: 'PARTY' as const,
      status: 'RECRUITING' as const,
      currentMembers: 2,
      maxMembers: 5,
      endDate: pastDate,
    };
    const state = leaderActionStateOf(expiredParty, 'leader', now);
    expect(state.visible).toBe(true);
    expect(state.canEdit).toBe(false);
    expect(state.canToggleStatus).toBe(false);
    expect(state.canCancel).toBe(true);
  });
});

describe('buildUpdatePatch — 게시글 수정 패치 직렬화 및 검증 (FR-006, NFR-002)', () => {
  const validInput = {
    title: '  수정된 스터디 제목  ',
    description: '  수정된 설명입니다.  ',
    place: '  클러스터 3층  ',
    chatUrl: '  https://open.kakao.com/o/updated  ',
  };

  it('유효한 입력은 앞뒤 공백을 제거해 패치 객체로 직렬화한다', () => {
    const res = buildUpdatePatch(validInput, 'ONLINE');
    expect(res).toEqual({
      ok: true,
      patch: {
        title: '수정된 스터디 제목',
        description: '수정된 설명입니다.',
        place: '클러스터 3층',
        chatUrl: 'https://open.kakao.com/o/updated',
      },
    });
  });

  it('설명과 장소를 빈 문자열로 제출하면 null로 직렬화해 기존 값을 지울 수 있다', () => {
    const res = buildUpdatePatch(
      { ...validInput, description: '   ', place: '' },
      'ONLINE',
    );
    expect(res).toEqual({
      ok: true,
      patch: {
        title: '수정된 스터디 제목',
        description: null,
        place: null,
        chatUrl: 'https://open.kakao.com/o/updated',
      },
    });
  });

  it('제목이 비어 있거나 40자를 넘으면 거절한다', () => {
    expect(buildUpdatePatch({ ...validInput, title: '   ' }, 'ONLINE').ok).toBe(false);
    expect(buildUpdatePatch({ ...validInput, title: '가'.repeat(41) }, 'ONLINE').ok).toBe(false);
  });

  it('설명이 300자를 넘으면 거절한다', () => {
    expect(
      buildUpdatePatch({ ...validInput, description: '가'.repeat(301) }, 'ONLINE').ok,
    ).toBe(false);
  });

  it.each(['ONLINE', 'HYBRID'] as const)(
    '%s 모집에서 chatUrl을 비우면 거절한다',
    (locationType) => {
      const res = buildUpdatePatch({ ...validInput, chatUrl: '   ' }, locationType);
      expect(res.ok).toBe(false);
    },
  );

  it.each(['OFFLINE_GS', 'OFFLINE_SEOUL'] as const)(
    '오프라인 전용(%s) 모집에서 chatUrl이 비어 있으면 키를 생략하고 통과한다',
    (locationType) => {
      const res = buildUpdatePatch({ ...validInput, chatUrl: '' }, locationType);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect('chatUrl' in res.patch).toBe(false);
      }
    },
  );

  it('화이트리스트 밖 chatUrl 도메인은 온라인·오프라인 불문 거절한다 (NFR-002)', () => {
    expect(
      buildUpdatePatch({ ...validInput, chatUrl: 'https://google.com' }, 'ONLINE').ok,
    ).toBe(false);
    expect(
      buildUpdatePatch({ ...validInput, chatUrl: 'https://evil.com/invite' }, 'OFFLINE_GS').ok,
    ).toBe(false);
  });
});
