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
              // 선택 상태는 accent-bright다 — accent는 제출·참여 전용이다 (FR-001).
              // 비활성은 그림자를 지운다. 색만 바꾸면 선택이 그림자로 구분되지 않는다 (FR-002).
              kind === key
                ? 'nb px rounded-lg bg-accent-bright px-3 pb-[9px] pt-[11px] text-[14px]'
                : 'nb px rounded-lg bg-white px-3 pb-[9px] pt-[11px] text-[14px] text-ink shadow-none hover:bg-accent-soft'
            }
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="nb flex flex-col rounded-[14px] border-[3px] bg-card px-6 pb-[22px] pt-5 [--nb-depth:5px]">
        {kind === 'completed' ? (
          completed.length === 0 ? (
            <p className="text-[13px] text-muted">아직 완주한 정규 스터디가 없습니다.</p>
          ) : (
            completed.map((item) => (
              // 점선 구분선은 장식이 아니라 목록 항목의 경계를 전달한다 — anti-ai-slop의
              // 「구획: 효과 대신 border + 여백」에 해당한다 (FR-022, research.md R5).
              <article
                key={item.id}
                className="flex items-center gap-3 border-t-2 border-dashed border-line py-[13px]"
              >
                <InitialBadge login={item.leader.login} size="list" />
                <div className="min-w-0 flex-1">
                  <p className="px truncate text-[13px]">{item.title}</p>
                  <p className="text-[12px] text-muted-soft">
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
                    // 원본은 Pretendard 텍스트 링크다 — 버튼 규칙을 여기까지 넓히지 않는다 (FR-009).
                    className="flex-none text-[13px] font-semibold text-muted hover:text-accent-dark"
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
            <article
              key={item.id}
              className="flex flex-col gap-1 border-t-2 border-dashed border-line py-[13px]"
            >
              <p className="px text-[13px]">{item.title}</p>
              <p className="text-[12px] text-muted-soft">
                리더 {item.leader.login}
                {periodLabel(item.endDate) ? ` · ${periodLabel(item.endDate)}` : ''}
              </p>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                {item.postmortemText}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
