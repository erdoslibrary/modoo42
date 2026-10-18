import type { Metadata } from "next";
import "./globals.css";
import { MockAuthModal } from "@/components/MockAuthModal";

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
  return (
    <html lang="ko">
      <body className="bg-bg font-sans text-ink antialiased">
        {children}
        <MockAuthModal />
      </body>
    </html>
  );
}
