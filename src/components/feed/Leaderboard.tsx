import { CampusBadge } from '@/components/card/CampusBadge';
import type { LeaderboardItem } from '@/lib/posts';

// 1~3위만 메달 색이고 4·5위는 무채 표면색이다. 치수는 다섯 자리 모두 같다 (FR-010, §3.4).
// 1~3위 행 박스는 채택하지 않는다 — 메달 색 하나로 구분하고 다섯 행을 같은 맨 줄로 둔다 (FR-025).
const MEDAL_TONE: Record<number, string> = {
  1: 'bg-medal-gold text-ink',
  2: 'bg-medal-silver text-ink',
  3: 'bg-medal-bronze text-ink',
};

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
              <span
                className={`px grid h-[26px] w-[26px] flex-none place-items-center rounded-[6px] border-2 border-ink text-[13px] ${
                  MEDAL_TONE[row.rank] ?? 'bg-surface text-muted'
                }`}
              >
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
