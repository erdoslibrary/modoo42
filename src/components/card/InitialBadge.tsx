import { initials } from '@/lib/display';

// 이니셜 뱃지 (CLAUDE.md §7.2). 외부 프로필 이미지를 쓰지 않는 대신의 표시 수단이다.
const SIZES = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-14 w-14 text-[18px]',
} as const;

const TONES = {
  dark: 'bg-sidebar text-white',
  light: 'bg-white text-ink',
} as const;

export function InitialBadge({
  login,
  size = 'md',
  tone = 'dark',
}: {
  login: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`px grid flex-none place-items-center rounded-[7px] border-[2.5px] border-ink font-extrabold ${SIZES[size]} ${TONES[tone]}`}
      aria-hidden="true"
    >
      {initials(login)}
    </span>
  );
}
