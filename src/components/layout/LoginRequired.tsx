// 비로그인 안내 (spec FR-040). Phase 3에는 랜딩 게이트(FR-015, Phase 4)가 없으므로
// 빈 화면 대신 안내를 보여준다. Mock 전환 문구는 개발 환경에서만 렌더한다 (CLAUDE.md §6.1).
export function LoginRequired() {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <section className="nb mx-auto mt-10 max-w-[520px] rounded-[10px] bg-card p-6 [--nb-depth:4px]">
      <h1 className="px text-[18px]">로그인이 필요합니다</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        모집 중인 스터디와 지금 클러스터의 LIVE 핑은 로그인한 42 멤버에게만 보입니다.
      </p>
      {isDev && (
        <p className="mt-4 text-sm leading-relaxed">
          개발 환경에서는 화면 우하단의 <span className="font-bold">[🛠 Mock Auth]</span> 버튼으로
          페르소나를 골라 로그인할 수 있습니다.
        </p>
      )}
    </section>
  );
}
