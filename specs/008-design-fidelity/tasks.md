# Tasks: 디자인 원본 대비 포팅 정합성 복구 (008)

**Input**: `specs/008-design-fidelity/`의 설계 문서 (`spec.md` · `plan.md` · `research.md` · `data-model.md` · `contracts/design-tokens.md` · `quickstart.md`)

**Prerequisites**: `plan.md`(필수), `spec.md`(유저 스토리), `research.md`, `data-model.md`, `contracts/design-tokens.md`

**Tests**: 포함한다. `requirement.md` §3 Test Suite 9가 `TC-DESIGN-01`~`04`·`TC-DETAIL-01`을 요구하고 Constitution I이 테스트 우선을 못박는다. 단정 방식은 `contracts/design-tokens.md` C6, 구현 규칙은 `research.md` R2다. **jsdom·testing-library를 설치하지 않는다.**

**Organization**: 유저 스토리별 Phase로 묶었다. 단, Phase 순서는 `plan.md` 「구현 순서」를 따른다 — 토큰과 본문 폭이 모든 클래스·치수 작업의 선행이므로 Phase 2(Foundational)에 있고, 치수(US5)는 레이아웃(US7)보다 뒤다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 선행 의존 없음)
- **[Story]**: 해당 유저 스토리 (US1~US7)
- 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5다. **아래 치수·색은 그 문서에서 옮긴 것이며 새 숫자를 만들지 않는다.**

## Path Conventions

Next.js 단일 앱. 저장소 루트의 `tailwind.config.ts`, 소스는 `src/`, 테스트는 `tests/` 평면 구조다.

---

## Phase 1: Setup (공용 선행)

**Purpose**: 변경 전 기준선을 확인하고 테스트 파일 골격을 만든다.

- [ ] T001 변경 전 기준선 확보 — `pnpm lint`, `pnpm typecheck`, `pnpm test`를 돌려 전부 통과함과 테스트 통과 건수를 기록한다. 이후 회귀 판정의 기준값이다 (`quickstart.md` §1)
- [ ] T002 `tests/design-fidelity.test.ts` 신규 생성 — `node:fs`로 소스를 읽는 헬퍼 3종만 먼저 만든다: ① 파일 읽기, ② 공백 접기(`\s+` → 공백 1칸), ③ 폰트 클래스 `px` 판정 정규식 `/(?:^|\s)px(?=\s|$)/`. Tailwind 가로 패딩 유틸 `px-3`·`px-4`는 `-`가 뒤따르므로 걸러져야 한다 (`research.md` R2의 브리틀함 완화 3규칙, `interactions.md` §3.3 주의 3)

---

## Phase 2: Foundational (모든 스토리의 선행 — 차단)

**Purpose**: 토큰·본문 폭·`@font-face`. 이 세 가지는 선언이고, 뒤의 모든 클래스 변경이 여기에 의존한다.

**⚠️ CRITICAL**: 이 Phase가 끝나기 전에 어떤 스토리도 시작하지 않는다. 토큰 없이 클래스를 바꾸면 임의값(`bg-[#9be06a]`)이 흩어진다 (`plan.md` 구현 순서 2). 본문 폭이 틀린 채로 글자 크기를 맞추면 비율 판단이 어긋난다 (`findings.md` 2-14, 구현 순서 3).

### Tests (먼저 작성해 Red 확인) ⚠️

- [ ] T003 `tests/design-fidelity.test.ts`에 `TC-DESIGN-01` 작성 — `tailwind.config.ts`를 import해 ① `muted === '#6b705c'`, ② 신설 9개 토큰이 정확한 값으로 존재(`ink-soft` `#4b5040` · `muted-soft` `#8a8f7a` · `surface` `#eceedd` · `surface-bright` `#F4F7E8` · `line` `#d8dcc6` · `dday` `#FF4D4F` · `medal-gold` `#F5C518` · `medal-silver` `#C9CDD4` · `medal-bronze` `#CD7F32`), ③ 글자 축이 정확히 4단(`ink`·`ink-soft`·`muted`·`muted-soft`)이고 다섯 번째가 없음, ④ `src/`와 `tailwind.config.ts`에 `#71717a`가 0건임을 단정한다. `describe`/`it` 제목에 `TC-DESIGN-01`을 그대로 쓴다 (`contracts/design-tokens.md` C1·C6)
- [ ] T004 `tests/design-fidelity.test.ts`에 `TC-DESIGN-04`의 선언 부분 작성 — ① `src/components/layout/AppShell.tsx`의 `<main>` 클래스 문자열에 최대 폭 1300px 제한과 가운데 정렬이 있음, ② `src/app/globals.css`에 `font-family:'GalmuriMono'` `@font-face` 선언이 있음을 단정한다. `CliFooter` 단정은 T049에서 같은 테스트에 더한다 (`contracts/design-tokens.md` C6)

### Implementation

- [ ] T005 `tailwind.config.ts`의 `muted`를 `#71717a` → `#6b705c`로 교정한다. `text-muted` 51곳이 토큰 1곳 수정으로 따라온다 (`FR-006`, `data-model.md` §1.1)
- [ ] T006 `tailwind.config.ts`의 `theme.extend.colors`에 토큰 9개를 추가한다 — `ink-soft: "#4b5040"`, `muted-soft: "#8a8f7a"`, `surface: "#eceedd"`, `surface-bright: "#F4F7E8"`, `line: "#d8dcc6"`, `dday: "#FF4D4F"`, `medal-gold: "#F5C518"`, `medal-silver: "#C9CDD4"`, `medal-bronze: "#CD7F32"`. **번호 접미사(`-2`·`-3`)를 쓰지 않고 `-soft`/`-bright` 규약을 따른다.** 신설은 이 9개로 닫힌다 (`FR-007`, `data-model.md` §1.2, `research.md` R1·R4, C1-5)
- [ ] T007 `src/components/layout/AppShell.tsx`의 `<main>`에 `max-width:1300px` + 가운데 정렬(`mx-auto`)과 패딩 `30px 36px 56px`를 적용한다. **루트에 `min-width:1280px`를 넣지 않는다** — 375px 1열을 유지해야 한다. 같은 파일 4번째 줄 주석이 `min-width` 제거만 설명하고 있으므로 **두 값이 독립임을 밝혀 다시 쓴다** (`FR-016`, `interactions.md` §3.5, C3-L1·L2)
- [ ] T008 `src/app/globals.css`에 `GalmuriMono` 별칭 `@font-face`를 추가한다. 선언문은 `interactions.md` §3.5의 CSS 블록을 그대로 쓴다 — CDN 배포명이 `GalmuriMono11`이라 별칭이 필요하다 (`FR-021`, C2-F4)

