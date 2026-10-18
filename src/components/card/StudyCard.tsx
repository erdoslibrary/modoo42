import Link from 'next/link';
import { LeaderLine, MetaRow, StatusBadge, TagList } from '@/components/card/CardMeta';
import { cycleLabel, headcountLabel } from '@/lib/display';
import type { FeedPost } from '@/lib/view-types';

const LOCATION_LABEL: Record<string, string> = {
  ONLINE: '온라인',
  OFFLINE_GS: '경산 오프라인',
  OFFLINE_SEOUL: '서울 오프라인',
  OFFLINE_ETC: '오프라인',
  HYBRID: '온/오프라인 병행',
};

// 정규 스터디 카드 (spec FR-008). 카드에서 바로 참여하지 않는다 — [상세보기]가 모달을 연다
// (CLAUDE.md §6.2). 리더 횟수·완주율·42 인트라 뱃지는 표기하지 않는다 (spec FR-005).
export function StudyCard({ post }: { post: FeedPost }) {
  return (
    // min-height와 아래 flex-1 스페이서는 한 쌍이다 — 하나만 넣으면 카드 높이가 제각각이거나
    // [상세보기]가 뜬다 (FR-018, interactions.md §3.5).
    <article className="nb flex min-h-[296px] flex-col gap-3 rounded-[14px] border-[3px] bg-card px-6 pb-5 pt-6 [--nb-depth:5px]">
      <header className="flex items-start justify-between gap-2">
        <TagList tags={post.tags} />
        <StatusBadge status={post.status} />
      </header>

      <h3 className="text-[20px] font-extrabold leading-[1.35] tracking-[-0.5px]">{post.title}</h3>

      <LeaderLine leader={post.leader} />

      <div className="flex flex-col gap-1">
        <MetaRow label="스터디 기간" value={cycleLabel(post.endDate) ?? '미정'} />
        <MetaRow label="진행 방식" value={LOCATION_LABEL[post.locationType] ?? post.locationType} />
      </div>

      <div className="flex-1" />

      {/* 모집 현황만 하단 CTA 왼쪽으로 내린다 — 항목은 구현 쪽을 쓰고 배치만 원본을 따른다
          (FR-024, interactions.md §3.5). 원본의 `사이클`은 추가하지 않는다. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          모집 현황{' '}
          <b className="text-[15px] font-bold text-ink">
            {headcountLabel(post.currentMembers, post.maxMembers) ?? '-'}
          </b>
        </span>
        <Link
          href={`/dashboard?post=${post.id}`}
          scroll={false}
          // 세로 패딩 비대칭(위가 아래보다 2px 큼)은 픽셀 폰트 글리프의 광학 중심 보정이다
          // (interactions.md §3.3 주의 2). 굵게는 주지 않는다 — Galmuri11에 bold가 없다.
          className="nb px flex-none rounded-[9px] bg-accent px-4 pb-2.5 pt-3 text-center text-[14px] text-ink hover:bg-accent-hover"
        >
          상세보기 ↗
        </Link>
      </div>
    </article>
  );
}
