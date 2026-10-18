import Link from 'next/link';
import { LeaderLine, StatusBadge, TagList } from '@/components/card/CardMeta';
import { ddayLabel, headcountLabel } from '@/lib/display';
import { toKstWall } from '@/lib/end-date';
import type { FeedPost } from '@/lib/view-types';

/** `10/14 마감 · 코엑스` 형태의 한 줄. 장소가 없으면 마감일만 쓴다. */
function deadlineLine(endDate: Date | null, place: string | null): string {
  const parts: string[] = [];
  if (endDate) {
    const wall = toKstWall(endDate);
    parts.push(`${wall.getUTCMonth() + 1}/${wall.getUTCDate()} 마감`);
  }
  if (place) parts.push(place);
  return parts.join(' · ');
}

// 단기 파티 카드 (spec FR-008). 마감일이 지난 파티는 조회에서 빠지므로(FR-020) 여기 오지 않는다.
export function PartyCard({ post, now }: { post: FeedPost; now: Date }) {
  return (
    <article className="nb flex w-[260px] flex-none flex-col gap-3 rounded-[10px] bg-card p-4 [--nb-depth:4px]">
      <header className="flex items-start justify-between gap-2">
        <TagList tags={post.tags} />
        {post.endDate ? (
          // 위험·취소가 아니라 잔여 기간 강조다. 액센트 축 밖이라 1색 규칙 위반이 아니다
          // (research.md R6). accent-bright는 선택 상태 전용이므로 비운다.
          <span className="px flex-none rounded-[5px] border-2 border-ink bg-dday pb-px pl-[9px] pr-[9px] pt-[3px] text-[13px] text-white">
            {ddayLabel(post.endDate, now)}
          </span>
        ) : (
          <StatusBadge status={post.status} />
        )}
      </header>

      <h3 className="px text-[14px] leading-snug">{post.title}</h3>

      <p className="text-[12px] text-muted">{deadlineLine(post.endDate, post.place)}</p>

      <div className="flex items-center justify-between gap-2">
        <LeaderLine leader={post.leader} />
        <span className="px flex-none text-[12px]">
          {headcountLabel(post.currentMembers, post.maxMembers)}
        </span>
      </div>

      <Link
        href={`/dashboard?post=${post.id}`}
        scroll={false}
        className="nb px block rounded-[9px] bg-accent px-4 pb-2.5 pt-3 text-center text-[14px] text-ink hover:bg-accent-hover"
      >
        상세보기 ↗
      </Link>
    </article>
  );
}