**Checkpoint**: `T003`·`T004`가 Green이다. 토큰·본문 폭·글꼴 선언이 준비됐으므로 스토리 작업을 시작할 수 있다.

---

## Phase 3: User Story 1 - 선택 상태와 확정 행동을 색으로 구분한다 (Priority: P1) 🎯 MVP

**Goal**: 세그먼트·탭·메뉴의 선택 상태는 `accent-bright`, 카드의 선택 상태는 `accent-soft`, 제출·참여만 `accent`. 정렬 칩만 무채(`ink`)이고 LIVE 계열은 `live`다. D-Day 칩을 같은 단계에서 `dday`로 빼낸다.

**Independent Test**: 개설 폼·대시보드·프로필을 열어 선택된 세그먼트·탭·메뉴가 `#9be06a`, 선택된 카드가 `#E4F1D4`, 제출·참여 버튼만 `#5FB63A`, 정렬 칩 활성이 검정, LIVE 제출이 `#16a34a`, D-Day 칩이 빨강임을 원본과 대조한다. 사이드바(`layout/Sidebar.tsx`)가 유일하게 맞는 기준점이다.

**왜 D-Day를 여기 묶는가**: `FR-001`이 `accent-bright`를 "선택된 상태"로 고정하는 순간 `accent-bright`를 쓰는 D-Day 칩이 그 의미 체계에 잘못 끼어든다. 같은 Phase에서 처리해야 한다 (`research.md` R6).

### Implementation

- [ ] T009 [P] [US1] `src/components/feed/ArchiveTabs.tsx:36` — 활성 탭 배경을 `bg-accent`에서 `accent-bright`로 바꾼다. 치수는 `font-size:14px;padding:11px 12px 9px;border-radius:8px;border:2.5px solid #18181b;box-shadow:3px 3px 0 #18181b`다 (`FR-001`, `interactions.md` §3.3)
- [ ] T010 [US1] `src/components/feed/ArchiveTabs.tsx:37` — 비활성 탭을 흰 바탕 + **`box-shadow:none`**으로 만든다. 치수는 활성과 동일하다. `.nb` 클래스가 항상 그림자를 주므로 `.nb`를 떼거나 덮어쓴다. **색만 바꾸면 선택이 그림자로 구분되지 않는다** (`FR-002`, `findings.md` 2-9c). T009와 같은 파일이므로 순차 처리한다
- [ ] T011 [P] [US1] `src/components/create/TypeSwitch.tsx:24` — 선택된 유형 카드 배경을 `bg-accent`에서 `accent-soft`로 바꾼다 (`FR-001`, `findings.md` 2-5)
- [ ] T012 [US1] `src/components/create/TypeSwitch.tsx:29` — 텍스트 접두 `✓`를 제거하고 카드 **우상단 원형 `✓` 칩**으로 바꾼다. 값은 22px · `background:#5FB63A` · `border:2px solid #18181b`다. 구현 참고는 `src/components/detail/CompletionModal.tsx:154`의 기존 원형 칩이다 (`FR-003`, `findings.md` 2-5). T011과 같은 파일이므로 순차 처리한다
- [ ] T013 [P] [US1] `src/components/create/LivePingForm.tsx:88` — 선택된 유효시간 세그먼트 배경을 `accent-bright`로 바꾼다 (`FR-001`)
- [ ] T014 [US1] `src/components/create/LivePingForm.tsx:112` — 제출 버튼 배경을 `bg-accent`에서 `bg-live`(`#16a34a`)로 바꾼다. **LIVE 계열은 전광판·핑 버튼·제출 버튼이 같은 녹색으로 묶이며 액센트 축 밖이다** (`FR-004`, `findings.md` 2-7e). T013과 같은 파일이므로 순차 처리한다
- [ ] T015 [P] [US1] `src/components/create/RecruitForm.tsx:194` — 선택된 진행 방식 세그먼트 배경을 `accent-bright`로 바꾼다. 세그먼트를 1덩어리로 만드는 치수 작업은 T059다 (`FR-001`)
- [ ] T016 [P] [US1] `src/components/feed/StudyGrid.tsx:45` — 정렬 칩(`최신순`·`마감임박순`)에서 녹색을 제거한다. 활성은 `background:#18181b;color:#fff;padding:6px 13px;border-radius:7px;border:2px solid #18181b`이고 **`box-shadow` 없음**, 비활성은 `color:#6b705c;padding:6px 13px;border:2px solid transparent`로 **배경·그림자 모두 없음**이다. **이 자리만 선택 표시에 녹색을 쓰지 않는다** (`FR-005`, `interactions.md` §3.3)
- [ ] T017 [P] [US1] `src/components/profile/HistoryList.tsx:13` — `완주` 칩을 `accent-bright`, `진행중` 칩을 `accent-soft`로 바꾼다. 칩 치수는 `px` 10px · `padding:4px 8px 2px` · radius 6px다. **`ENDED` 분류는 `src/lib/view-types.ts`의 `HistoryCategory`가 원본의 `회고`와 같은 의미인지 먼저 확인한다 — 의미가 다르면 카피(`종료`)를 그대로 두고 색만 `#6b705c` 바탕 + 흰 글자로 맞춘다** (`FR-001`, `findings.md` 2-8d, `data-model.md` §6)
- [ ] T018 [P] [US1] `src/components/card/PartyCard.tsx:25` — D-Day 칩을 `accent-bright`에서 `dday`(`#FF4D4F`)로 바꾸고 치수를 `font-size:13px;color:#fff;background:#FF4D4F;border:2px solid #18181b;padding:3px 9px 1px;border-radius:5px`로 맞춘다. **위험·취소가 아니라 잔여 기간 강조이므로 액센트 1색 규칙 위반이 아니다** (`research.md` R6, `interactions.md` §3.3)

### Verification

