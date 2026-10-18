import { InitialBadge } from '@/components/card/InitialBadge';
import { CampusBadge } from '@/components/card/CampusBadge';
import type { PublicUser } from '@/lib/public-user';

// 참여자 목록 (spec FR-017). 외부 프로필 이미지를 쓰지 않고 이니셜 뱃지만 쓴다 (CLAUDE.md §7.2).
// 기수 표기는 담을 컬럼이 없어 생략한다 (req §1.3).
export function ParticipantList({
  participants,
  leaderLogin,
  maxMembers,
}: {
  participants: PublicUser[];
  leaderLogin: string;
  maxMembers: number | null;
}) {
  const emptySeats = maxMembers === null ? 0 : Math.max(0, maxMembers - participants.length);

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline gap-2">
        <h3 className="px text-[14px]">참여자</h3>
        <span className="text-[12px] text-muted">
          {maxMembers === null
            ? `${participants.length}명`
            : `${participants.length} / ${maxMembers}명${emptySeats > 0 ? ` · ${emptySeats}자리 남음` : ''}`}
        </span>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {participants.map((p) => (
          <li key={p.login} className="flex items-center gap-2">
            <InitialBadge login={p.login} size="sm" />
            <span className="min-w-0 leading-tight">
              <span className="px block truncate text-[13px]">{p.login}</span>
              <CampusBadge campus={p.campus} />
            </span>
            {p.login === leaderLogin && (
              <span className="ml-auto rounded-[5px] border-[1.5px] border-ink bg-accent-soft px-1.5 text-[11px] font-bold">
                리더
              </span>
            )}
          </li>
        ))}

        {Array.from({ length: emptySeats }, (_, i) => (
          <li
            key={`empty-${i}`}
            className="flex items-center gap-2 rounded-lg border-[2px] border-dashed border-ink/30 px-2 py-1 text-[12px] text-muted"
          >
            + 빈 자리
          </li>
        ))}
      </ul>
    </section>
  );
}
