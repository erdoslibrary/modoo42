import Link from 'next/link';

// STEP 1 유형 선택 (spec FR-025). ?type= 쿼리로 가르므로 새로고침·공유에도 유형이 유지된다.
const TYPES = [
  { key: 'STUDY', label: '정규 스터디', hint: '1~3개월 긴 호흡. 월 단위 사이클.' },
  { key: 'PARTY', label: '단기 파티', hint: '컨퍼런스·해커톤. D-Day 기반.' },
  { key: 'LIVE', label: '지금 클러스터', hint: '30분~3시간 초단기 호출. LIVE.' },
] as const;

export type CreateType = (typeof TYPES)[number]['key'];

export function TypeSwitch({ active }: { active: CreateType }) {
  return (
    <section>
      <h2 className="px text-[12px] text-muted">STEP 1 · 어떤 유형인가요?</h2>
      <nav aria-label="개설 유형" className="mt-2 grid gap-2 sm:grid-cols-3">
        {TYPES.map(({ key, label, hint }) => (
          <Link
            key={key}
            href={`/create?type=${key}`}
            aria-current={active === key ? 'true' : undefined}
            className={
              // 선택된 카드는 accent-soft다 (FR-001). 선택 표시는 우상단 원형 ✓ 칩이 맡는다.
              active === key
                ? 'nb relative rounded-lg bg-accent-soft px-3 py-2.5 [--nb-depth:3px]'
                : 'nb relative rounded-lg bg-white px-3 py-2.5 hover:bg-accent-soft [--nb-depth:3px]'
            }
          >
            {active === key && (
              <span
                aria-hidden
                className="absolute right-2.5 top-2.5 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-ink bg-accent text-[12px] font-extrabold text-ink"
              >
                ✓
              </span>
            )}
            <span className="px block text-[15px]">{label}</span>
            <span className="mt-0.5 block text-[11px] text-muted">{hint}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