- [ ] T019 [US1] `grep -rn 'bg-accent\b' src/`를 돌려 제출·참여 버튼과 `✓` 칩만 걸리는지 확인한다. 탭·세그먼트·카드·정렬 칩은 **0건**이어야 한다 (`SC-001`, `quickstart.md` §2)

**Checkpoint**: 선택 상태와 확정 행동이 색으로 갈린다. US1 단독으로 화면에서 판정된다.

---

## Phase 4: User Story 2 - 보조 텍스트가 배경과 같은 올리브 계열이다 (Priority: P1)

**Goal**: `muted`가 올리브(`#6b705c`)로 바뀐 위에, 부속 메타(`muted-soft`)와 본문 단락(`ink-soft`)을 각각 다른 톤으로 갈라 위계를 만든다.

**Independent Test**: 대시보드·상세 모달·프로필을 원본과 대조해 보조 텍스트가 푸른 회색이 아닌 올리브 계열인지 보고, `#71717a`가 저장소에 0건인지 확인한다.

**선행**: 토큰 교정·신설은 T005·T006에서 끝났다. 이 Phase는 **신설 토큰 2개를 실제 자리에 적용**하는 일이다.

### Implementation

- [ ] T020 [P] [US2] 부속 메타(날짜·인원·부제) 자리에 `text-muted-soft`를 적용한다 — `src/components/feed/EmptyState.tsx`의 설명(13px), `src/components/feed/CliFooter.tsx`의 박스 밖 안내 문구(12px), `src/components/card/CardMeta.tsx`의 리더 부제(12px). **원본이 `#8a8f7a`를 쓰는 자리만** 바꾸고, `#6b705c`인 자리(메타 줄 라벨·하단 좌측 수치)는 `text-muted`로 둔다. 각 자리를 `docs/designs/Dashboard.html`에서 확인한 뒤 바꾼다 (`FR-007`, `findings.md` 2-13, `interactions.md` §3.5)
- [ ] T021 [P] [US2] 본문 단락 자리에 `text-ink-soft`를 적용한다 — 스터디 소개(`src/components/detail/PostDetailModal.tsx`의 `description`)와 회고 본문(`postmortem_text`를 렌더하는 자리). 원본 5곳이고 **"읽는 글" 자리에만** 쓴다 (`FR-007`, `findings.md` 2-12·2-13)

### Verification

- [ ] T022 [US2] `grep -rn '71717a' src/ tailwind.config.ts`가 **0건**이고, 신설 텍스트 토큰이 정확히 2개(`ink-soft`·`muted-soft`)인지 확인한다. `#aab49c`는 `src/components/layout/Sidebar.tsx:42`에 하드코딩된 채로 두고 토큰화하지 않는다 (`SC-002`, `findings.md` 2-13)

**Checkpoint**: 화면 전체의 보조 텍스트가 배경 계열로 바뀌고 메타·본문이 톤으로 갈린다.

---

## Phase 5: User Story 3 - 액센트 버튼·탭에서 픽셀 폰트를 본다 (Priority: P1)

**Goal**: 액센트 버튼·탭·숫자 뱃지에 `px`(Galmuri11)를 붙이고 `font-bold`를 제거한다. 한글 문구 칩·본문·라벨·텍스트 링크는 Pretendard를 유지한다.

**Independent Test**: 액센트 버튼·탭 파일의 클래스 문자열에 `px`가 있고 `font-bold`가 없는지, 칩·라벨·텍스트 링크에는 `px`가 없는지 확인한다.

**지뢰 2개**: ① `px-3`은 가로 패딩 유틸이고 폰트 클래스 `px`와 다른 것이다. ② **Galmuri11에는 bold가 없어 `font-bold`를 함께 주면 합성 굵게가 픽셀을 뭉갠다.** 이니셜 뱃지만 `font-weight:800`을 유지한다 (`interactions.md` §3.3 주의 1·3).

### Tests (먼저 작성해 Red 확인) ⚠️

- [ ] T023 [P] [US3] `tests/design-fidelity.test.ts`에 `TC-DESIGN-02` 작성 — 액센트 버튼·탭(`findings.md` 2-3이 나열한 파일 9개. `JoinConfirmDialog`가 2곳, `LeaderActions`가 3곳이라 적용 자리는 더 많다 — `FR-008`의 "11개"는 자리 기준 집계이므로 파일 수와 다르다)에서 **고유 리터럴을 앵커로** 범위를 좁힌 뒤(`상세보기 ↗`, `개설하기`, `핑 보내기`, `🏆명예의 전당` 등) 폰트 클래스 `px`가 있고 `font-bold`가 **없음**을 단정한다. `src/components/detail/CompletionModal.tsx`는 007b가 이미 적용했으므로 **대상이 아니다** (`contracts/design-tokens.md` C6, `research.md` R2)
- [ ] T024 [P] [US3] `tests/design-fidelity.test.ts`에 `TC-DESIGN-03` 작성 — 정렬 칩(`최신순`), 상태 칩(`모집 중`), 라벨, **텍스트 링크 `결과물 ↗`**에 폰트 클래스 `px`가 **없음**을 단정한다. 텍스트 링크를 포함하는 이유는 구현이 **반대 방향으로** 어긋나 `px`를 붙여 뒀기 때문이다 (`research.md` R5, C6)

### Implementation — 액센트 버튼·탭에 `px` 추가 + `font-bold` 제거

