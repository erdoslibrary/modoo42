// 리더 기본 액션 파생 및 수정 패치 직렬화 (specs/007a-leader-actions/data-model.md).
import { isAllowedChatUrl, type UpdatePostInput } from '@/lib/validation';
import type { PostDetail, ViewerRole } from '@/lib/view-types';

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

const HIDDEN_STATE: LeaderActionState = {
  visible: false,
  canEdit: false,
  canToggleStatus: false,
  nextToggleStatus: 'CLOSED',
  toggleLabel: '마감하기',
  canCancel: false,
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
