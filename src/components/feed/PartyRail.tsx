import { PartyCard } from '@/components/card/PartyCard';
import { EmptyState } from '@/components/feed/EmptyState';
import type { FeedPost } from '@/lib/view-types';

// 마감 임박 단기 파티 가로 줄 (spec FR-006·FR-007). 마감일이 지난 파티는 조회에서 빠진다 (FR-020).
export function PartyRail({ parties, now }: { parties: FeedPost[]; now: Date }) {
  return (
    <section id="parties" aria-labelledby="parties-heading" className="flex flex-col gap-3">
      <header className="flex items-center gap-3">
        <h2 id="parties-heading" className="px text-[16px]">
          마감 임박 단기 파티
        </h2>
        <span className="ml-auto text-[12px] text-muted">마감이 가까운 순서</span>
      </header>

      {parties.length === 0 ? (
        <EmptyState
          title="열린 단기 파티가 없습니다"
          description="해커톤 팀 빌딩·컨퍼런스 동행처럼 1개월 미만 모임을 열어 보세요"
          href="/create?type=PARTY"
        />
      ) : (
        <div className="hs flex gap-3 pb-2">
          {parties.map((party) => (
            <PartyCard key={party.id} post={party} now={now} />
          ))}
        </div>
      )}
    </section>
  );
}
