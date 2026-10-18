// 터미널 조회 안내 (FR-012). 디자인 원본 Dashboard.html 하단 블록.
export function CliFooter() {
  return (
    <footer className="nb flex flex-col gap-1 rounded-[10px] bg-sidebar p-4 text-white [--nb-depth:2px]">
      <code className="px text-[13px]">
        <span className="text-accent-bright">$</span> curl modoo42.com/api/list
      </code>
      <p className="text-[12px] text-[#aab49c]">터미널에서도 스터디 목록을 조회할 수 있어요</p>
    </footer>
  );
}
