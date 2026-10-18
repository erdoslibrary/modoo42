import type { Campus } from '@/lib/public-user';

// 캠퍼스 뱃지 (req FR-016·FR-019). campus가 null인 유저는 요소 자체를 만들지 않는다 —
// 빈 괄호나 떠 있는 구분자를 남기지 않는다. 기수(2기) 표기는 담을 컬럼이 없어 생략한다 (req §1.3).
const LABELS: Record<'GS' | 'SEOUL', string> = {
  GS: '42경산',
  SEOUL: '42서울',
};

export function CampusBadge({ campus }: { campus: Campus }) {
  if (!campus) return null;

  return (
    <span className="inline-block rounded-[5px] border-[1.5px] border-accent-dark bg-accent-soft px-1.5 py-px text-[10px] font-bold text-accent-dark">
      {LABELS[campus]}
    </span>
  );
}
