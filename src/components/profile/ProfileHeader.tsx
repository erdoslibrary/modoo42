import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { ProfileView } from '@/lib/view-types';

// 프로필 헤더 (req FR-019, spec FR-038).
// 완주율·자기소개·관심 태그는 저장되는 데이터가 없어 만들지 않는다 (spec FR-005).
export function ProfileHeader({ profile }: { profile: ProfileView }) {
  return (
    <section className="nb rounded-[10px] bg-card p-5 [--nb-depth:4px]">
      <div className="flex items-center gap-3">
        <InitialBadge login={profile.login} size="lg" />
        <div className="min-w-0">
          <h1 className="px text-[18px] leading-tight">{profile.login}</h1>
          <div className="mt-1.5">
            <CampusBadge campus={profile.campus} />
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="nb rounded-lg bg-bg px-3 py-2.5 [--nb-depth:2px]">
          <dd className="px text-[20px] leading-none">{profile.completedCount}</dd>
          <dt className="mt-1.5 text-[11px] text-muted">완주 스터디</dt>
        </div>
        <div className="nb rounded-lg bg-bg px-3 py-2.5 [--nb-depth:2px]">
          <dd className="px text-[20px] leading-none">{profile.leaderCount}</dd>
          <dt className="mt-1.5 text-[11px] text-muted">리더 횟수</dt>
        </div>
      </dl>
    </section>
  );
}
