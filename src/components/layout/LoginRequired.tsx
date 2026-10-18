// 비로그인 안내 (spec FR-040). FR-015 랜딩 게이트는 루트(/)에만 걸리므로, 대시보드에
// 직접 들어온 비로그인 유저에게는 이 안내와 로그인 입구를 보여준다.
// Mock 전환 문구는 개발 환경에서만 렌더한다 (CLAUDE.md §6.1).
export function LoginRequired() {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <section className="nb mx-auto mt-10 max-w-[520px] rounded-[10px] bg-card p-6 [--nb-depth:4px]">
      <h1 className="px text-[18px]">로그인이 필요합니다</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        모집 중인 스터디와 지금 클러스터의 LIVE 핑은 로그인한 42 멤버에게만 보입니다.
      </p>
      <a
        href="/api/auth/github"
        className="nb px mt-6 block rounded-[10px] bg-accent px-5 pb-[14px] pt-4 text-center text-[16px] text-ink [--nb-depth:4px]"
      >
        GitHub 계정으로 로그인
      </a>
      {isDev && (
        <p className="mt-4 text-sm leading-relaxed">
          개발 환경에서는 화면 우하단의 <span className="font-bold">[🛠 Mock Auth]</span> 버튼으로
          페르소나를 골라 로그인할 수도 있습니다.
        </p>
      )}
    </section>
  );
}
