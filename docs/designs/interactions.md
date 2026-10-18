---
description: "디자인 원본의 호버·누름 상태 값, 픽셀 폰트·치수·순위 뱃지 색, Phase 3 CSS 구현 지침"
---

# 호버·누름 상태 (Hover / Active)

디자인 원본 HTML은 dc 런타임 전용 속성 `style-hover` / `style-active`로 상태 변화를 기술했다. 이 속성은 표준 CSS가 아니므로 정적 렌더 과정에서 제거됐다. **이 문서가 그 값의 보관소다.** Phase 3에서 표준 CSS로 옮길 때 여기 값을 쓴다.

출처는 dc 템플릿 6개 파일이다. 서로 다른 값은 11종, 사용처는 총 35곳이다.

**§3.3~3.5는 호버·누름이 아니라 `FR-026`(디자인 정합성 복구)의 값 SSOT다.** 픽셀 폰트를 쓰는 자리와 치수, 순위 뱃지 색, 레이아웃 골격과 카드 치수가 거기 있다. 정적 렌더된 원본 HTML 실측이므로 포팅 시 그 숫자를 그대로 쓴다.

---

## 1. 누름 (`:active`) — 5종 / 18곳

버튼이 그림자 자리로 들어가면서 그림자가 사라진다. 종이 버튼이 눌려 바닥에 닿는 느낌을 만드는 장치다. 이동 거리는 평소 `box-shadow`의 offset과 **항상 같다.**

| 원본 값 | 사용처 | 평소 `box-shadow` |
| :--- | ---: | :--- |
| `transform:translate(2px,2px);box-shadow:none` | 9곳 | `2px 2px 0 #18181b` |
| `transform:translate(2px,2px);box-shadow:none;color:#fff` | 1곳 | 같음 |
| `transform:translate(3px,3px);box-shadow:none;color:#18181b` | 1곳 | `3px 3px 0 #18181b` |
| `transform:translate(4px,4px);box-shadow:none` | 4곳 | `4px 4px 0 #18181b` |
| `transform:translate(4px,4px);box-shadow:none;color:#18181b` | 3곳 | 같음 |

`color`를 다시 지정한 항목이 있는 이유는 dc 런타임이 호버 스타일과 누름 스타일을 합쳐 적용하기 때문이다. 호버에서 바뀐 글자색이 누름 상태에 남지 않도록 되돌린 값이다. **표준 CSS에서는 `:active`가 `:hover`보다 뒤에 선언되면 자동으로 이긴다. 따라서 이 `color` 재지정은 옮기지 않는다.**

## 2. 호버 (`:hover`) — 6종 / 17곳

| 원본 값 | 사용처 | 대상 |
| :--- | ---: | :--- |
| `background:#6cc546;color:#18181b` | 4곳 | 액센트 버튼 (`[+ 스터디 개설하기]`, `[참여하기 ↗]`). 평소 `#5FB63A` |
| `background:rgba(255,255,255,0.08);color:#fff` | 4곳 | 사이드바 메뉴 (비활성 항목) |
| `color:#3c7a1e` | 5곳 | 텍스트 링크 (명예의 전당 항목, `회고 읽기 ↗`) |
| `background:#E4F1D4` | 2곳 | 점선 테두리 개설 카드 |
| `background:#16a34a;color:#fff` | 1곳 | LIVE 핑 `[+ 핑 보내기]` |
| `color:#fff` | 1곳 | 푸터 복사 아이콘 |

---

## 3. Phase 3 구현 지침

### 3.1 깊이는 CSS 변수로 한 번만 정의한다

이동 거리가 2px / 3px / 4px 세 종류뿐이고 항상 `box-shadow` offset과 같다. 요소마다 `translate`를 적지 않고 변수 하나로 묶는다. `src/app/globals.css`에 넣는다.

```css
@layer components {
  /* 네오브루탈리즘 하드 섀도우 + 눌림. --nb-depth로 깊이만 바꿔 쓴다. */
  .nb {
    --nb-depth: 3px;
    border: 2.5px solid #18181b;
    box-shadow: var(--nb-depth) var(--nb-depth) 0 #18181b;
    transition: background-color 120ms, color 120ms;
  }
  .nb:active {
    transform: translate(var(--nb-depth), var(--nb-depth));
    box-shadow: none;
  }
}
```

사용처에서는 깊이만 덮어쓴다. Tailwind arbitrary property를 쓴다.

```tsx
<button className="nb [--nb-depth:4px] bg-[#5FB63A] hover:bg-[#6cc546]">+ 스터디 개설하기</button>
```

