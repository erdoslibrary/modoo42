import Link from 'next/link';

// 빈 상태 안내 (spec FR-015). 디자인 원본의 점선 개설 카드다.
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
      <span className="px block text-[14px]">{title}</span>
      <span className="mt-1 block text-[12px] text-muted">{description}</span>
    </>
  );

  if (!href) {
    return (
      <div className="rounded-[10px] border-[2.5px] border-dashed border-ink/40 p-5 text-center">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-[10px] border-[2.5px] border-dashed border-ink/40 p-5 text-center text-ink transition-colors duration-100 hover:bg-accent-soft"
    >
      {body}
    </Link>
  );
}
