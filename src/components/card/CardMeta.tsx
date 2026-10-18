import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { PublicUser } from '@/lib/public-user';

// 카드·상세 공용 조각. 리더 횟수·완주율은 표기하지 않는다 — 화면 명세(prd F2·F4)의
// 표출 항목에 없고, 넣으려면 조회 응답에 유저 통계를 더해야 한다 (spec FR-005).
export function LeaderLine({ leader }: { leader: PublicUser }) {
  return (
    <span className="flex items-center gap-2.5 rounded-[9px] border-2 border-ink bg-surface-bright px-3 py-2.5">
      <InitialBadge login={leader.login} size="card" />
      <span className="min-w-0 leading-[1.3]">
        <span className="block truncate text-[14px] font-extrabold">{leader.login}</span>
        <CampusBadge campus={leader.campus} />
      </span>
      {/* 42 인증 완료 표시다. PublicUser에는 campus밖에 없으므로 그 유무에서 파생한다
          (FR-023, research.md R7). 리더 횟수는 표기하지 않는다. */}
      {leader.campus !== null && (
        <span
          aria-hidden
          className="ml-auto grid h-5 w-5 flex-none place-items-center rounded-full border-2 border-ink bg-accent text-[11px] font-extrabold text-ink"
        >
          ✓
        </span>
      )}
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((tag, i) => (
        <span
          key={tag}
          // 첫 번째 칩만 액센트 틴트다 — 대표 주제를 앞세우는 표기다 (FR-020, interactions.md §3.3).
          className={`rounded-[6px] border-[1.5px] px-[9px] py-[3px] text-[13px] font-bold ${
            i === 0
              ? 'border-accent-dark bg-accent-soft text-accent-dark'
              : 'border-ink bg-surface text-ink'
          }`}
        >
          #{tag}
        </span>
      ))}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  RECRUITING: '모집 중',
  CLOSED: '모집 완료',
  COMPLETED: '완주',
  CANCELLED: '취소',
};

export function StatusBadge({ status }: { status: string }) {
  const isOpen = status === 'RECRUITING';
  return (
    <span
      className={`rounded-[5px] border-2 border-ink px-2 py-0.5 text-[11px] font-extrabold ${
        // 상태 칩 바탕은 원본이 #9be06a다 (interactions.md §3.3). accent는 제출·참여 전용이다.
        isOpen ? 'bg-accent-bright text-ink' : 'bg-bg text-muted'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** 카드 하단의 라벨-값 한 줄. */
export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline justify-between gap-2 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="px text-[12px]">{value}</span>
    </span>
  );
}
