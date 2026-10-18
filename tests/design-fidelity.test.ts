import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import tailwindConfig from '../tailwind.config';

// Test Suite 9 (TC-DESIGN-01~04). 값의 SSOT는 docs/designs/interactions.md §3.3~3.5다.
// 소스 문자열 정적 단정이며 jsdom·testing-library를 쓰지 않는다 — Tailwind 클래스는
// 빌드 타임에 CSS로 바뀌어 렌더해도 계산된 색·크기가 나오지 않는다 (research.md R2).
// "클래스가 적혀 있다"까지만 보증하고 시각적 일치는 quickstart.md의 수동 대조가 맡는다.
const ROOT = join(__dirname, '..');

/** 저장소 기준 상대 경로를 읽는다. */
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

/** 줄바꿈·들여쓰기가 바뀌어도 매칭이 깨지지 않게 공백을 1칸으로 접는다 (R2 규칙 3). */
function fold(src: string): string {
  return src.replace(/\s+/g, ' ');
}

/**
 * 폰트 클래스 `px`(Galmuri11) 판정. Tailwind 가로 패딩 유틸 `px-3`·`px-4`는
 * `-`가 뒤따르므로 걸러진다 (interactions.md §3.3 주의 3).
 */
function hasPxFont(text: string): boolean {
  return /(?:^|\s)px(?=\s|$)/.test(text);
}

/**
 * 고유 리터럴을 앵커로 삼아 **그 앞의 가장 가까운 `className`부터** 잘라낸다 (R2 규칙 1).
 * JSX는 `className=...>{자식}` 순서라 버튼·칩의 클래스는 항상 텍스트 앞에 있고,
 * 가장 가까운 하나만 자르면 형제 요소나 주석의 클래스가 섞이지 않는다.
 */
function classesBefore(rel: string, anchor: string): string {
  const folded = fold(read(rel));
  const at = folded.indexOf(anchor);
  expect(at, `${rel}에서 앵커 "${anchor}"를 찾지 못했다`).toBeGreaterThan(-1);
  expect(folded.indexOf(anchor, at + 1), `${rel}의 앵커 "${anchor}"가 2곳 이상이다`).toBe(-1);
  const head = folded.slice(0, at);
  const start = head.lastIndexOf('className');
  expect(start, `${rel}의 앵커 "${anchor}" 앞에 className이 없다`).toBeGreaterThan(-1);
  return head.slice(start);
}

/** `src/` 전체와 설정 파일에서 문자열 등장 횟수를 센다. */
function occurrences(needle: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (readFileSync(full, 'utf8').includes(needle)) hits.push(full);
    }
  };
  walk(join(ROOT, 'src'));
  if (read('tailwind.config.ts').includes(needle)) hits.push('tailwind.config.ts');
  return hits;
}

const colors = (tailwindConfig.theme?.extend?.colors ?? {}) as Record<string, string>;

describe('TC-DESIGN-01: 토큰 교정·신설 (FR-006·FR-007)', () => {
  it('muted가 올리브(#6b705c)이고 #71717a는 저장소에 0건이다', () => {
    expect(colors.muted).toBe('#6b705c');
    expect(occurrences('#71717a')).toEqual([]);
  });

  it('신설 토큰 9개가 정확한 값으로 존재한다', () => {
    expect(colors['ink-soft']).toBe('#4b5040');
    expect(colors['muted-soft']).toBe('#8a8f7a');
    expect(colors.surface).toBe('#eceedd');
    expect(colors['surface-bright']).toBe('#F4F7E8');
    expect(colors.line).toBe('#d8dcc6');
    expect(colors.dday).toBe('#FF4D4F');
    expect(colors['medal-gold']).toBe('#F5C518');
    expect(colors['medal-silver']).toBe('#C9CDD4');
    expect(colors['medal-bronze']).toBe('#CD7F32');
  });

  it('글자 축은 정확히 4단이고 다섯 번째가 없다', () => {
    const textAxis = Object.keys(colors).filter((name) =>
      ['ink', 'ink-soft', 'muted', 'muted-soft'].includes(name),
    );
    expect(textAxis.sort()).toEqual(['ink', 'ink-soft', 'muted', 'muted-soft']);
    expect(Object.keys(colors).filter((n) => /^(ink|muted)-/.test(n)).sort()).toEqual([
      'ink-soft',
      'muted-soft',
    ]);
  });
});

