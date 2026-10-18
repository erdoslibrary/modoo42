import Link from 'next/link';
import { PixelFrog } from '@/components/ui/PixelFrog';

// 빈 상태 안내 (spec FR-015). 디자인 원본의 점선 개설 카드다.
// 가로·세로 모두 중앙 정렬이고 바탕은 accent-soft의 45% 틴트다 — 토큰을 새로 만들지 않는다
// (FR-019, research.md R4).
const SHELL =
  'flex min-h-[296px] flex-col items-center justify-center gap-3 rounded-[14px] border-[3px] border-dashed border-ink p-5 text-center';
export function EmptyState({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  const body = (
    <>
      <PixelFrog size={42} />
      <span className="px block text-[15px] text-ink">{title}</span>
      <span className="block text-[13px] text-muted-soft">{description}</span>
    </>
  );

  if (!href) {
    return <div className={`${SHELL} bg-accent-soft/45`}>{body}</div>;
  }

  return (
    <Link
      href={href}
      className={`${SHELL} bg-accent-soft/45 text-accent-dark transition-colors duration-100 hover:bg-accent-soft`}
    >
      {body}
    </Link>
  );
}
