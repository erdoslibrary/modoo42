# Data Model: 디자인 원본 대비 포팅 정합성 복구 (008)

**Branch**: `008-design-fidelity` | **Date**: 2026-10-18

**이 작업에는 DB 엔티티 변경이 없다.** 마이그레이션 0건, `src/db/schema.ts` 무변경, API 응답 계약 무변경(`FR-015`). 아래는 그 대신 이번 작업이 다루는 **디자인 토큰과 클래스 자리**의 모델이다. 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5이고 여기에는 **구조와 이름**만 적는다.

---

## 1. 색 토큰 (`tailwind.config.ts`의 `theme.extend.colors`)

### 1.1 교정 1건

| 토큰 | 현재 | 변경 후 | 근거 |
| :--- | :--- | :--- | :--- |
| `muted` | `#71717a` | `#6b705c` | `FR-006`. `text-muted` 51곳이 따라온다 |

### 1.2 신설 9개

| 토큰 | 값 | 축 | 쓰임 |
| :--- | :--- | :--- | :--- |
| `ink-soft` | `#4b5040` | 글자 | 본문 단락(스터디 소개·회고 본문) |
| `muted-soft` | `#8a8f7a` | 글자 | 부속 메타(날짜·인원·부제) |
| `surface` | `#eceedd` | 표면 | 태그 칩 무채 바탕, 랭킹 4·5위 뱃지 |
| `surface-bright` | `#F4F7E8` | 표면 | 카드 리더 패널 |
| `line` | `#d8dcc6` | 경계 | 아카이브 목록 행 구분선(점선) |
| `dday` | `#FF4D4F` | 시간 | 단기 파티 D-Day 칩 |
| `medal-gold` | `#F5C518` | 순위 | 랭킹 1위 뱃지 |
| `medal-silver` | `#C9CDD4` | 순위 | 랭킹 2위 뱃지 |
| `medal-bronze` | `#CD7F32` | 순위 | 랭킹 3위 뱃지 |

이름 근거는 `research.md` R1·R4다. 신설 토큰을 만들지 않기로 한 색과 그 근거도 R4에 있다.

### 1.3 변경 없는 기존 토큰

`bg` · `ink` · `accent` · `accent-hover` · `accent-dark` · `accent-soft` · `accent-bright` · `live` · `sidebar` · `card`. **선택 상태 분리(`FR-001`)는 이 중 셋을 역할대로 다시 쓰는 일이지 새 토큰을 만드는 일이 아니다.**

---

## 2. 색 역할 축 (`AccentRole` 외)

원본의 색은 서로 섞이지 않는 **5개 축**으로 갈린다. 축이 섞이면 "이 색이 무엇을 말하는가"가 깨진다.

| 축 | 토큰 | 전달하는 것 |
| :--- | :--- | :--- |
| 액센트(녹색) | `accent` / `accent-bright` / `accent-soft` | 제출·참여 / 선택된 세그먼트·탭·메뉴 / 선택된 카드 |
| LIVE(녹색) | `live` | LIVE 핑 계열 — 전광판·핑 버튼·제출 버튼 |
| 시간 | `dday` | 남은 기간 강조. 위험·취소가 아니다 |
| 순위 | `medal-*` | 랭킹 1·2·3위 |
| 선택(무채) | `ink` | **정렬 칩의 활성 상태.** 녹색을 쓰지 않는 유일한 선택 표시 |

**글자 축과 표면 축은 위계만 전달하고 의미를 전달하지 않는다.**

| 글자 (어두움 → 밝음) | `ink` → `ink-soft` → `muted` → `muted-soft` |
| :--- | :--- |
| **표면 (어두움 → 밝음)** | `bg` → `surface` → `surface-bright` → `card` |

사이드바(`sidebar` `#20301C`) 위의 글자는 이 축 밖이다. 비활성 메뉴 `#aab49c`는 `Sidebar.tsx:42`에 하드코딩된 채로 둔다 (`findings.md` 2-13).

---

## 3. 픽셀 폰트 자리 (`PixelFontSlot`)

`.px`(Galmuri11)를 쓰는지 가르는 기준은 **"한글 문구냐, 숫자·대문자 약어냐"**다 (`FR-009`).

| | `px` 쓴다 | `font-weight` |
| :--- | :--- | :--- |
| 버튼·탭 | 예 | **주지 않는다** (합성 굵게가 픽셀을 뭉갠다) |
| 숫자·이니셜 뱃지 (`D-3`·`HL`·`GH`·순위) | 예 | `800` 유지 (1~2글자라 티가 안 난다) |
| 섹션 제목·카드 제목 | 예 | 원본 값 따름 |
| 한글 문구 칩 (`모집 중`·`최신순`·`LIVE`·태그) | 아니오 | Pretendard |
| 본문·설명·라벨·**텍스트 링크**(`결과물 ↗`) | 아니오 | Pretendard |

**고정폭 예외 1곳**: CLI 푸터는 `GalmuriMono`다. `Galmuri11`(가변폭)도 Pretendard도 아니다 (`FR-021`).

텍스트 링크를 명시한 이유는 `ArchiveTabs`의 `결과물 ↗`가 **반대 방향으로** 어긋나 있기 때문이다 — 원본은 Pretendard인데 구현이 `px`를 붙였다 (`research.md` R5).

---

## 4. 레이아웃 블록 (`DashboardBlock`)

