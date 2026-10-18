import { EmptyState } from '@/components/feed/EmptyState';
import type { HistoryCategory, HistoryItem } from '@/lib/view-types';

// 스터디 이력 (req FR-019). 분류 라벨·리더 뱃지·기간·인원·회고 표기만 그린다.
// 주차별 커리큘럼·모임 주기는 저장되는 데이터가 없어 만들지 않는다 (spec FR-005).
const CATEGORY_LABEL: Record<HistoryCategory, string> = {
  COMPLETED: '완주',
  ONGOING: '진행중',
  ENDED: '종료',
};

// ENDED는 원본의 `회고`와 의미가 다르다 — categoryOf의 fallback이라 미완주·취소까지 들어온다
// (src/lib/profile.ts). 카피는 `종료`로 두고 색만 무채로 맞춘다 (FR-001).
const CATEGORY_TONE: Record<HistoryCategory, string> = {
  COMPLETED: 'bg-accent-bright',
  ONGOING: 'bg-accent-soft',
  ENDED: 'bg-muted text-white',
};

export function HistoryList({ history }: { history: HistoryItem[] }) {
  return (
    <section>
      <h2 className="px text-[15px]">스터디 이력</h2>
      <p className="mt-1 text-[11px] text-muted">완주 · 리더 · 진행 중 기록</p>

      {history.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            title="아직 기록이 없어요"
            description="스터디에 참여하거나 직접 개설하면 여기에 쌓입니다."
            href="/create?type=STUDY"
          />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {history.map((item) => (
            <li
              key={item.postId}
              className="nb flex items-center gap-3 rounded-lg bg-card px-3 py-2.5 [--nb-depth:2px]"
            >
              <span
                className={`px flex-none rounded-[6px] border-[2px] border-ink px-2 pb-0.5 pt-1 text-[10px] ${CATEGORY_TONE[item.category]}`}
              >
                {CATEGORY_LABEL[item.category]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{item.title}</span>
                <span className="mt-1 block text-[11px] text-muted">
                  {[
                    item.periodLabel,
                    item.headcountLabel,
                    item.hasPostmortem ? 'Post-mortem 작성' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
              {item.isLeader && (
                <span className="flex-none rounded-md border-[2px] border-ink bg-bg px-2 py-0.5 text-[11px] font-bold">
                  리더
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
