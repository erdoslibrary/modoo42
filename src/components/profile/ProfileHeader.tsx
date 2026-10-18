import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { ProfileView } from '@/lib/view-types';

// 프로필 헤더 (req FR-019, spec FR-038).
// 완주율·자기소개·관심 태그는 저장되는 데이터가 없어 만들지 않는다 (spec FR-005).
export function ProfileHeader({ profile }: { profile: ProfileView }) {
  return (
    <section className="nb rounded-[10px] bg-card p-5 [--nb-depth:4px]">
      <div className="flex items-center gap-3">
        <InitialBadge login={profile.login} size="profile" />
        <div className="min-w-0">
          <h1 className="px text-[26px] leading-tight">{profile.login}</h1>
          <div className="mt-1.5">
            <CampusBadge campus={profile.campus} />
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="nb rounded-lg bg-bg px-3 py-2.5 [--nb-depth:2px]">
          {/* 그림자색 #0d1409은 채택하지 않고 전역 #18181b를 유지한다 — 그림자색을 둘로 늘리면
              --nb-depth 한 변수로 깊이를 관리하는 구조가 깨진다 (findings.md 2-8e). */}
          <dd className="px text-[22px] leading-none text-accent-dark">{profile.completedCount}</dd>
          <dt className="mt-1.5 text-[11px] text-muted">완주 스터디</dt>
        </div>
        <div className="nb rounded-lg bg-bg px-3 py-2.5 [--nb-depth:2px]">
          <dd className="px text-[22px] leading-none text-accent-dark">{profile.leaderCount}</dd>
          <dt className="mt-1.5 text-[11px] text-muted">리더 횟수</dt>
        </div>
      </dl>
    </section>
  );
}
