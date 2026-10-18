import Link from 'next/link';
import { StudyCard } from '@/components/card/StudyCard';
import { EmptyState } from '@/components/feed/EmptyState';
import type { FeedPost } from '@/lib/view-types';

// 모집 중인 정규 스터디 그리드 (spec FR-006·FR-007).
// 정렬은 ?sort= 쿼리로 서버가 다시 조회한다 — 새로고침·공유에도 정렬이 유지된다.
const SORTS = [
  { key: 'latest', label: '최신순' },
  { key: 'deadline', label: '마감임박순' },
] as const;

export function StudyGrid({
  studies,
  sort,
  archive,
}: {
  studies: FeedPost[];
  sort: 'latest' | 'deadline';
  archive: string | null;
}) {
  const hrefFor = (key: string) => {
    const params = new URLSearchParams({ sort: key });
    if (archive) params.set('archive', archive);
    return `/dashboard?${params.toString()}#studies`;
  };

  return (
    <section id="studies" aria-labelledby="studies-heading" className="flex flex-col gap-3">
      <header className="flex items-baseline gap-2">
        <h2 id="studies-heading" className="px text-[21px]">
          모집 중인 정규 스터디
        </h2>
        {/* 건수에 칩이나 박스를 씌우지 않는다 — 테두리·배경 없는 녹색 글자다 (FR-020). */}
        <span className="px text-[17px] text-accent-dark">{studies.length}</span>
        <span className="ml-auto flex gap-2">
          {SORTS.map(({ key, label }) => (
            <Link
              key={key}
              href={hrefFor(key)}
              aria-current={sort === key ? 'true' : undefined}
              className={
                // 선택 표시에 녹색을 쓰지 않는 유일한 자리다 — 활성은 검정, 비활성은
                // 배경·테두리·그림자가 모두 없다 (FR-005, interactions.md §3.3).
                sort === key
                  ? 'rounded-[7px] border-2 border-ink bg-ink px-[13px] py-1.5 text-[13px] font-bold text-white'
                  : 'rounded-[7px] border-2 border-transparent px-[13px] py-1.5 text-[13px] font-bold text-muted hover:text-accent-dark'
              }
            >
              {label}
            </Link>
          ))}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {studies.map((study) => (
          <StudyCard key={study.id} post={study} />
        ))}
        <EmptyState
          title="+ 새 스터디 개설하기"
          description={
            studies.length === 0 ? '첫 번째 리더가 되어 보세요' : '원하는 주제로 동료를 모집해요'
          }
          href="/create?type=STUDY"
        />
      </div>
    </section>
  );
}
