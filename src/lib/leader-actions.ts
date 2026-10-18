// 리더 기본 액션 및 완주·회고 라이프사이클 파생·직렬화 (specs/007a, specs/007b).
import { computeVerdictWindow } from '@/lib/end-date';
import { isAllowedChatUrl, type UpdatePostInput } from '@/lib/validation';
import type { PostDetail, VerdictMember, ViewerRole } from '@/lib/view-types';

export type LeaderActionState = {
  /** 리더 액션 영역 자체를 렌더할지 여부 */
  visible: boolean;
  /** [수정하기] 버튼 활성화 여부 */
  canEdit: boolean;
  /** 마감/재모집 토글 버튼 활성화 여부 */
  canToggleStatus: boolean;
  /** 토글 클릭 시 요청할 목표 상태 */
  nextToggleStatus: 'CLOSED' | 'RECRUITING';
  /** 토글 버튼에 표시할 라벨 */
  toggleLabel: string;
  /** [모집 취소] 버튼 활성화 여부 */
  canCancel: boolean;
};

export type EditFormInput = {
  title: string;
  description: string;
  place: string;
  chatUrl: string;
};

export type BuiltUpdatePatch =
  | { ok: true; patch: UpdatePostInput }
  | { ok: false; message: string };

export type CompletionChoice = 'complete' | 'postmortem';

export type CompletionActionState = {
  /** 상세 모달에 마무리 액션 버튼을 렌더할지 여부 (리더 & STUDY & RECRUITING|CLOSED) */
  showEntry: boolean;
  /** 마무리 모달 오픈 가능 여부 (now >= opensAt) */
  canOpenModal: boolean;
  /** 마무리 입구 버튼 라벨 */
  entryLabel: string;
  /** 입구 비활성 또는 보조 안내 문구 */
  entryHint: string | null;
  /** [🏆 완주했어요] 경로 선택 및 제출 가능 여부 */
  canComplete: boolean;
  /** 완주 판정 경로가 비활성일 때 표시할 사유 */
  completeDisabledReason: string | null;
  /** [🪦 Post-mortem 남기기] 경로 선택 및 제출 가능 여부 */
  canPostmortem: boolean;
  /** 모달 오픈 시 기본 선택될 탭 */
  defaultChoice: CompletionChoice;
};

export type CompleteFormInput = {
  evaluations: { userId: string; isCompleted: boolean }[];
  proofUrl: string;
};

export type BuiltCompletePayload =
  | {
      ok: true;
      payload: {
        evaluations: { userId: string; isCompleted: boolean }[];
        proofUrl?: string;
      };
    }
  | { ok: false; message: string };

export type BuiltPostmortemPayload =
  | { ok: true; payload: { text: string } }
  | { ok: false; message: string };

const HIDDEN_STATE: LeaderActionState = {
  visible: false,
  canEdit: false,
  canToggleStatus: false,
  nextToggleStatus: 'CLOSED',
  toggleLabel: '마감하기',
  canCancel: false,
};

const HIDDEN_COMPLETION_STATE: CompletionActionState = {
  showEntry: false,
  canOpenModal: false,
  entryLabel: '스터디 종료 및 결과 기록',
  entryHint: null,
  canComplete: false,
  completeDisabledReason: null,
  canPostmortem: false,
  defaultChoice: 'complete',
};

/**
 * 상세 모달에서 리더 기본 액션(수정·마감/재모집 토글·취소) 노출과 활성 상태를 파생한다.
 * - 최종 상태(COMPLETED·CANCELLED)나 LIVE 핑, 비리더는 섹션 자체를 숨긴다.
 * - 단기 파티(PARTY) 마감일이 지난 경우(FR-020) 수정·토글을 비활성화하고 취소만 열어 둔다.
 * - 마감(CLOSED) 상태에서는 수정이 불가하고(FR-006), 정원이 이미 찬 경우 재모집 토글도 비활성화한다.
 */
