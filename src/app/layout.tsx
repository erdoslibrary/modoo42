import type { Metadata } from "next";
import "./globals.css";
import { ClockProvider } from "@/components/dev/ClockProvider";
import { DevConsole } from "@/components/dev/DevConsole";
import { serverOffsetMs } from "@/lib/clock";

// 폰트는 globals.css의 CDN @import로 불러온다 (research.md R5).
export const metadata: Metadata = {
  title: "모두의 42",
  description: "42 멤버의 스터디·단기 파티·LIVE 핑 모집과 완주 기록 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 게이트가 닫힌 환경에서는 serverOffsetMs()가 쿠키를 **읽지 않고** 0을 반환한다 —
  // 루트 레이아웃에서 cookies()를 건드리면 상용에서도 모든 페이지가 동적 렌더로 바뀐다
  // (FR-027, research.md R10).
  const offsetMs = serverOffsetMs();

  return (
    <html lang="ko">
      <body className="bg-bg font-sans text-ink antialiased">
        <ClockProvider offsetMs={offsetMs}>
          {children}
          <DevConsole />
        </ClockProvider>
      </body>
    </html>
  );
}
