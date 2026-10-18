import Link from 'next/link';
import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { PublicUser } from '@/lib/public-user';

// 사이드바 (spec FR-039). 하위 목록 화면을 따로 만들지 않고 대시보드 섹션 앵커로 이동한다
// (research.md R12). 개구리 도감 항목은 범위 밖이라 만들지 않는다 (req §1.3).
const MENU = [
  { href: '/dashboard', label: '대시보드', icon: 'grid' },
  { href: '/dashboard#studies', label: '정규 스터디', icon: 'book' },
  { href: '/dashboard#parties', label: '단기 파티', icon: 'bolt' },
  { href: '/dashboard#archive', label: '명예의 전당', icon: 'trophy' },
] as const;

const ICONS: Record<(typeof MENU)[number]['icon'], string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  book: 'M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5M9 8h6',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  trophy: 'M8 4h8v6a4 4 0 01-8 0zM8 6H4v1a3 3 0 003 3M16 6h4v1a3 3 0 01-3 3M12 14v4M8 21h8',
};

export function Sidebar({ me, active = '/dashboard' }: { me: PublicUser | null; active?: string }) {
  return (
    <aside className="flex w-full flex-none flex-col border-b-[3px] border-ink bg-sidebar px-4 pb-4 pt-6 text-white md:sticky md:top-0 md:h-screen md:w-[252px] md:border-b-0 md:border-r-[3px]">
      <Link href="/dashboard" className="flex items-center gap-3 px-1.5 pb-7 text-white">
        <span className="px grid h-[38px] w-[38px] place-items-center rounded-[7px] border-[2.5px] border-ink bg-white text-[15px] font-extrabold text-ink shadow-[2px_2px_0_#18181b]">
          42
        </span>
        <span className="px text-base leading-tight tracking-[0.3px]">모두의 42</span>
      </Link>

      <nav className="flex flex-col gap-1.5">
        {MENU.map(({ href, label, icon }) => {
          const isActive = href === active;
          return (
            <Link
              key={href}
              href={href}
              className={
                isActive
                  ? 'flex items-center gap-3 rounded-lg border-[2.5px] border-ink bg-accent-bright px-3 py-2.5 text-[15px] font-bold text-ink'
                  : 'flex items-center gap-3 rounded-lg border-[2.5px] border-transparent px-3 py-2.5 text-[15px] font-bold text-[#aab49c] transition-colors duration-100 hover:bg-white/[0.08] hover:text-white'
              }
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={ICONS[icon]} />
              </svg>
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {me ? (
        <Link
          href="/profile"
          className="nb mt-6 block rounded-[10px] bg-card px-3 py-3 text-ink hover:bg-accent-soft"
        >
          <span className="flex items-center gap-2.5">
            <InitialBadge login={me.login} />
            <span className="min-w-0 leading-tight">
              <span className="px block text-[14px]">{me.login}</span>
              <span className="mt-1 block">
                <CampusBadge campus={me.campus} />
              </span>
            </span>
          </span>
        </Link>
      ) : (
        <p className="mt-6 text-[12px] text-[#aab49c]">로그인하면 내 기록을 볼 수 있습니다.</p>
      )}
    </aside>
  );
}