- [ ] T025 [P] [US3] `src/components/card/StudyCard.tsx:39` 카드 CTA(`상세보기 ↗`) — `px` 추가, `font-bold` 제거. 값은 `font-size:14px;padding:12px 16px 10px;border-radius:9px;border:2.5px solid #18181b;box-shadow:3px 3px 0 #18181b`다. **세로 패딩 비대칭(위가 아래보다 2px 큼)을 그대로 따른다** — 픽셀 폰트 글리프의 광학 중심 보정이다 (`FR-008`, `interactions.md` §3.3)
- [ ] T026 [P] [US3] `src/components/card/PartyCard.tsx:49` 카드 CTA — T025와 같은 값으로 `px` 추가, `font-bold` 제거 (`FR-008`)
- [ ] T027 [P] [US3] `src/components/detail/PostDetailModal.tsx:221` 모달 CTA — `px` 추가, `font-bold` 제거. 치수는 T052에서 함께 맞춘다 (`FR-008`)
- [ ] T028 [P] [US3] `src/components/detail/JoinConfirmDialog.tsx` 버튼 **2곳** — `px` 추가, `font-bold` 제거 (`FR-008`, `findings.md` 2-3)
- [ ] T029 [P] [US3] `src/components/detail/LeaderActions.tsx` 버튼 **3곳** — `px` 추가, `font-bold` 제거 (`FR-008`, `findings.md` 2-3)
- [ ] T030 [P] [US3] `src/components/create/RecruitForm.tsx:296` 제출 버튼(`개설하기`) — `px` 추가, `font-bold` 제거. 값은 `font-size:15px;padding:16px 30px 14px;border-radius:9px;box-shadow:4px`다 (`FR-008`, `findings.md` 2-7d)
- [ ] T031 [P] [US3] `src/components/create/LivePingForm.tsx:112` 제출 버튼 — `px` 추가, `font-bold` 제거. 배경 `bg-live`는 T014에서 이미 처리했다 (`FR-008`)
- [ ] T032 [P] [US3] `src/components/feed/ArchiveTabs.tsx:36~37` 아카이브 탭 — `px` 추가, `font-bold` 제거. 색·그림자는 T009·T010에서 처리했다 (`FR-008`)
- [ ] T033 [P] [US3] `src/components/feed/LivePingBoard.tsx:40` `+ 핑 보내기` — `px` 추가, `font-bold` 제거. 값은 `font-size:12px;color:#fff;background:#16a34a;border:2px solid #18181b;box-shadow:2px 2px 0 #18181b;padding:7px 12px 5px;border-radius:7px`다 (`FR-008`, `interactions.md` §3.3)

### Implementation — 폰트 경계 바로잡기

- [ ] T034 [US3] `src/components/feed/ArchiveTabs.tsx:68` 텍스트 링크 `결과물 ↗`에서 **폰트 클래스 `px`를 제거**한다. 원본은 `font-size:13px;color:#6b705c;font-weight:600`인 **Pretendard 텍스트 링크**다. 폰트 규칙이 반대 방향으로 어긋난 유일한 자리다 (`FR-009`, `research.md` R5). T032와 같은 파일이므로 순차 처리한다
- [ ] T035 [P] [US3] 한글 문구 칩과 본문·라벨에 `px`가 붙어 있지 않은지 확인하고 붙어 있으면 제거한다 — 상태 칩(`모집 중`, `font-size:11px;font-weight:800;background:#9be06a;border:2px solid #18181b;padding:2px 8px;border-radius:5px`), `LIVE` 칩, 태그 칩(`font-size:13px;font-weight:700`), 정렬 칩. **버튼 규칙을 칩까지 넓히지 않는다** (`FR-009`, `TC-DESIGN-03`)
- [ ] T036 [P] [US3] 숫자·대문자 약어 뱃지는 `px`와 `font-weight:800`을 **함께 유지**한다 — `src/components/card/InitialBadge.tsx`(`HL`·`GH`), D-Day 칩(`D-3`). **이 예외는 뱃지에만 적용하고 버튼·탭으로 옮기지 않는다** (`FR-009`, `interactions.md` §3.3 주의 1, C2-F2)

**Checkpoint**: `TC-DESIGN-02`·`TC-DESIGN-03`이 Green이다. 액센트 버튼·탭이 픽셀 폰트로 보이고 칩은 Pretendard로 남는다.

---

## Phase 6: User Story 7 - 설계된 폭 안에서 원본과 같은 순서로 배치된다 (Priority: P1)

**Goal**: 랭킹을 아카이브 옆으로, CLI 푸터를 맨 아래로 옮기고, 카드 CTA를 바닥에 고정하고, 개설 카드를 중앙 정렬해 픽셀 개구리를 넣는다. 본문 최대 폭은 T007에서 이미 복구했다.

**Independent Test**: 1920px 폭 브라우저에서 대시보드를 열어 본문이 1300px를 넘지 않는지, 블록 순서가 LIVE → 파티 → 스터디 → (아카이브 + 랭킹) → CLI인지, 제목 줄 수가 다른 카드들의 `[상세보기]`가 모두 같은 높이인지 확인한다. 375px에서 1열로 접히고 가로 스크롤이 없어야 한다.

**왜 US5보다 먼저인가**: 구조가 바뀐 자리 위에서 치수를 맞춰야 한다. 바깥 폭·배치가 틀린 채로 글자 크기를 맞추면 비율이 복구되지 않는다 (`findings.md` 2-14, `plan.md` 구현 순서 5).

### Implementation — 레이아웃 재조립

- [ ] T037 [US7] `grep -rn 'aside' src/`로 `src/components/feed/RealtimeFeed.tsx`의 `aside` prop 호출부가 `src/app/dashboard/page.tsx` **하나뿐임을 먼저 확인**한다 (`plan.md` 지뢰 5, C4)
- [ ] T038 [US7] `src/components/feed/RealtimeFeed.tsx`에서 `aside: React.ReactNode` prop을 **제거**하고 실시간 3종(LIVE 전광판 · 파티 레일 · 스터디 그리드)만 렌더하게 만든다. 스터디 그리드는 전체 폭이다. **`useRealtimePosts` 호출은 이 컴포넌트 한 곳에 그대로 둔다 — 채널 수 1개가 불변이다** (`FR-017`, `research.md` R3, C4·C5)
- [ ] T039 [US7] `src/app/dashboard/page.tsx`의 조립 순서를 바꾼다 — `RealtimeFeed` → `ArchiveTabs` + `Leaderboard` 2열 그리드(`xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`, `gap:22px`) → `CliFooter`(전체 폭, 좌측 정렬) → 모달. 섹션 간격은 `gap:34px`다. **열 전환 분기점은 `xl` 하나만 쓰고 새 분기점을 만들지 않는다** (`FR-017`, `research.md` R3·R8, `interactions.md` §3.5, C3-L3·L4·L5)

### Implementation — 카드 골격

