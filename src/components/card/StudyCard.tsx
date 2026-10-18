import Link from 'next/link';
import { LeaderLine, MetaRow, StatusBadge, TagList } from '@/components/card/CardMeta';
import { cycleLabel, headcountLabel } from '@/lib/display';
import type { FeedPost } from '@/lib/view-types';

const LOCATION_LABEL: Record<string, string> = {
  ONLINE: '온라인',
  OFFLINE_GS: '경산 오프라인',
  OFFLINE_SEOUL: '서울 오프라인',
  OFFLINE_ETC: '오프라인',
  HYBRID: '온·오프라인',
};

// 정규 스터디 카드 (spec FR-008). 카드에서 바로 참여하지 않는다 — [상세보기]가 모달을 연다
// (CLAUDE.md §6.2). 리더 횟수·완주율·42 인트라 뱃지는 표기하지 않는다 (spec FR-005).
export function StudyCard({ post }: { post: FeedPost }) {
  return (
    <article className="nb flex flex-col gap-3 rounded-[10px] bg-card p-4 [--nb-depth:4px]">
      <header className="flex items-start justify-between gap-2">
        <TagList tags={post.tags} />
        <StatusBadge status={post.status} />
      </header>

      <h3 className="px text-[15px] leading-snug">{post.title}</h3>

      <LeaderLine leader={post.leader} />

      <div className="flex flex-col gap-1 border-t-[1.5px] border-ink/15 pt-3">
        <MetaRow label="스터디 기간" value={cycleLabel(post.endDate) ?? '미정'} />
        <MetaRow label="모집 현황" value={headcountLabel(post.currentMembers, post.maxMembers) ?? '-'} />
        <MetaRow label="진행 방식" value={LOCATION_LABEL[post.locationType] ?? post.locationType} />
      </div>

      <Link
        href={`/dashboard?post=${post.id}`}
        scroll={false}
        className="nb block rounded-lg bg-accent px-3 py-2 text-center text-[13px] font-bold text-ink hover:bg-accent-hover"
      >
        상세보기 ↗
      </Link>
    </article>
  );
}