export function leaderActionStateOf(
  post: Pick<PostDetail, 'type' | 'status' | 'currentMembers' | 'maxMembers' | 'endDate'>,
  role: ViewerRole,
  now: Date = new Date(),
): LeaderActionState {
  if (role !== 'leader') return HIDDEN_STATE;
  if (post.type === 'LIVE') return HIDDEN_STATE;
  if (post.status === 'COMPLETED' || post.status === 'CANCELLED') return HIDDEN_STATE;

  const isPartyExpired =
    post.type === 'PARTY' && post.endDate !== null && post.endDate.getTime() <= now.getTime();

  if (isPartyExpired) {
    return {
      visible: true,
      canEdit: false,
      canToggleStatus: false,
      nextToggleStatus: post.status === 'RECRUITING' ? 'CLOSED' : 'RECRUITING',
      toggleLabel: '마감됨',
      canCancel: true,
    };
  }

  if (post.status === 'RECRUITING') {
    return {
      visible: true,
      canEdit: true,
      canToggleStatus: true,
      nextToggleStatus: 'CLOSED',
      toggleLabel: '마감하기',
      canCancel: true,
    };
  }

  // post.status === 'CLOSED'
  const isFull = post.maxMembers !== null && post.currentMembers >= post.maxMembers;
  return {
    visible: true,
    canEdit: false,
    canToggleStatus: !isFull,
    nextToggleStatus: 'RECRUITING',
    toggleLabel: isFull ? '재모집 불가 (정원 마감)' : '재모집하기',
    canCancel: true,
  };
}

/**
 * 수정 폼 입력값을 검증하고 PUT /api/posts/:id 요청용 UpdatePostInput으로 직렬화한다.
 * - description과 place는 빈 문자열일 때 null로 보내 기존 값을 비울 수 있게 한다.
 * - chatUrl은 ONLINE·HYBRID일 때 필수이며, 입력된 경우 화이트리스트 정규식을 검증한다.
 */
export function buildUpdatePatch(
  input: EditFormInput,
  locationType: string,
): BuiltUpdatePatch {
  const title = input.title.trim();
  if (title.length < 1 || title.length > 40) {
    return { ok: false, message: '제목은 1~40자로 입력해 주세요.' };
  }

  const rawDesc = input.description.trim();
  if (rawDesc.length > 300) {
    return { ok: false, message: '설명은 300자 이하로 입력해 주세요.' };
  }
  const description = rawDesc.length > 0 ? rawDesc : null;

  const rawPlace = input.place.trim();
  const place = rawPlace.length > 0 ? rawPlace : null;

  const rawChatUrl = input.chatUrl.trim();
  const isOnlineRequired = locationType === 'ONLINE' || locationType === 'HYBRID';

  if (isOnlineRequired && rawChatUrl.length === 0) {
    return { ok: false, message: '온라인·온/오프라인 병행 모집은 초대 링크가 필요합니다.' };
  }

  if (rawChatUrl.length > 0 && !isAllowedChatUrl(rawChatUrl)) {
    return {
      ok: false,
      message: '카카오톡 오픈채팅 또는 디스코드 초대 링크만 입력할 수 있습니다.',
    };
  }

  const patch: UpdatePostInput = {
    title,
    description,
    place,
  };
  if (rawChatUrl.length > 0) {
    patch.chatUrl = rawChatUrl;
  }

  return { ok: true, patch };
}

/**
 * 정규 스터디(STUDY) 마무리 모달 진입 및 내부 경로(완주 판정 / Post-mortem 회고) 활성 상태를 파생한다 (FR-008, FR-009, FR-021).
 */
