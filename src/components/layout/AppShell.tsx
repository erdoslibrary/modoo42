import { Sidebar } from '@/components/layout/Sidebar';
import type { PublicUser } from '@/lib/public-user';

// 사이드바 + 메인 2열 셸.
// 두 폭 값은 서로 독립이다. 디자인 원본의 min-width:1280px는 옮기지 않지만
// (375px 1열 대응, spec SC-008·prd F0-3), max-width:1300px는 그대로 둔다 —
// 없으면 넓은 모니터에서 카드가 설계 폭보다 커진다 (interactions.md §3.5).
export function AppShell({
  me,
  active,
  children,
}: {
  me: PublicUser | null;
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar me={me} active={active} />
      <main className="mx-auto min-w-0 max-w-[1300px] flex-1 px-4 pb-10 pt-6 md:px-9 md:pb-14 md:pt-[30px]">
        {children}
      </main>
    </div>
  );
}
