// 터미널 조회 안내 (FR-012). 디자인 원본 Dashboard.html 하단 블록.
// 글꼴이 다른 유일한 자리다 — 고정폭 GalmuriMono를 쓴다. 본문의 Galmuri11(.px)은
// 가변폭이라 터미널 느낌이 나지 않는다 (FR-021, interactions.md §3.5).
// 박스는 폭을 채우지 않고, 안내 문구는 박스 밖 아래에 둔다.
const MONO = "'GalmuriMono','SFMono-Regular',Consolas,monospace";

export function CliFooter() {
  return (
    <footer className="flex flex-col items-start gap-1.5">
      <code
        className="nb w-fit min-w-[380px] max-w-full rounded-[9px] bg-sidebar px-4 py-3 text-[13px] text-[#cfe8bd]"
        style={{ fontFamily: MONO }}
      >
        <span className="text-accent-bright">$</span> curl modoo42.com/api/list
      </code>
      <p className="pl-0.5 text-[12px] text-muted-soft">
        터미널에서도 스터디 목록을 조회할 수 있어요
      </p>
    </footer>
  );
}
