'use client';

import { LivePingBoard } from '@/components/feed/LivePingBoard';
import { PartyRail } from '@/components/feed/PartyRail';
import { StudyGrid } from '@/components/feed/StudyGrid';
import { useRealtimePosts, type FeedLists } from '@/hooks/useRealtimePosts';

// 실시간 피드 묶음 (req FR-014). 채널을 1개만 열기 위해 세 섹션이 훅 1개를 공유한다
// (contracts/realtime-posts.md §2). 사이드 패널은 서버 컴포넌트를 그대로 받아 끼운다.
export function RealtimeFeed({
  initial,
  now,
  myLogin,
  sort,
  archive,
  aside,
}: {
  initial: FeedLists;
  now: Date;
  myLogin: string | null;
  sort: 'latest' | 'deadline';
  archive: string | null;
  aside: React.ReactNode;
}) {
  const { pings, parties, studies } = useRealtimePosts(initial);

  return (
    <>
      <LivePingBoard pings={pings} now={now} myLogin={myLogin} />
      <PartyRail parties={parties} now={now} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <StudyGrid studies={studies} sort={sort} archive={archive} />
        <div className="flex flex-col gap-6">{aside}</div>
      </div>
    </>
  );
}
