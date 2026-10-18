import { Sidebar } from '@/components/layout/Sidebar';
import type { PublicUser } from '@/lib/public-user';

// 사이드바 + 메인 2열 셸. 디자인 원본의 min-width:1280px는 옮기지 않는다 —
// 375px에서 1열로 접혀야 한다 (spec SC-008, prd F0-3).
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
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
