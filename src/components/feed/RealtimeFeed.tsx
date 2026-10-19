'use client';

import { LivePingBoard } from '@/components/feed/LivePingBoard';
import { PartyRail } from '@/components/feed/PartyRail';
import { StudyGrid } from '@/components/feed/StudyGrid';
import { useRealtimePosts, type FeedLists } from '@/hooks/useRealtimePosts';

// 실시간 피드 묶음 (req FR-014). 채널을 1개만 열기 위해 세 섹션이 훅 1개를 공유한다
// (contracts/realtime-posts.md §2). 랭킹·CLI는 실시간 블록 옆이 아니라 아래로 가므로
// 클라이언트 경계를 넘길 이유가 없다 — page.tsx가 직접 조립한다 (FR-017, research.md R3).
export function RealtimeFeed({
  initial,
  now,
  myLogin,
  sort,
  archive,
  realtimeSchema,
}: {
  initial: FeedLists;
  now: Date;
  myLogin: string | null;
  sort: 'latest' | 'deadline';
  archive: string | null;
  /** 구독 스키마. 콘솔 세션이면 dev_sandbox다 (FR-028, research.md R11). */
  realtimeSchema: string;
}) {
  const { pings, parties, studies } = useRealtimePosts(initial, realtimeSchema);

  return (
    <>
      <LivePingBoard pings={pings} now={now} myLogin={myLogin} />
      <PartyRail parties={parties} now={now} />
      <StudyGrid studies={studies} sort={sort} archive={archive} />
    </>
  );
}