`transition`은 `background-color`와 `color`에만 걸고 120ms로 둔다. `transform`에는 걸지 않는다 — 누름 반응이 즉각적이어야 하고, `.claude/rules/anti-ai-slop.md`가 `transition`을 기능적 상태에만 150ms 이하로 제한한다.

### 3.2 호버는 Tailwind `hover:` 변종으로 충분하다

호버 6종은 전부 `background-color`와 `color` 한두 개만 바꾼다. 별도 클래스를 만들 필요가 없다.

| 대상 | Tailwind |
| :--- | :--- |
| 액센트 버튼 | `bg-[#5FB63A] hover:bg-[#6cc546]` |
| 사이드바 메뉴 | `hover:bg-white/[0.08] hover:text-white` |
| 텍스트 링크 | `hover:text-[#3c7a1e]` |
| 점선 개설 카드 | `hover:bg-[#E4F1D4]` |
| LIVE 버튼 | `bg-[#16a34a] hover:bg-[#16a34a] hover:text-white` |

### 3.3 픽셀 폰트(`px` = Galmuri11)를 쓰는 자리와 쓰지 않는 자리

`FR-026`의 값 SSOT다. 원본 HTML 실측이며, 치수는 그대로 따른다.

**쓰는 자리 — 버튼·탭·숫자 뱃지.**

| 대상 | 원본 값 |
| :--- | :--- |
| 카드 CTA (`참여하기 ↗`) | `background:#5FB63A;color:#18181b;font-size:14px;padding:12px 16px 10px;border-radius:9px;border:2.5px solid #18181b;box-shadow:3px 3px 0 #18181b` |
| 배너 CTA (`+ 스터디 개설하기`) | `background:#5FB63A;color:#18181b;font-size:16px;padding:16px 22px 14px;border-radius:10px;border:3px solid #18181b;box-shadow:4px 4px 0 #18181b;gap:8px` |
| 아카이브 탭 (활성) | `font-size:14px;padding:11px 12px 9px;border-radius:8px;border:2.5px solid #18181b;box-shadow:3px 3px 0 #18181b;background:#9be06a;color:#18181b` |
| 아카이브 탭 (비활성) | 치수 동일, `box-shadow:none;background:#fff` |
| LIVE `+ 핑 보내기` | `font-size:12px;color:#fff;background:#16a34a;border:2px solid #18181b;box-shadow:2px 2px 0 #18181b;padding:7px 12px 5px;border-radius:7px` |
| 이니셜 뱃지 (카드 `HL`) | `width:32px;height:32px;border-radius:6px;font-size:11px;font-weight:800;background:#20301C;color:#fff;border:2px solid #18181b` |
| 이니셜 뱃지 (아카이브 `GH`) | `width:34px;height:34px;border-radius:7px;font-size:12px;font-weight:800;background:#18181b;color:#fff;border:2px solid #18181b` |
| D-Day 칩 (파티 카드) | `font-size:13px;color:#fff;background:#FF4D4F;border:2px solid #18181b;padding:3px 9px 1px;border-radius:5px` |
| D-Day 칩 (배너, 대형) | `font-size:26px;padding:12px 16px 10px;border-radius:9px;border:3px solid #18181b;box-shadow:3px 3px 0 #18181b;background:#FF4D4F;color:#fff;line-height:1` |
| 섹션 제목 (`모집 중인 정규 스터디`) | `font-size:21px`, 뒤따르는 건수는 `color:#3c7a1e;font-size:17px` |

**쓰지 않는 자리 — Pretendard가 맞다.** 정렬 칩(아래 표), 상태 칩(`모집 중`, `font-size:11px;font-weight:800;background:#9be06a;border:2px solid #18181b;padding:2px 8px;border-radius:5px`), `LIVE` 칩, 태그 칩(`#코딩테스트`, `font-size:13px;font-weight:700;background:#eceedd;border:1.5px solid #18181b;padding:3px 9px;border-radius:6px`), 본문·설명·라벨.

**정렬 칩(`최신순`·`마감임박순`)은 녹색을 쓰지 않는다.** 선택 상태를 검정으로 표시하는 유일한 자리다 (`Dashboard.html:2869~2870`).

| 상태 | 원본 값 |
| :--- | :--- |
| 활성 | `background:#18181b;color:#fff;padding:6px 13px;border-radius:7px;border:2px solid #18181b`, `box-shadow` 없음 |
| 비활성 | `color:#6b705c;padding:6px 13px;border:2px solid transparent`, 배경·그림자 없음 |

