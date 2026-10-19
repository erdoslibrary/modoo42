// 프로필 화면 (req FR-019). 서버 컴포넌트가 getProfile을 직접 부른다 (research R1).
// 개구리 도감·무지개 개구리 도감·획득 배지 섹션은 만들지 않는다 — 수여 규칙과 저장 스키마가
// 미정이라 requirement.md §1.3 보류다 (spec FR-005).
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { LoginRequired } from '@/components/layout/LoginRequired';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { HistoryList } from '@/components/profile/HistoryList';
import { getCurrentUser } from '@/lib/auth';
import { requestDatabase } from '@/lib/dev/sandbox';
import { getProfile } from '@/lib/profile';

// 세션마다 내용이 다르므로 정적 프리렌더 대상이 아니다.
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) {
    return (
      <AppShell me={null} active="/profile">
        <LoginRequired />
      </AppShell>
    );
  }

  const profile = await getProfile(me.id, requestDatabase());

  return (
    <AppShell me={profile} active="/profile">
      <div className="mx-auto flex max-w-[620px] flex-col gap-6">
        <Link href="/dashboard" className="text-[12px] font-bold hover:text-accent-dark">
          ← 대시보드
        </Link>
        <ProfileHeader profile={profile} />
        <HistoryList history={profile.history} />
      </div>
    </AppShell>
  );
}
