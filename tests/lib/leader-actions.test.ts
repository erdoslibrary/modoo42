import { describe, it, expect } from 'vitest';
import {
  leaderActionStateOf,
  buildUpdatePatch,
  completionActionStateOf,
  buildCompletePayload,
  buildPostmortemPayload,
} from '@/lib/leader-actions';

const now = new Date('2026-10-18T12:00:00+09:00');
const futureDate = new Date('2026-10-31T23:59:59.999+09:00');
const pastDate = new Date('2026-10-10T23:59:59+09:00');

const baseStudy = {
  type: 'STUDY' as const,
  status: 'RECRUITING' as const,
  currentMembers: 3,
  maxMembers: 6,
  endDate: futureDate,
  postmortemText: null,
  verdictMembers: [
    { userId: '11111111-1111-4111-8111-111111111111', login: 'gs_member', campus: 'GS' as const },
    { userId: '22222222-2222-4222-8222-222222222222', login: 'seoul_member', campus: 'SEOUL' as const },
  ],
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

describe('completionActionStateOf — 완주 판정 및 회고 등록 입구·경로 파생 (FR-008, FR-009, FR-021)', () => {
  it.each(['participant', 'visitor', 'guest'] as const)(
    '비리더(%s)는 showEntry: false',
    (role) => {
      const state = completionActionStateOf(baseStudy, role, now);
      expect(state.showEntry).toBe(false);
      expect(state.canOpenModal).toBe(false);
      expect(state.canComplete).toBe(false);
      expect(state.canPostmortem).toBe(false);
    },
  );

  it.each(['PARTY', 'LIVE'] as const)(
    '정규 스터디가 아닌 유형(%s)은 showEntry: false',
    (type) => {
      const state = completionActionStateOf({ ...baseStudy, type }, 'leader', now);
      expect(state.showEntry).toBe(false);
      expect(state.canOpenModal).toBe(false);
    },
  );

  it.each(['COMPLETED', 'CANCELLED'] as const)(
    '최종 상태(%s)는 showEntry: false',
    (status) => {
      const state = completionActionStateOf({ ...baseStudy, status }, 'leader', now);
      expect(state.showEntry).toBe(false);
      expect(state.canOpenModal).toBe(false);
    },
  );

  it('판정 창 오픈 전(종료월 14일 23:59:59 KST)에는 입구는 보이지만 모달 오픈이 비활성화된다', () => {
    const beforeOpen = new Date('2026-10-14T23:59:59.999+09:00');
    const state = completionActionStateOf(baseStudy, 'leader', beforeOpen);
    expect(state.showEntry).toBe(true);
    expect(state.canOpenModal).toBe(false);
    expect(state.canComplete).toBe(false);
    expect(state.canPostmortem).toBe(false);
    expect(state.entryHint).toBeTruthy();
  });

  it('판정 창 안(10/15 ~ 11/10 KST) + 팀원 1명 이상 + 회고 없음 → 완주·Post-mortem 모두 활성, 기본 선택 complete', () => {
    const state = completionActionStateOf(baseStudy, 'leader', now);
    expect(state).toEqual({
      showEntry: true,
      canOpenModal: true,
      entryLabel: '스터디 종료 및 결과 기록',
      entryHint: null,
      canComplete: true,
      completeDisabledReason: null,
      canPostmortem: true,
      defaultChoice: 'complete',
    });
  });

  it('판정 창 안이지만 리더 외 참여 팀원이 0명이면 완주 판정은 비활성화되고 기본 선택이 postmortem이 된다', () => {
    const state = completionActionStateOf(
      { ...baseStudy, verdictMembers: [] },
      'leader',
      now,
    );
    expect(state.showEntry).toBe(true);
    expect(state.canOpenModal).toBe(true);
    expect(state.canComplete).toBe(false);
    expect(state.completeDisabledReason).toContain('팀원');
    expect(state.canPostmortem).toBe(true);
    expect(state.defaultChoice).toBe('postmortem');
  });

  it('이미 Post-mortem 회고가 등록된 스터디는 완주 판정이 비활성화되고 회고 수정으로 진입한다', () => {
    const state = completionActionStateOf(
      { ...baseStudy, postmortemText: '기존 회고 본문' },
      'leader',
      now,
    );
    expect(state.showEntry).toBe(true);
    expect(state.canOpenModal).toBe(true);
    expect(state.entryLabel).toBe('Post-mortem 회고 수정');
    expect(state.canComplete).toBe(false);
    expect(state.completeDisabledReason).toContain('회고');
    expect(state.canPostmortem).toBe(true);
    expect(state.defaultChoice).toBe('postmortem');
  });

  it('판정 기한(익월 10일 23:59:59 KST) 경과 후에는 완주 판정이 비활성화되고 Post-mortem만 허용된다', () => {
    const afterClose = new Date('2026-11-11T00:00:00.000+09:00');
    const state = completionActionStateOf(baseStudy, 'leader', afterClose);
    expect(state.showEntry).toBe(true);
    expect(state.canOpenModal).toBe(true);
    expect(state.canComplete).toBe(false);
    expect(state.completeDisabledReason).toContain('기한');
    expect(state.canPostmortem).toBe(true);
    expect(state.defaultChoice).toBe('postmortem');
  });
});

describe('buildCompletePayload & buildPostmortemPayload — 제출 페이로드 검증·직렬화 (FR-008, FR-009)', () => {
  const evals = [
    { userId: '11111111-1111-4111-8111-111111111111', isCompleted: true },
    { userId: '22222222-2222-4222-8222-222222222222', isCompleted: false },
  ];

  it('완주 판정: 팀원 1명 이상 체크 + 증빙 URL 빈 값 → proofUrl 키 없이 통과', () => {
    const res = buildCompletePayload({ evaluations: evals, proofUrl: '   ' });
    expect(res).toEqual({
      ok: true,
      payload: { evaluations: evals },
    });
    if (res.ok) {
      expect('proofUrl' in res.payload).toBe(false);
    }
  });

  it('완주 판정: 유효한 https:// 증빙 URL 입력 시 trim하여 포함한다', () => {
    const res = buildCompletePayload({
      evaluations: evals,
      proofUrl: '  https://github.com/modoo42/study  ',
    });
    expect(res).toEqual({
      ok: true,
      payload: {
        evaluations: evals,
        proofUrl: 'https://github.com/modoo42/study',
      },
    });
  });

  it('완주 판정: 전원 미체크(완주 0명) 또는 빈 배열이면 거절한다', () => {
    expect(buildCompletePayload({ evaluations: [], proofUrl: '' }).ok).toBe(false);
    expect(
      buildCompletePayload({
        evaluations: evals.map((e) => ({ ...e, isCompleted: false })),
        proofUrl: '',
      }).ok,
    ).toBe(false);
  });

  it('완주 판정: https://로 시작하지 않는 증빙 URL은 거절한다', () => {
    expect(
      buildCompletePayload({ evaluations: evals, proofUrl: 'http://github.com/x' }).ok,
    ).toBe(false);
    expect(
      buildCompletePayload({ evaluations: evals, proofUrl: 'not-a-url' }).ok,
    ).toBe(false);
  });

  it('Post-mortem: 앞뒤 공백 제거 후 1~1000자면 통과하고 공백뿐이거나 1001자면 거절한다', () => {
    expect(buildPostmortemPayload('   ').ok).toBe(false);
    expect(buildPostmortemPayload('가'.repeat(1001)).ok).toBe(false);
    expect(buildPostmortemPayload('  일정 조율이 어려웠습니다.  ')).toEqual({
      ok: true,
      payload: { text: '일정 조율이 어려웠습니다.' },
    });
  });
});