**태그 칩은 첫 번째만 색이 다르다.** 첫 태그는 `color:#3c7a1e;background:#E4F1D4;border:1.5px solid #3c7a1e`이고 나머지는 위의 무채 값이다. 대표 주제를 앞세우는 표기다.

**세 가지 주의.**

1. **버튼·탭에는 `font-weight`를 주지 않는다.** Galmuri11에 bold가 없어 브라우저 합성 굵게가 픽셀을 뭉갠다. 원본의 버튼·탭도 `font-weight`를 쓰지 않는다. **단, 이니셜 뱃지는 원본이 `font-weight:800`을 쓴다** — 1~2글자 대문자라 합성 굵게가 눈에 띄지 않는다. 뱃지에서만 유지하고 버튼·탭으로 옮기지 않는다.
2. **세로 패딩 비대칭은 오타가 아니다.** `12px 16px 10px`처럼 위가 아래보다 2px 크다. 픽셀 폰트 글리프가 박스 안에서 높이 앉기 때문에 광학 중심을 맞추는 보정이다. 그대로 따른다.
3. **Tailwind의 `px-3`은 가로 패딩 유틸이고 폰트 클래스 `px`와 다른 것이다.** 이름만 같다. `px`를 검색할 때 걸러낸다.

### 3.4 랭킹 순위 뱃지 색

`FR-010`이 명시한 골드/실버/브론즈의 실제 값이다. 1~3위만 색을 쓰고 4·5위는 무채 표면색이다. 치수는 다섯 자리 모두 같다.

| 순위 | 원본 값 |
| ---: | :--- |
| 1 | `background:#F5C518;color:#18181b` |
| 2 | `background:#C9CDD4;color:#18181b` |
| 3 | `background:#CD7F32;color:#18181b` |
| 4·5 | `background:#eceedd;color:#6b705c` |

공통: `width:26px;height:26px;border-radius:6px;font-size:13px;border:2px solid #18181b`, `box-shadow` 없음, 클래스 `px`.

**행 박스는 채택하지 않는다** (2026-10-18 사용자 결정). 원본은 1~3위 행에 `background:#F4F7E8;border:2.5px solid #18181b;border-radius:8px;box-shadow:3px 3px 0 #18181b;padding:11px 12px`를 씌우고 4·5위는 투명하게 둬서 상위 3명을 **메달 색과 박스 유무로 두 번** 구분한다. 구현은 **메달 색만 쓰고 다섯 행을 같은 맨 줄로 둔다.** 뱃지 색 하나로 충분하고 박스를 넣으면 랭킹이 무거워진다는 판단이다. 기록만 남긴다.

### 3.5 레이아웃 골격과 카드 치수

`FR-026`의 값 SSOT다. 원본 `Dashboard.html` 실측이다.

**본문 폭.** `<main>`은 `padding:30px 36px 56px;max-width:1300px;width:100%`다 (`:2412`). **`max-width`를 반드시 둔다** — 없으면 넓은 모니터에서 카드가 설계 폭보다 한참 커진다. 루트의 `min-width:1280px`는 옮기지 않는다(375px 1열 대응, `prd.md` F0-3). 두 값은 서로 독립이므로 `min-width`를 뺀다고 `max-width`까지 뺄 이유가 없다.

**대시보드 세로 순서.** 섹션 간격은 `gap:34px`다.

| 순 | 블록 | 폭 |
| ---: | :--- | :--- |
| 1 | LIVE 전광판 | 전체 |
| 2 | 단기 파티 레일 | 전체 |
| 3 | 모집 중인 정규 스터디 그리드 | 전체, `repeat(3,minmax(0,1fr));gap:22px` 고정 3열 |
| 4 | 아카이브(🏆/🪦) + 성실 멤버 랭킹 | `grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px` |
| 5 | CLI 푸터 | 전체, `align-items:flex-start` |

**랭킹은 스터디 그리드의 사이드바가 아니다.** 아카이브 카드와 같은 행의 오른쪽 1fr이다. CLI 푸터는 그 아래 독립 블록이고 좌측 정렬이다.

**스터디 카드.** `background:#fffef7;border:3px solid #18181b;border-radius:14px;padding:24px 24px 20px;min-height:296px;display:flex;flex-direction:column;box-shadow:5px 5px 0 #18181b`.

CTA는 **항상 카드 바닥에 붙는다.** 원본은 메타 블록과 하단 행 사이에 `<div style="flex:1"></div>` 스페이서를 넣어 밀어낸다. `min-height:296px`와 한 쌍이라 제목 줄 수가 달라도 버튼 높이가 어긋나지 않는다.