- [ ] T040 [P] [US7] `src/components/card/StudyCard.tsx` — `min-height:296px`와 `flex:1` 하단 스페이서를 **한 쌍으로** 넣어 `[상세보기]`를 카드 바닥에 고정한다. 패딩을 `p-4`(16px)에서 `24px 24px 20px`로, 나머지는 `background:#fffef7;border:3px solid #18181b;border-radius:14px;box-shadow:5px 5px 0 #18181b`로 맞춘다. **하나만 넣으면 카드 높이가 제각각이거나 버튼이 뜬다** (`FR-018`, `interactions.md` §3.5, C3-L6)
- [ ] T041 [P] [US7] `src/components/card/CardMeta.tsx`의 `LeaderLine` — 리더 줄을 `surface-bright`(`#F4F7E8`) 패널에 담는다. 값은 `padding:10px 12px;border:2px solid #18181b;border-radius:9px;gap:10px`, 이름 14px/800, 부제 12px `#6b705c`다. 우측에 20px 원형 `✓`(`background:#5FB63A;border:2px solid #18181b;font-size:11px;font-weight:800`)를 붙이고 **`leader.campus !== null`일 때만 렌더한다** — 42 인증 완료 표시다. **리더 횟수는 표기하지 않는다.** 응답 계약(`PublicUser` = `{login, campus}`)을 바꾸지 않는다 (`FR-023`, `research.md` R7, C4)
- [ ] T042 [US7] `src/components/card/CardMeta.tsx`의 `TagList` — **첫 번째 칩만** 액센트 틴트로 바꾼다. 첫 태그는 `color:#3c7a1e;background:#E4F1D4;border:1.5px solid #3c7a1e`, 나머지는 `font-size:13px;font-weight:700;background:#eceedd;border:1.5px solid #18181b;padding:3px 9px;border-radius:6px`(`surface` 토큰)다. 대표 주제를 앞세우는 표기다 (`FR-020`, `interactions.md` §3.3). T041과 같은 파일이므로 순차 처리한다
- [ ] T043 [US7] `src/components/card/CardMeta.tsx` 메타 배치 — **항목을 바꾸지 않고 배치만** 원본을 따른다. `스터디 기간`·`진행 방식`은 메타 영역에 남기고 **`모집 현황`만 하단 CTA 왼쪽으로** 내린다(`font-size:13px;color:#6b705c`, 인원 수는 `font-size:15px;color:#18181b`). **원본의 `사이클`을 추가하지 않고 원본에 없는 `진행 방식`을 빼지 않는다** — 온/오프라인 구분이 참여 판단에 쓰인다 (`FR-024`, `interactions.md` §3.5). T042와 같은 파일이므로 순차 처리한다

### Implementation — 개설 카드와 섹션 제목

- [ ] T044 [P] [US7] `src/components/ui/PixelFrog.tsx` 신규 생성 — 16×16 도트를 `<rect>`로 그리는 인라인 SVG. `viewBox="0 0 16 16"`, `shape-rendering="crispEdges"`, `image-rendering:pixelated`. Props는 `{ size?: number }`(기본 42)이고 **색 변형 prop을 받지 않는다**. 도트 좌표는 `docs/designs/Dashboard.html`의 개설 카드 인라인 SVG(`:3323`~`:3653`)에서 그대로 옮긴다. **개구리 도감(§1.3 보류)과 무관하며 개설 카드 1자리에만 쓴다** (`FR-019`, `data-model.md` §7, `plan.md` 지뢰 7)
- [ ] T045 [US7] `src/components/feed/EmptyState.tsx` — `border:3px dashed #18181b;border-radius:14px;min-height:296px`에 `align-items:center;justify-content:center;gap:12px`로 가로·세로 중앙 정렬하고 배경에 `bg-accent-soft/45`(= `rgba(228,241,212,0.45)`) 틴트를 깐다. 안은 **42px `PixelFrog`** → 제목(`px` 15px `#18181b`) → 설명(13px `muted-soft`) 순이다. **토큰을 새로 만들지 않고 `accent-soft`의 불투명도로 쓴다** (`FR-019`, `research.md` R4, `interactions.md` §3.5). T044에 의존한다
- [ ] T046 [P] [US7] `src/components/feed/StudyGrid.tsx:34` 섹션 제목 옆 건수 — 흰 바탕과 검정 테두리를 제거하고 `color:#3c7a1e;font-size:17px` 글자만 남긴다. 섹션 제목 자체는 `h2.px` `font-size:21px;display:flex;align-items:baseline;gap:8px`다. **건수에 칩이나 박스를 씌우지 않는다** (`FR-020`, `interactions.md` §3.3·§3.5)

### Implementation — 아카이브 패널과 CLI 푸터

- [ ] T047 [US7] `src/components/feed/ArchiveTabs.tsx` 목록 — 행마다 `border-top:2px dashed`에 `line` 토큰(`#d8dcc6`)과 `padding:13px 0`을 넣는다. 지금은 `flex flex-col gap-3`으로 간격만 있다. **anti-ai-slop의 「구획: 효과 대신 border + 여백」에 해당하며 장식이 아니라 항목 경계를 전달한다** (`research.md` R5, `FR-022`). T034와 같은 파일이므로 순차 처리한다
- [ ] T048 [US7] `src/components/feed/ArchiveTabs.tsx` 패널 치수 — `border:3px;border-radius:14px;padding:20px 24px 22px;box-shadow:5px 5px 0`으로 키운다. 현재는 `nb rounded-[10px] p-4`(기본 `--nb-depth:3px`)다 (`FR-022`, `research.md` R5). T047과 같은 파일이므로 순차 처리한다
- [ ] T049 [P] [US7] `src/components/feed/CliFooter.tsx` — 글꼴을 `.px`(가변폭 Galmuri11)에서 `font-family:'GalmuriMono','SFMono-Regular',Consolas,monospace`로 바꾼다. 박스는 `background:#20301C;border:2.5px solid #18181b;border-radius:9px;box-shadow:3px 3px 0 #18181b;padding:12px 16px;font-size:13px;min-width:380px`이고 **폭을 채우지 않는다.** 안내 문구는 박스 **밖 아래**에 `font-size:12px;color:#8a8f7a;padding-left:2px`로 둔다. 푸터 색(`#cfe8bd`)은 이미 맞으므로 건드리지 않는다 (`FR-021`, `interactions.md` §3.5, `findings.md` 2-11)
- [ ] T050 [US7] `tests/design-fidelity.test.ts`의 `TC-DESIGN-04`에 `CliFooter`가 `GalmuriMono`를 쓴다는 단정을 더한다 (`contracts/design-tokens.md` C6). T049에 의존한다