// 액센트 버튼·탭. `JoinConfirmDialog`가 2곳, `LeaderActions`가 3곳이라 자리 수가 파일 수보다 많다.
// CompletionModal은 007b가 이미 적용했으므로 대상이 아니다 (FR-008).
const ACCENT_BUTTONS: [string, string][] = [
  ['src/components/card/StudyCard.tsx', '상세보기 ↗'],
  ['src/components/card/PartyCard.tsx', '상세보기 ↗'],
  ['src/components/detail/PostDetailModal.tsx', '오픈채팅 바로가기 ↗'],
  ['src/components/detail/JoinConfirmDialog.tsx', '참여하기 ↗'],
  ['src/components/detail/JoinConfirmDialog.tsx', ": '확인'"],
  ['src/components/detail/LeaderActions.tsx', '{completionState.entryLabel}'],
  ['src/components/detail/LeaderActions.tsx', ": '저장'"],
  ['src/components/detail/LeaderActions.tsx', ": '취소 확정'"],
  ['src/components/create/RecruitForm.tsx', ": '개설하기'"],
  ['src/components/create/LivePingForm.tsx', ": '핑 보내기'"],
  ['src/components/feed/ArchiveTabs.tsx', '{label}'],
  ['src/components/feed/LivePingBoard.tsx', '+ 핑 보내기'],
];

// 한글 문구 칩·라벨·텍스트 링크. 버튼 규칙을 여기까지 넓히지 않는다 (FR-009).
const PRETENDARD_SLOTS: [string, string][] = [
  ['src/components/feed/StudyGrid.tsx', '{label}'],
  ['src/components/card/CardMeta.tsx', '{STATUS_LABEL[status] ?? status}'],
  ['src/components/card/CardMeta.tsx', '#{tag}'],
  ['src/components/card/CardMeta.tsx', '{label}'],
  ['src/components/feed/ArchiveTabs.tsx', '결과물 ↗'],
];

describe('TC-DESIGN-02: 액센트 버튼·탭에 픽셀 폰트 (FR-008)', () => {
  it.each(ACCENT_BUTTONS)('%s — %s 에 px가 있고 font-bold가 없다', (file, anchor) => {
    const classes = classesBefore(file, anchor);
    expect(hasPxFont(classes), `${anchor}: px 폰트 클래스가 없다`).toBe(true);
    // Galmuri11에 bold가 없어 합성 굵게가 픽셀을 뭉갠다 (interactions.md §3.3 주의 1).
    expect(classes, `${anchor}: font-bold가 남아 있다`).not.toMatch(/font-bold/);
  });
});

describe('TC-DESIGN-03: 칩·라벨·텍스트 링크는 Pretendard (FR-009)', () => {
  it.each(PRETENDARD_SLOTS)('%s — %s 에 px가 없다', (file, anchor) => {
    expect(hasPxFont(classesBefore(file, anchor)), `${anchor}: px가 붙어 있다`).toBe(false);
  });
});

describe('TC-DESIGN-04: 본문 폭과 고정폭 글꼴 선언 (FR-016·FR-021)', () => {
  it('<main>이 최대 폭 1300px이고 가운데 정렬이다', () => {
    const main = fold(read('src/components/layout/AppShell.tsx'));
    const at = main.indexOf('<main');
    expect(at).toBeGreaterThan(-1);
    const tag = main.slice(at, main.indexOf('>', at));
    expect(tag).toMatch(/max-w-\[1300px\]/);
    expect(tag).toMatch(/mx-auto/);
  });

  it('globals.css에 GalmuriMono @font-face 선언이 있다', () => {
    const css = fold(read('src/app/globals.css'));
    expect(css).toMatch(/@font-face\{?[^}]*font-family: ?'GalmuriMono'/);
  });

  it('CliFooter가 GalmuriMono 고정폭을 쓴다', () => {
    expect(read('src/components/feed/CliFooter.tsx')).toContain('GalmuriMono');
  });
});