| 자리 | 원본 값 |
| :--- | :--- |
| 카드 제목 | `font-size:20px;font-weight:800;line-height:1.35;letter-spacing:-0.5px;margin:16px 0 0` |
| 리더 블록 | `padding:10px 12px;background:#F4F7E8;border:2px solid #18181b;border-radius:9px;gap:10px`. 이름 14px/800, 부제 12px `#6b705c`, 우측 20px 원형 `✓`(`background:#5FB63A;border:2px solid #18181b;font-size:11px;font-weight:800`) |
| 메타 줄 | `font-size:13px;color:#6b705c`, 값은 `color:#18181b;font-weight:700` |
| 하단 좌측 수치 | `font-size:13px;color:#6b705c`, 인원 수는 `font-size:15px;color:#18181b` |

**리더 블록의 `✓`는 42 인증 완료 표시로 쓴다** (2026-10-18 사용자 결정). 원본은 부제 `42 인트라 · 리더 4회`와 `✓`를 함께 두는데, 구현에는 `campus`밖에 없으므로 **`campus !== null`일 때만 렌더한다.** 캠퍼스 뱃지와 같은 정보를 두 번 전달하지만 원본이 그렇게 하므로 따른다. 리더 횟수는 표기하지 않는다 (`spec FR-005`).

**카드 메타 항목은 구현 쪽을 쓰고 배치만 원본을 따른다** (2026-10-18 사용자 결정). `스터디 기간`·`진행 방식`은 메타 영역에 남기고 **`모집 현황`만 하단 CTA 왼쪽으로 내린다.** 원본의 `사이클`은 추가하지 않고, 원본에 없는 `진행 방식`은 유지한다 — 온/오프라인 구분이 참여 판단에 쓰인다.

**개설 카드 (점선).** `border:3px dashed #18181b;border-radius:14px;min-height:296px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#3c7a1e;background:rgba(228,241,212,0.45)` (`:3322`).

가로·세로 모두 중앙 정렬이다. 안에 **42px 픽셀 개구리 SVG** → 제목(`px` 15px `#18181b`) → 설명(13px `#8a8f7a`) 순으로 들어간다.

**섹션 제목.** `h2.px` `font-size:21px;display:flex;align-items:baseline;gap:8px`이고, 뒤따르는 건수는 **테두리·배경 없는 글자**다 — `color:#3c7a1e;font-size:17px` (`:2867`). 건수에 칩이나 박스를 씌우지 않는다.

**CLI 푸터.** 박스는 `background:#20301C;border:2.5px solid #18181b;border-radius:9px;box-shadow:3px 3px 0 #18181b;padding:12px 16px;font-size:13px;min-width:380px`이고 폭을 채우지 않는다. 안내 문구는 박스 **밖 아래**에 `font-size:12px;color:#8a8f7a;padding-left:2px`로 둔다.

**글꼴이 다른 유일한 자리다.** CLI 푸터는 `font-family:'GalmuriMono','SFMono-Regular',Consolas,monospace`로 **고정폭** 픽셀 폰트를 쓴다. 본문의 Galmuri11(`.px`)은 가변폭이라 터미널 느낌이 나지 않는다. CDN은 `GalmuriMono11`이라는 이름으로 배포하므로 별칭 `@font-face`가 필요하다.

```css
@font-face{font-family:'GalmuriMono';font-style:normal;font-weight:400;font-display:swap;
  src:local('GalmuriMono11 Regular'),
      url('https://cdn.jsdelivr.net/gh/quiple/galmuri@2.40.4/dist/GalmuriMono11.woff2') format('woff2')}
```

### 3.6 하지 말 것

- 요소마다 `style-hover` 값을 인라인 `style`로 옮기지 않는다. 인라인 스타일로는 `:hover`를 표현할 수 없다.
- `:active`에 `transition`을 걸지 않는다.
- 이동 거리와 `box-shadow` offset을 다르게 두지 않는다. 어긋나면 버튼이 바닥에 닿지 않고 떠 보인다.

---

## 4. 규칙과의 관계

`.claude/rules/anti-ai-slop.md`는 "hover 시 `transform`"을 금지한다. 위 구현은 **`:active`에만** `transform`을 쓰므로 그 금지에 해당하지 않는다. `:active` 변화는 "클릭이 먹었다"는 피드백을 전달하는 기능적 상태다. `CLAUDE.md` §10 "규칙 해석"에 예외로 등재돼 있다.

`:hover`에 `transform`을 쓰는 것은 여전히 금지다.