**Checkpoint**: 블록이 제자리에 설계 폭으로 놓이고 카드 CTA가 바닥에 고정된다. 375px에서 1열이 유지된다.

---

## Phase 7: User Story 4 - 랭킹 상위 3명을 메달 색으로 구분한다 (Priority: P2)

**Goal**: 1·2·3위 뱃지가 금·은·동, 4·5위가 무채 표면색이고 다섯 자리 치수가 같다.

**Independent Test**: 랭킹 섹션을 원본과 대조해 1·2·3위 색과 4·5위 표면색, 공통 치수가 일치하는지 확인한다.

### Implementation

- [ ] T051 [US4] `src/components/feed/Leaderboard.tsx:22` — 순위 뱃지 색을 순위별로 가른다. 1위 `medal-gold`(`#F5C518`) · 2위 `medal-silver`(`#C9CDD4`) · 3위 `medal-bronze`(`#CD7F32`)에 글자는 `#18181b`, 4·5위는 `surface`(`#eceedd`) 바탕에 `muted`(`#6b705c`) 글자다. 현재는 전 순위가 `bg-white`다 (`FR-010`, `interactions.md` §3.4)
- [ ] T052 [US4] `src/components/feed/Leaderboard.tsx:22` — 뱃지 공통 치수를 `width:26px;height:26px;border-radius:6px;font-size:13px;border:2px solid #18181b`, **`box-shadow` 없음**, 클래스 `px`로 맞춘다. 현재는 24px·radius 5px·border 1.5px·12px다. **랭킹 1~3위 행 박스는 채택하지 않는다 — 다섯 행을 같은 맨 줄로 둔다** (`FR-010`·`FR-025`, `interactions.md` §3.4). T051과 같은 파일이므로 순차 처리한다

**Checkpoint**: 상위 3명이 메달 색으로 구분되고 뱃지 치수가 다섯 자리 모두 같다.

---

## Phase 8: User Story 5 - 원본과 같은 크기의 제목·뱃지·버튼을 본다 (Priority: P2)

**Goal**: 상세 모달·개설 페이지·프로필·스테퍼의 치수를 원본 값으로 키운다.

**Independent Test**: 상세 모달·개설 페이지·프로필을 원본 HTML과 나란히 열어 글자 크기·패딩·뱃지 크기를 대조한다.

**공통 원칙**: 실측 결과 **확인한 모든 자리에서 구현이 원본보다 작다.** 줄인 근거가 문서 어디에도 없으므로 원본 값으로 키우고 **임의로 중간값을 쓰지 않는다** (`FR-022`).

### Implementation

- [ ] T053 [P] [US5] `src/components/detail/PostDetailModal.tsx:221` 모달 CTA 치수 — `font-size:16px;padding:16px 18px 14px;border-radius:10px`. 현재 `text-[14px] px-4 py-2.5 rounded-lg`다. `px` 추가는 T027에서 처리했다 (`FR-011`, `findings.md` 2-6a)
- [ ] T054 [P] [US5] `src/app/create/page.tsx:49` 페이지 제목 — `px` 20px → **26px** (`FR-011`, `findings.md` 2-7a)
- [ ] T055 [P] [US5] `src/components/create/TypeSwitch.tsx:15`·`:28` — STEP 라벨 `px` 13px → **12px**, 유형 탭 라벨 `px` 14px → **15px** (`FR-011`, `findings.md` 2-7b·2-7c)
- [ ] T056 [P] [US5] `src/components/create/RecruitForm.tsx:233` 인원 스테퍼 숫자 — `px` 14px → **16px**, 폭 64px → **70px** (`FR-011`, `findings.md` 2-7g)
- [ ] T057 [P] [US5] `src/components/create/LivePingForm.tsx:88` 유효시간 세그먼트 — 높이 **46px**, `px` **14px**. 색은 T013에서 처리했다 (`FR-011`, `findings.md` 2-7f)
- [ ] T058 [P] [US5] `src/components/detail/ParticipantList.tsx:21` 섹션 제목 — `px` 14px → **16px**. 폰트는 이미 맞다 (`FR-011`, `findings.md` 2-6e)
- [ ] T059 [P] [US5] `src/components/detail/CompletionModal.tsx:286` 제출 버튼 글자 크기 — 14px → **15px**. **이 파일에서 이것 외에는 건드리지 않는다 — 007b 포팅이 원본과 일치한다** (`FR-011`, `findings.md` 2-9a·2-9b)
- [ ] T060 [US5] `src/components/create/RecruitForm.tsx:194` 파티 진행 방식 — 낱개 pill 나열을 세그먼트 **1덩어리**로 바꾼다(`border-left:2px`, `border-radius:0`, 높이 46px). 색은 T015에서 처리했다 (`FR-011`, `findings.md` 2-7h). T056과 같은 파일이므로 순차 처리한다
- [ ] T061 [P] [US5] `src/components/card/InitialBadge.tsx:10` — 크기만 원본에 맞춘다. 참여자 **34px**(radius 7px·12px) / 리더 **52px**(radius 10px·15px) / 프로필 **84px**(radius 14px·`px` 30px·`border:3px`). 카드 뱃지는 32px(radius 6px·11px)다. **배경색 종류를 늘리지 않고 `dark`/`light` 2종을 유지한다** — 원본은 사람마다 색이 다르지만 색이 사람을 식별하지 못하고 「색은 의미에만」에 걸린다. `font-weight:800`은 유지한다 (`FR-013`, `findings.md` 2-6b, `interactions.md` §3.3)
- [ ] T062 [P] [US5] `src/components/profile/ProfileHeader.tsx:11`·`:13`·`:22` — 뱃지 84px(T061의 새 크기 사용), 유저명 `px` 18px → **26px**, 통계 숫자 `px` 20px → **22px** + 색 `accent-dark`(`#3c7a1e`). **그림자색 `#0d1409`은 채택하지 않고 전역 `#18181b`를 유지한다** — 그림자색을 둘로 늘리면 `--nb-depth` 한 변수로 깊이를 관리하는 `interactions.md` §3.1 구조가 깨진다 (`FR-011`, `findings.md` 2-8a~2-8e). T061에 의존한다
> **상세 모달 리더 통계 블록(`4회`·`92%`)은 이 Phase에 없다.** 자리도 만들지 않고 `FR-024`(Phase 3.5)가 값과 함께 만든다 — 두 수치 모두 데이터가 없고(`4회`는 `PublicUser`에 없어 응답 계약을 넓혀야 하며 `FR-015` 위반, `92%`는 `FR-024` 산출), 자리만 먼저 만들면 빈 블록이 화면에 남는다 (2026-10-18 사용자 결정, `FR-012`). 이관처는 `next-steps.md` §3.5-2-b다. **다음 대조에서 "누락"으로 세지 않는다.**

