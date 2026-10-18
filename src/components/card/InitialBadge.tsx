import { initials } from '@/lib/display';

// 이니셜 뱃지 (CLAUDE.md §7.2). 외부 프로필 이미지를 쓰지 않는 대신의 표시 수단이다.
// 자리별 치수는 원본 실측값이다 (FR-013, findings.md 2-6b). 배경색은 dark·light 2종을
// 유지한다 — 원본은 사람마다 색이 다르지만 색이 사람을 식별하지 못하고 「색은 의미에만」에 걸린다.
const SIZES = {
  card: 'h-8 w-8 rounded-[6px] border-2 text-[11px]',
  list: 'h-[34px] w-[34px] rounded-[7px] border-2 text-[12px]',
  // 완주 판정 멤버 목록. 원본 대조 전까지 007b가 쓰던 28px를 그대로 둔다 (T059 울타리).
  compact: 'h-7 w-7 rounded-[7px] border-[2.5px] text-[11px]',
  sidebar: 'h-9 w-9 rounded-[7px] border-[2.5px] text-[13px]',
  leader: 'h-[52px] w-[52px] rounded-[10px] border-[2.5px] text-[15px]',
  profile: 'h-[84px] w-[84px] rounded-[14px] border-[3px] text-[30px]',
} as const;

const TONES = {
  dark: 'bg-sidebar text-white',
  light: 'bg-white text-ink',
} as const;

export function InitialBadge({
  login,
  size = 'sidebar',
  tone = 'dark',
}: {
  login: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      // 숫자·대문자 약어 뱃지만 px와 font-weight:800을 함께 쓴다 — 이 예외를 버튼·탭으로
      // 옮기지 않는다 (FR-009, interactions.md §3.3 주의 1).
      className={`px grid flex-none place-items-center border-ink font-extrabold ${SIZES[size]} ${TONES[tone]}`}
      aria-hidden="true"
    >
      {initials(login)}
    </span>
  );
}
