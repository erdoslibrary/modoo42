import { CampusBadge } from '@/components/card/CampusBadge';
import type { LeaderboardItem } from '@/lib/posts';

// 성실 멤버 랭킹 1~5위 (spec FR-012). 정렬은 완주 횟수 → 리더 횟수 → login 오름차순이다 (req FR-010).
// 완주율은 저장되지 않는 지표이므로 표기하지 않는다 (spec FR-005).
export function Leaderboard({ rows }: { rows: LeaderboardItem[] }) {
  return (
    <section aria-labelledby="rank-heading" className="nb flex flex-col gap-3 rounded-[10px] bg-card p-4">
      <header>
        <h2 id="rank-heading" className="px text-[15px]">
          성실 멤버 랭킹
        </h2>
        <p className="mt-1 text-[12px] text-muted">누적 완주 횟수 · 누적 리더 횟수 기준</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">아직 완주 기록이 없습니다.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.login} className="flex items-center gap-2.5">
              <span className="px grid h-6 w-6 flex-none place-items-center rounded-[5px] border-[1.5px] border-ink bg-white text-[12px]">
                {row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{row.login}</span>
              <CampusBadge campus={row.campus} />
              <span className="px flex-none text-[12px]">완주 {row.completedCount}회</span>
              <span className="flex-none text-[12px] text-muted">리더 {row.leaderCount}회</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
