import type { Config } from "tailwindcss";

// 디자인 토큰 (CLAUDE.md §10). 색은 디자인 원본 HTML이 쓰는 값을 그대로 이름 붙인 것이다.
// 녹색 계열은 명도 단계이며 상태·위계 표현에만 쓴다 (research.md R6).
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#EDEFE0",
        ink: "#18181b",
        accent: "#5FB63A",
        "accent-hover": "#6cc546",
        "accent-dark": "#3c7a1e",
        "accent-soft": "#E4F1D4",
        "accent-bright": "#9be06a",
        live: "#16a34a",
        sidebar: "#20301C",
        card: "#fffef7",
        muted: "#71717a",
      },
      fontFamily: {
        // 본문: Pretendard (한글 본문 가독성·숫자 정렬)
        sans: ["'Pretendard Variable'", "-apple-system", "sans-serif"],
        // 타이틀·로고: Galmuri11 (42 클러스터의 터미널·레트로 정서)
        px: ["'Galmuri11'", "'Pretendard Variable'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
