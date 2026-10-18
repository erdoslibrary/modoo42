import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { PublicUser } from '@/lib/public-user';

// 카드·상세 공용 조각. 리더 횟수·완주율은 표기하지 않는다 — 화면 명세(prd F2·F4)의
// 표출 항목에 없고, 넣으려면 조회 응답에 유저 통계를 더해야 한다 (spec FR-005).
export function LeaderLine({ leader }: { leader: PublicUser }) {
  return (
    <span className="flex items-center gap-2">
      <InitialBadge login={leader.login} size="sm" />
      <span className="min-w-0 leading-tight">
        <span className="px block truncate text-[13px]">{leader.login}</span>
        <CampusBadge campus={leader.campus} />
      </span>
    </span>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-[5px] border-[1.5px] border-ink bg-white px-1.5 py-px text-[11px] font-bold"
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
      className={`rounded-[5px] border-[1.5px] border-ink px-1.5 py-px text-[11px] font-bold ${
        isOpen ? 'bg-accent text-ink' : 'bg-bg text-muted'
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