**Checkpoint**: 제목·뱃지·버튼 치수가 원본과 같아지고 화면 위계가 돌아온다.

---

## Phase 9: User Story 6 - 참여자 목록 순서가 결정적이다 (Priority: P1)

**Goal**: `getPostDetail()`이 참여자를 항상 같은 순서로 반환하고 리더가 맨 앞에 온다.

**Independent Test**: 참여 행을 늘린 뒤 `getPostDetail()`을 반복 호출해 순서가 고정되고 리더가 첫 행인지 확인한다.

**디자인이 아니라 도메인 로직 버그다.** 다른 Phase와 독립이므로 언제 해도 되지만, **PR 본문에서 디자인 덩어리와 나누어 적는다** (`FR-014`).

### Tests (먼저 작성해 Red 확인) ⚠️

- [ ] T063 [US6] `tests/posts-detail.test.ts`에 `TC-DETAIL-01` 추가 — 참여자 여럿인 글에 대해 `getPostDetail()`을 반복 호출해 ① 순서가 `joined_at` 오름차순 → `login` 오름차순으로 고정되고 ② 리더가 첫 행임을 단정한다. 실제 DB 통합 테스트이며 **격리는 트랜잭션 롤백으로 한다 — 테이블을 TRUNCATE 하지 않는다.** `describe`/`it` 제목에 `TC-DETAIL-01`을 그대로 쓴다 (`contracts/design-tokens.md` C6, `CLAUDE.md` §9)

### Implementation

- [ ] T064 [US6] `src/lib/posts.ts`의 `getPostDetail()` 참여자 조회에 `.orderBy(asc(participants.joinedAt), asc(users.login))`을 추가한다. **리더를 별도 정렬 키로 올리지 않는다** — `createPost`가 리더를 첫 참여 행으로 기록하므로 자연히 맨 앞에 온다. 응답 타입은 바뀌지 않는다 (`FR-014`, `data-model.md` §8)

**Checkpoint**: `TC-DETAIL-01`이 Green이다. 참여 행 수와 무관하게 순서가 고정된다.

---

## Phase 10: Polish & 교차 관심사

**Purpose**: 게이트 통과와 수동 대조. **자동 테스트는 "클래스가 적혀 있다"까지만 보증한다** (`research.md` R2).

- [ ] T065 `quickstart.md` §2의 문자열 단정 6종을 돌려 기대값과 맞는지 확인한다 — `71717a` 0건, `bg-accent\b`는 제출·참여·`✓` 칩만, 폰트 클래스 `px`는 버튼·탭·숫자 뱃지에만, `max-w`는 `AppShell.tsx` 1건, `GalmuriMono`는 `globals.css`·`CliFooter.tsx` 양쪽, `aside` 0건
- [ ] T066 `quickstart.md` §3.1의 대시보드 16개 항목을 **1920px 폭 브라우저**에서 `docs/designs/Dashboard.html`과 나란히 대조한다. **4번(제목 줄 수가 다른 카드들의 `[상세보기]` 높이)이 가장 놓치기 쉽다** — 제목 길이가 다른 스터디를 2~3개 개설해 확인한다. 데모 데이터가 폐기됐으므로 Mock 페르소나로 직접 개설한다
- [ ] T067 `quickstart.md` §3.2 캠퍼스 분기 확인 — `gs_leader`(`campus = GS`)에서 리더 패널에 `✓`가 보이고, `campus`가 `null`인 페르소나로 개설한 글에서는 **`✓`가 없어야** 한다 (`FR-023`)
- [ ] T068 `quickstart.md` §3.3의 나머지 화면 4종(상세 모달 · 개설 폼 3개 · 프로필 · 완주·회고)을 원본과 대조한다. **개구리 도감·획득 배지·대왕 개구리 게이지·주차별 커리큘럼·참여자별 증빙·기간 선택 버튼은 의도적으로 없으며 누락이 아니다** (`findings.md` 2-10)
- [ ] T069 `quickstart.md` §4 반응형 — 브라우저를 **375px**로 좁혀 사이드바가 접히고 본문이 1열이 되며 **가로 스크롤이 생기지 않는지**, 아카이브와 랭킹이 세로로 쌓이고 카드 CTA가 바닥에 남는지 확인한다 (`SC-007`, C3-L2)
- [ ] T070 로컬 필수 게이트 5종을 통과시킨다 — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm drizzle-kit check`. **새 마이그레이션 파일이 0건이어야 한다 — 생겼다면 범위를 벗어난 것이다** (`SC-008`, `FR-015`)
- [ ] T071 PR 본문을 `.github/pull_request_template.md` 구조(📌 Summary, 🛠️ Key Changes, 🧪 Verification, 🔗 Related Specs)로 작성하고 **디자인 덩어리와 도메인 버그(참여자 정렬)를 나누어 적는다.** 불채택 3건의 근거도 남긴다 — 이니셜 뱃지 다색(`findings.md` 2-6b) · 그림자색 `#0d1409`(2-8e) · 랭킹 행 박스(`FR-025`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음
- **Foundational (Phase 2)**: Setup 완료 후. **모든 스토리를 차단한다** — 토큰(T005·T006)과 본문 폭(T007)이 뒤의 모든 클래스·치수 작업의 선행이다
- **Phase 3 (US1)** → **Phase 4 (US2)** → **Phase 5 (US3)** → **Phase 6 (US7)** → **Phase 7 (US4)** → **Phase 8 (US5)**: `plan.md` 「구현 순서」가 정한 순서다. 색 → 구조 → 폰트 → 치수 순으로 가야 각 단계가 눈으로 판정된다
- **Phase 9 (US6)**: Foundational 이후 **언제든** 가능하다. 다른 Phase와 파일이 겹치지 않는다(`src/lib/posts.ts`)
- **Phase 10 (Polish)**: 모든 스토리 완료 후

### 스토리 간 의존

