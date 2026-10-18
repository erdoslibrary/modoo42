import Link from 'next/link';
import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import { periodLabel } from '@/lib/display';
import type { HallOfFameItem, PostmortemItem } from '@/lib/posts';

// 🏆명예의 전당 / 🪦Post-mortem 탭 (spec FR-011). 정규 스터디 전용이며 단기 파티는 들어오지 않는다.
// 탭은 ?archive= 쿼리로 서버가 다른 조회를 한다 (research R12).
const TABS = [
  { key: 'completed', label: '🏆명예의 전당' },
  { key: 'postmortem', label: '🪦Post-mortem' },
] as const;

type Props = {
  kind: 'completed' | 'postmortem';
  completed: HallOfFameItem[];
  postmortem: PostmortemItem[];
  sort: string;
};

export function ArchiveTabs({ kind, completed, postmortem, sort }: Props) {
  return (
    <section id="archive" aria-labelledby="archive-heading" className="flex flex-col gap-3">
      <h2 id="archive-heading" className="sr-only">
        아카이브
      </h2>

      <div className="flex gap-2">
        {TABS.map(({ key, label }) => (
          <Link
            key={key}
            href={`/dashboard?sort=${sort}&archive=${key}#archive`}
            aria-current={kind === key ? 'true' : undefined}
            className={
              kind === key
                ? 'nb rounded-lg bg-accent px-3 py-1.5 text-[13px] font-bold [--nb-depth:2px]'
                : 'nb rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-ink hover:bg-accent-soft [--nb-depth:2px]'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="nb flex flex-col gap-3 rounded-[10px] bg-card p-4">
        {kind === 'completed' ? (
          completed.length === 0 ? (
            <p className="text-[13px] text-muted">아직 완주한 정규 스터디가 없습니다.</p>
          ) : (
            completed.map((item) => (
              <article key={item.id} className="flex items-center gap-3">
                <InitialBadge login={item.leader.login} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="px truncate text-[13px]">{item.title}</p>
                  <p className="text-[12px] text-muted">
                    리더 {item.leader.login} · {item.completedMembers.length}명 완주
                    {periodLabel(item.endDate) ? ` · ${periodLabel(item.endDate)}` : ''}
                  </p>
                </div>
                <CampusBadge campus={item.leader.campus} />
                {item.proofUrl && (
                  <a
                    href={item.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px flex-none text-[12px] hover:text-accent-dark"
                  >
                    결과물 ↗
                  </a>
                )}
              </article>
            ))
          )
        ) : postmortem.length === 0 ? (
          <p className="text-[13px] text-muted">등록된 회고가 없습니다.</p>
        ) : (
          postmortem.map((item) => (
            <article key={item.id} className="flex flex-col gap-1">
              <p className="px text-[13px]">{item.title}</p>
              <p className="text-[12px] text-muted">
                리더 {item.leader.login}
                {periodLabel(item.endDate) ? ` · ${periodLabel(item.endDate)}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {item.postmortemText}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
