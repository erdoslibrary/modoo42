'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  const [now, setNow] = useState(() => new Date(serverNow));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const visible = pings.filter((p) => !p.expiresAt || p.expiresAt.getTime() > now.getTime());

  return (
    <section aria-labelledby="live-heading" className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <h2 id="live-heading" className="px text-[16px]">
          지금 클러스터
        </h2>
        <Link
          href="/create?type=LIVE"
          className="nb ml-auto rounded-lg bg-live px-3 py-1.5 text-[12px] font-bold text-white hover:text-white [--nb-depth:2px]"
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
