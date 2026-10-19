'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDevClock } from '@/components/dev/ClockProvider';
import { LivePingCard } from '@/components/card/LivePingCard';
import { EmptyState } from '@/components/feed/EmptyState';
import type { FeedPost } from '@/lib/view-types';

// 지금 클러스터 전광판 (spec FR-006·FR-013).
// 남은 시간은 1초마다 다시 계산하고, 0에 닿은 핑은 화면에서 뺀다. 서버에 만료를 알리지 않는다 —
// 만료는 상태 전이가 아니라 조회 필터다 (CLAUDE.md §6.4, spec FR-063).
export function LivePingBoard({
  pings,
  now: serverNow,
  myLogin,
}: {
  pings: FeedPost[];
  now: Date;
  myLogin: string | null;
}) {
  // 1초 갱신도 유효 시각을 쓴다 — 개발 시계를 옮기면 카운트다운이 함께 움직인다 (FR-027).
  const clock = useDevClock();
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(clock.now()), 1000);
    return () => clearInterval(timer);
    // clock 객체는 매 렌더 새로 만들어진다. 실제 의존은 오프셋 값 하나다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.offsetMs]);

  const visible = pings.filter((p) => !p.expiresAt || p.expiresAt.getTime() > now.getTime());

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <h2 id="live-heading" className="px text-[16px]">
          지금 클러스터
        </h2>
        <Link
          href="/create?type=LIVE"
          className="nb px ml-auto rounded-[7px] border-2 bg-live px-3 pb-[5px] pt-[7px] text-[12px] text-white hover:text-white [--nb-depth:2px]"
        >
          + 핑 보내기
        </Link>
      </header>

      {visible.length === 0 ? (
        <EmptyState
          title="지금 올라온 핑이 없습니다"
          description="디버깅·밥친구·과제 평가자를 30분~3시간 단위로 구해 보세요"
          href="/create?type=LIVE"
        />
      ) : (
        <div className="hs flex gap-3 pb-2">
          {visible.map((ping) => (
            <LivePingCard
              key={ping.id}
              post={ping}
              now={now}
              isAuthor={myLogin !== null && ping.leader.login === myLogin}
            />
          ))}
        </div>
      )}
    </section>
  );
}