대시보드의 세로 순서와 폭이다. 값은 `interactions.md` §3.5.

| 순 | 블록 | 컴포넌트 | 폭 |
| ---: | :--- | :--- | :--- |
| 1 | LIVE 전광판 | `LivePingBoard` | 전체 |
| 2 | 단기 파티 레일 | `PartyRail` | 전체 |
| 3 | 모집 중인 정규 스터디 | `StudyGrid` | 전체 (`xl`에서 3열) |
| 4 | 아카이브 + 랭킹 | `ArchiveTabs` + `Leaderboard` | `xl`에서 `1.5fr : 1fr`, 그 아래는 1열 |
| 5 | 터미널 조회 안내 | `CliFooter` | 전체, 좌측 정렬 (박스는 폭을 채우지 않음) |

1~3은 `RealtimeFeed` 안이고 4~5는 `page.tsx`가 직접 조립한다. `aside` prop은 사라진다 (`research.md` R3).

**바깥 컨테이너**: `AppShell`의 `<main>`에 최대 폭 1300px + 가운데 정렬. 루트의 `min-width:1280px`는 옮기지 않는다 (`FR-016`).

---

## 5. 카드 내부 구조 (`StudyCardLayout`)

```
┌─ article (min-height, flex-col) ──────────┐
│ [태그 칩들]              [상태 칩]         │  ← 첫 칩만 accent 틴트
│ 제목                                       │
│ ┌─ 리더 패널 (surface-bright) ──────────┐  │
│ │ [HL] login                      [✓]  │  │  ← ✓는 campus !== null일 때만
│ │      캠퍼스 뱃지                      │  │
│ └───────────────────────────────────────┘  │
│ 스터디 기간  26.11.1~11.30                 │
│ 진행 방식    온라인                        │
│ ─────────── flex:1 스페이서 ───────────── │  ← CTA를 바닥에 고정
│ 모집 현황 4/6명          [상세보기 ↗]      │
└────────────────────────────────────────────┘
```

**불변 2가지**: ① 스페이서와 `min-height`는 한 쌍이다 — 하나만 넣으면 카드 높이가 제각각이거나 버튼이 뜬다. ② 메타 **항목**은 구현 것을 쓰고 **배치**만 원본을 따른다. `사이클`을 더하지 않고 `진행 방식`을 빼지 않는다 (`FR-024`).

`PartyCard`도 같은 골격이되 D-Day 칩이 `dday` 토큰을 쓰고(`research.md` R6) 폭이 `260px` 고정이다.

---

## 6. 상태별 클래스 매핑 (`SelectionState`)

| 컴포넌트 | 선택됨 | 선택 안 됨 |
| :--- | :--- | :--- |
| `ArchiveTabs` 탭 | `accent-bright` + 하드 섀도우 | 흰 바탕 + **`box-shadow:none`** |
| `StudyGrid` 정렬 칩 | **`ink` 바탕 + 흰 글자**, 그림자 없음 | 배경·테두리·그림자 모두 없음 |
| `TypeSwitch` 유형 카드 | `accent-soft` + 우상단 원형 `✓` 칩 | 흰 바탕 |
| `RecruitForm` 진행 방식 | `accent-bright` | 흰 바탕 |
| `LivePingForm` 유효시간 | `accent-bright` | 흰 바탕 |
| `HistoryList` `완주` 칩 | `accent-bright` | — |
| `HistoryList` `진행중` 칩 | `accent-soft` | — |
| `Sidebar` 메뉴 | `accent-bright` | 투명 + `#aab49c` 글자 |

**`Sidebar`가 기준점이다** — 유일하게 처음부터 맞는 곳이다 (`findings.md` 2-11). 나머지를 여기에 맞춘다.

`HistoryList`의 `ENDED` 분류는 색을 맞추기 전에 `src/lib/view-types.ts`의 의미가 원본의 `회고`와 같은지 확인한다. 다르면 **카피를 그대로 두고 색만** 맞춘다 (`findings.md` 2-8d).

---

## 7. 신규 컴포넌트 1개

| 컴포넌트 | 위치 | 내용 |
| :--- | :--- | :--- |
| `PixelFrog` | `src/components/ui/PixelFrog.tsx` | 16×16 도트를 `<rect>`로 그리는 인라인 SVG. `viewBox="0 0 16 16"`, `shape-rendering="crispEdges"`, `image-rendering:pixelated`. 크기는 prop으로 받고 **색 변형 prop은 받지 않는다** (`FR-019`) |

원본 도트 좌표는 `docs/designs/Dashboard.html`의 개설 카드 인라인 SVG(`:3323`~`:3653`)에서 그대로 옮긴다. `docs/designs/PixelFrog.html`에 같은 것이 있다. **개구리 도감(§1.3 보류)을 여는 것이 아니다** — 개설 카드 1자리에만 쓴다.

---

## 8. 도메인 변경 1건 (디자인 아님)

| 함수 | 변경 | 근거 |
| :--- | :--- | :--- |
| `getPostDetail()` (`src/lib/posts.ts`) | 참여자 조회에 `.orderBy(asc(participants.joinedAt), asc(users.login))` 추가 | `FR-014`, `TC-DETAIL-01` |

리더는 개설 시 첫 참여 행이므로(`createPost`) 자연히 맨 앞에 온다. **리더를 별도 정렬 키로 올리지 않는다.** 응답 타입은 바뀌지 않는다.
