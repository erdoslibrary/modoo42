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
        // 글자 축 4단 (명도 순). ink → ink-soft(읽는 글) → muted(보조) → muted-soft(부속 메타).
        // 다섯 번째 단계를 늘리지 않는다 (contracts/design-tokens.md C1-2).
        muted: "#6b705c",
        "ink-soft": "#4b5040",
        "muted-soft": "#8a8f7a",
        // 표면·선. 태그 칩 무채 바탕·랭킹 4·5위 뱃지(surface), 카드 리더 패널(surface-bright),
        // 아카이브 목록 행 구분선(line).
        surface: "#eceedd",
        "surface-bright": "#F4F7E8",
        line: "#d8dcc6",
        // 액센트 축 밖이다. 남은 기간(dday)과 순위(medal-*)라는 별도 정보를 전달한다 (C1-4).
        dday: "#FF4D4F",
        "medal-gold": "#F5C518",
        "medal-silver": "#C9CDD4",
        "medal-bronze": "#CD7F32",
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