export function completionActionStateOf(
  post: {
    type: PostDetail['type'];
    status: PostDetail['status'];
    endDate: Date | null;
    postmortemText?: string | null;
    verdictMembers?: VerdictMember[];
  },
  role: ViewerRole,
  now: Date = new Date(),
): CompletionActionState {
  if (role !== 'leader') return HIDDEN_COMPLETION_STATE;
  if (post.type !== 'STUDY') return HIDDEN_COMPLETION_STATE;
  if (post.status === 'COMPLETED' || post.status === 'CANCELLED') return HIDDEN_COMPLETION_STATE;
  if (!post.endDate) return HIDDEN_COMPLETION_STATE;

  const { opensAt, closesAt } = computeVerdictWindow(post.endDate);
  if (now.getTime() < opensAt.getTime()) {
    return {
      showEntry: true,
      canOpenModal: false,
      entryLabel: '스터디 종료 및 결과 기록',
      entryHint: '사이클 종료월 15일부터 결과를 기록할 수 있습니다.',
      canComplete: false,
      completeDisabledReason: '완주 판정 기간이 아닙니다.',
      canPostmortem: false,
      defaultChoice: 'complete',
    };
  }

  const hasPostmortem = Boolean(post.postmortemText && post.postmortemText.length > 0);
  if (hasPostmortem) {
    return {
      showEntry: true,
      canOpenModal: true,
      entryLabel: 'Post-mortem 회고 수정',
      entryHint: null,
      canComplete: false,
      completeDisabledReason: '이미 Post-mortem 회고가 등록된 스터디입니다.',
      canPostmortem: true,
      defaultChoice: 'postmortem',
    };
  }

  if (now.getTime() > closesAt.getTime()) {
    return {
      showEntry: true,
      canOpenModal: true,
      entryLabel: '스터디 종료 및 결과 기록',
      entryHint: null,
      canComplete: false,
      completeDisabledReason:
        '완주 판정 기한(익월 10일)이 지났습니다. Post-mortem 회고를 남겨 주세요.',
      canPostmortem: true,
      defaultChoice: 'postmortem',
    };
  }

  const memberCount = post.verdictMembers?.length ?? 0;
  if (memberCount === 0) {
    return {
      showEntry: true,
      canOpenModal: true,
      entryLabel: '스터디 종료 및 결과 기록',
      entryHint: null,
      canComplete: false,
      completeDisabledReason:
        '참여한 팀원이 없어 완주 판정을 할 수 없습니다. Post-mortem 회고를 남겨 주세요.',
      canPostmortem: true,
      defaultChoice: 'postmortem',
    };
  }

  return {
    showEntry: true,
    canOpenModal: true,
    entryLabel: '스터디 종료 및 결과 기록',
    entryHint: null,
    canComplete: true,
    completeDisabledReason: null,
    canPostmortem: true,
    defaultChoice: 'complete',
  };
}

/**
 * 완주 판정 폼 입력값을 검증하고 POST /api/posts/:id/complete 요청 페이로드로 직렬화한다 (FR-008).
 */
export function buildCompletePayload(input: CompleteFormInput): BuiltCompletePayload {
  if (input.evaluations.length === 0) {
    return { ok: false, message: '판정할 참여 팀원이 없습니다.' };
  }
  const hasCompletedMember = input.evaluations.some((e) => e.isCompleted);
  if (!hasCompletedMember) {
    return { ok: false, message: '완주한 팀원을 1명 이상 선택해 주세요.' };
  }

  const rawProof = input.proofUrl.trim();
  if (rawProof.length > 0 && !/^https:\/\//.test(rawProof)) {
    return { ok: false, message: '결과물 링크는 https://로 시작해야 합니다.' };
  }

  const payload: {
    evaluations: { userId: string; isCompleted: boolean }[];
    proofUrl?: string;
  } = {
    evaluations: input.evaluations,
  };
  if (rawProof.length > 0) {
    payload.proofUrl = rawProof;
  }

  return { ok: true, payload };
}

/**
 * Post-mortem 회고 입력값을 검증하고 POST /api/posts/:id/postmortem 요청 페이로드로 직렬화한다 (FR-009).
 */
export function buildPostmortemPayload(rawText: string): BuiltPostmortemPayload {
  const text = rawText.trim();
  if (text.length < 1 || text.length > 1000) {
    return { ok: false, message: 'Post-mortem 회고는 1~1000자로 입력해 주세요.' };
  }
  return { ok: true, payload: { text } };
}