- **US1 (P1)**: Foundational 후 즉시. 다른 스토리에 의존하지 않는다
- **US2 (P1)**: Foundational 후 즉시. 토큰 교정(T005)은 이미 끝났으므로 신설 토큰 2개를 자리에 붙이는 일만 남는다
- **US3 (P1)**: Foundational 후 가능하지만 **US1 뒤가 낫다** — 같은 버튼·탭 파일을 만지므로 색을 먼저 맞추고 폰트를 올린다
- **US7 (P1)**: **US5보다 반드시 앞선다.** 바깥 폭·배치가 틀린 채로 치수를 맞추면 비율이 복구되지 않는다 (`findings.md` 2-14)
- **US4 (P2)**: 독립. `Leaderboard.tsx` 한 파일이고 토큰(`medal-*`·`surface`)에만 의존한다
- **US5 (P2)**: **US7 뒤.** 바뀐 레이아웃 위에서 치수를 판정한다
- **US6 (P1)**: 완전 독립. 디자인과 무관하다

### 같은 파일을 만지는 작업 — 순차 처리

| 파일 | 작업 |
| :--- | :--- |
| `feed/ArchiveTabs.tsx` | T009 → T010 → T032 → T034 → T047 → T048 |
| `create/TypeSwitch.tsx` | T011 → T012 → T055 |
| `create/LivePingForm.tsx` | T013 → T014 → T031 → T057 |
| `create/RecruitForm.tsx` | T015 → T030 → T056 → T060 |
| `card/CardMeta.tsx` | T020 → T041 → T042 → T043 |
| `detail/PostDetailModal.tsx` | T021 → T027 → T053 |
| `feed/StudyGrid.tsx` | T016 → T046 |
| `feed/CliFooter.tsx` | T020 → T049 |
| `feed/Leaderboard.tsx` | T051 → T052 |
| `card/InitialBadge.tsx` | T036 → T061 |
| `tests/design-fidelity.test.ts` | T002 → T003 → T004 → T023 → T024 → T050 |

### 병렬 기회

- Phase 2의 T005·T006은 같은 파일이라 순차, T007·T008은 서로 독립이며 T005·T006과도 독립이다
- Phase 3에서 T009·T011·T013·T015·T016·T017·T018은 각각 다른 파일이라 병렬 가능하다
- Phase 5의 T025~T033은 **9개 파일이 서로 달라 전부 병렬 가능하다.** 이 Phase가 병렬 이득이 가장 크다
- Phase 8의 T053~T059·T061은 대부분 다른 파일이라 병렬 가능하다
- Phase 9(US6)는 어느 Phase와도 병렬 가능하다

---

## Parallel Example: User Story 3 (폰트)

```bash
# 테스트 2개를 같은 파일에 쓰므로 순차, 그 뒤 9개 파일을 동시에 고친다
Task: "card/StudyCard.tsx:39 카드 CTA에 px 추가 + font-bold 제거"
Task: "card/PartyCard.tsx:49 카드 CTA에 px 추가 + font-bold 제거"
Task: "detail/PostDetailModal.tsx:221 모달 CTA에 px 추가 + font-bold 제거"
Task: "detail/JoinConfirmDialog.tsx 버튼 2곳에 px 추가 + font-bold 제거"
Task: "detail/LeaderActions.tsx 버튼 3곳에 px 추가 + font-bold 제거"
Task: "create/RecruitForm.tsx:296 제출 버튼에 px 추가 + font-bold 제거"
Task: "create/LivePingForm.tsx:112 제출 버튼에 px 추가 + font-bold 제거"
Task: "feed/LivePingBoard.tsx:40 + 핑 보내기에 px 추가 + font-bold 제거"
```

---

## Implementation Strategy

### MVP 먼저 (US1까지)

1. Phase 1 Setup
2. Phase 2 Foundational — **차단 구간이므로 반드시 먼저**
3. Phase 3 US1 — 선택 상태 색 분리
4. **멈추고 검증**: 개설 폼·대시보드·프로필에서 선택 상태와 확정 행동이 색으로 갈리는지 본다. `grep -rn 'bg-accent\b' src/`가 제출·참여만 집는다
5. 여기까지가 "액센트 1색 규칙 위반"을 해소하는 최소 묶음이다 (`findings.md` 2-5가 "가장 영향이 넓다"로 지목)

### 점진 전달

1. Setup + Foundational → 토큰·폭·글꼴 선언 준비
2. US1 → 색 체계 복구 → 검증
3. US2 → 텍스트 위계 복구 → 검증
4. US3 → 픽셀 폰트 복구 → `TC-DESIGN-02`·`03` Green
5. US7 → 레이아웃 복구 → 1920px·375px 양쪽 검증
6. US4 → 메달 색
7. US5 → 치수 — 앞 단계가 다 끝나야 눈으로 판정된다
8. US6 → 참여자 정렬 (독립, PR 본문에서 분리)
9. Polish → 게이트 5종 + 수동 대조

### 단독 작업 권장

이 작업은 **같은 파일을 여러 스토리가 만진다**(위 표 12개 파일). 여러 사람이 동시에 들어가면 충돌이 잦으므로, 병렬화는 Phase 5(폰트 9파일)와 Phase 9(US6)에만 쓴다.

---

## Notes

- `[P]` = 다른 파일, 선행 의존 없음
- 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5다. **새 숫자를 만들지 않는다**
- `TC-DESIGN-*`·`TC-DETAIL-01`은 **먼저 써서 Red을 확인한 뒤** 고친다 (Constitution I)
- 테스트 제목에 `requirement.md` §3의 ID를 그대로 쓴다
- 작업 단위 또는 논리 묶음마다 커밋한다. `feat:`/`test:`/`chore:` Conventional Commits, 제목은 한국어
- **마이그레이션·스키마·API 응답 계약을 바꾸지 않는다** (`FR-015`). 새 마이그레이션이 생기면 범위를 벗어난 것이다
- **불채택 항목을 "누락"으로 다시 세지 않는다** — 이니셜 뱃지 다색, 그림자색 `#0d1409`, 랭킹 행 박스, 주차별 커리큘럼, 참여자별 증빙, 기간 선택 버튼, 개구리 도감·획득 배지·대왕 개구리 게이지, 완주율 값 산출(`FR-024`). 근거는 `plan.md` 「불채택 목록」이다
