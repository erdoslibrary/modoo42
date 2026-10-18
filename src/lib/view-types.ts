// 화면이 읽는 뷰 모델 (data-model.md §4). 타입만 두는 모듈이라 서버·클라이언트 양쪽에서 안전하다.
import type { PublicUser } from '@/lib/public-user';

export type PostType = 'STUDY' | 'PARTY' | 'LIVE';
export type PostStatus = 'RECRUITING' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';

/** 카드 1장. 리스트 응답에는 chatUrl이 애초에 없다 (헌법 V). */
export type FeedPost = {
  id: string;
  type: PostType;
  title: string;
  tags: string[];
  locationType: string;
  place: string | null;
  maxMembers: number | null;
  currentMembers: number;
  status: PostStatus;
  chatPlatform: string | null;
  referenceUrl: string | null;
  endDate: Date | null;
  expiresAt: Date | null;
  leader: PublicUser;
};

/** 상세 모달. chatUrl은 참여자 응답에만 존재한다 (키 자체가 없다). */
export type PostDetail = FeedPost & {
  templateId: string | null;
  templateData: Record<string, unknown> | null;
  description: string | null;
  cancelReason: string | null;
  participants: PublicUser[];
  chatUrl?: string | null;
};

/** 참여 가능 상태 (data-model.md §6). */
export type Joinability =
  | 'open'
  | 'full'
  | 'closed'
  | 'expired'
  | 'completed'
  | 'cancelled'
  | 'guest';

/**
 * 보는 사람의 역할. `visitor`는 로그인했지만 아직 참여하지 않은 유저,
 * `guest`는 비로그인이다 — 섞으면 비참여자에게 "로그인이 필요합니다"가 뜬다.
 */
export type ViewerRole = 'leader' | 'participant' | 'visitor' | 'guest';

/** 프로필 이력 1건. */
export type HistoryCategory = 'COMPLETED' | 'ONGOING' | 'ENDED';

export type HistoryItem = {
  postId: string;
  title: string;
  type: PostType;
  category: HistoryCategory;
  isLeader: boolean;
  periodLabel: string | null;
  headcountLabel: string | null;
  hasPostmortem: boolean;
};

export type ProfileView = PublicUser & {
  initials: string;
  completedCount: number;
  leaderCount: number;
  history: HistoryItem[];
};
