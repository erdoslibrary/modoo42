# Feature Specification: 디자인 원본 대비 포팅 정합성 복구 (008)

**Feature Branch**: `008-design-fidelity`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "`FR-026` 디자인 원본 대비 포팅 정합성 복구. 입력은 `specs/008-design-fidelity/findings.md` 2-B절(8화면 전수 대조 결과 2-5~2-13), 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.4, 작업 순서는 `docs/next-steps.md` §3.4의 9단계다."

> **범위 확정 (`docs/requirement.md` `FR-026` · `docs/next-steps.md` §3.4):**
> - 신규 기능이 아니라 **Phase 3 포팅 누락의 사후 복구**다. 색·폰트·치수와 도메인 정렬 버그 1건으로 한정한다.
> - **Phase 3.5(`FR-023`·`FR-024`)보다 앞선다.** 토큰과 버튼 규칙이 어긋난 상태로 배너·완주율 UI를 올리면 같은 수정을 두 번 한다.
> - **기능·DB 스키마·API 표면을 바꾸지 않는다.** 마이그레이션이 없다.
> - **값의 숫자는 이 문서에 복사하지 않는다.** 폰트·치수·색·레이아웃의 SSOT는 `docs/designs/interactions.md` §3.3~3.5이고, 지점별 차이 목록은 `findings.md` 2-5~2-9다. 두 곳에 값을 두면 갈라진다.
> - **2026-10-18에 사용자가 실제 화면을 보고 범위를 넓혔다.** 레이아웃 골격 6건(US7)과 정렬 칩 색(FR-005)이다. 컴포넌트 조립 순서는 바뀌지만 데이터 흐름과 응답 계약은 그대로다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 유저가 "눌러서 확정하는 버튼"과 "이미 선택된 보기"를 색으로 구분한다 (Priority: P1)

유저가 개설 폼의 유형 카드·진행 방식 세그먼트·유효시간 세그먼트, 대시보드의 아카이브 탭·정렬 칩, 프로필의 이력 상태 칩을 본다. 선택된 항목은 제출 버튼(`accent`)과 다른 색으로 표시되어, 어느 것이 "현재 선택된 상태"이고 어느 것이 "누르면 확정되는 행동"인지 한눈에 갈린다.

**Why this priority**: `findings.md` 2-5가 "가장 영향이 넓다"로 지목한 항목이다. `CLAUDE.md` §10과 `.claude/rules/anti-ai-slop.md`의 "액센트 1색, 색은 의미(상태·위계)에만"을 현재 구현이 어기고 있다. 토큰 3종(`accent`·`accent-bright`·`accent-soft`)이 이미 있으므로 **새 토큰 없이 클래스만 바꾼다.**

**Independent Test**: 개설 폼·대시보드·프로필을 열어 선택된 세그먼트·탭·메뉴가 `#9be06a`, 선택된 카드가 `#E4F1D4`, 제출·참여 버튼만 `#5FB63A`임을 원본 HTML과 나란히 대조한다. 사이드바(`layout/Sidebar.tsx`)가 유일하게 맞는 기준점이다.

**Acceptance Scenarios**:

1. **Given** 대시보드 아카이브 탭, **When** 탭을 전환한다, **Then** 활성 탭은 `accent-bright` 바탕에 하드 섀도우를 가지고 비활성 탭은 흰 바탕에 **그림자가 없다**. 색과 그림자 유무 두 가지로 선택이 표시된다. (`findings` 2-5, 2-9c)
2. **Given** 개설 폼의 유형 선택 카드, **When** 유형을 고른다, **Then** 선택된 카드는 `accent-soft` 바탕이 되고 우상단에 원형 `✓` 칩이 붙는다. `✓`를 텍스트 접두로 쓰지 않는다. (`findings` 2-5)
3. **Given** 개설 폼의 진행 방식·유효시간 세그먼트와 프로필 이력 `완주` 칩, **When** 화면을 연다, **Then** 선택 상태 배경이 `accent-bright`이고 `accent`가 아니다. (`findings` 2-5)
4. **Given** LIVE 핑 개설 폼, **When** 제출 버튼을 본다, **Then** 배경이 `live`(`#16a34a`)다. LIVE 계열은 전광판·핑 버튼·제출 버튼이 같은 녹색으로 묶인다. (`findings` 2-7e)
5. **Given** 대시보드 정렬 칩(`최신순`·`마감임박순`), **When** 정렬을 바꾼다, **Then** 활성 칩이 **검정 바탕·흰 글자**가 되고 비활성 칩은 배경·테두리·그림자가 모두 없다. 이 자리만 녹색을 쓰지 않는다. (2026-10-18 사용자 결정, `interactions.md` §3.3)

---

### User Story 2 - 유저가 보조 텍스트를 배경과 같은 계열의 올리브 톤으로 읽는다 (Priority: P1)

화면 전체의 보조 텍스트가 배경(`#EDEFE0`)과 같은 올리브 계열(`#6b705c`)로 보인다. 그리고 보조 텍스트 안에서도 "부속 메타(날짜·인원)"와 "읽는 본문 단락"이 서로 다른 톤으로 갈려 위계가 전달된다.

**Why this priority**: `text-muted` 사용처가 51곳이라 단일 토큰 수정으로 화면 전체 인상이 바뀐다. 현재 값 `#71717a`(zinc)는 푸른끼가 돌아 배경 계열에서 벗어나며, `findings.md` 2-1이 "전체적으로 밋밋하다"는 인상의 주된 원인으로 지목했다. 선행 문서 교정(`CLAUDE.md` §10)은 이미 끝났다.

**Independent Test**: `muted` 토큰 교정 후 대시보드·상세 모달·프로필을 원본과 대조하고, `#71717a`가 저장소에 0건인지 확인한다.

**Acceptance Scenarios**:

1. **Given** `tailwind.config.ts`의 `muted` 토큰, **When** 값을 `#6b705c`로 바꾼다, **Then** `text-muted` 51곳이 함께 바뀌고 하드코딩된 `#71717a`가 `src/`에 남지 않는다. (`findings` 2-1, `TC-DESIGN-01`)
2. **Given** 부속 메타(날짜·인원, 원본 `#8a8f7a` 56곳)와 본문 단락(스터디 소개·회고 본문, 원본 `#4b5040` 5곳), **When** 화면을 연다, **Then** 두 자리가 일반 보조 텍스트와 다른 톤으로 구분된다. **새 토큰은 이 2개뿐이다.** (`findings` 2-13)
3. **Given** 사이드바 비활성 메뉴(`#aab49c`)와 개구리 도감의 `#9aa088`, **When** 토큰을 정한다, **Then** 둘 다 토큰을 만들지 않는다. 전자는 `Sidebar.tsx:42`가 이미 하드코딩하고 있고 후자는 §1.3 보류 범위다. (`findings` 2-13)

---

### User Story 3 - 유저가 액센트 버튼·탭에서 픽셀 폰트를 본다 (Priority: P1)

유저가 카드 CTA(`참여하기 ↗`)·배너 CTA(`+ 스터디 개설하기`)·아카이브 탭·`+ 핑 보내기`·개설 폼 제출 버튼을 볼 때 글자가 Galmuri11(픽셀 폰트)로 표시된다. 한글 문구 칩(`모집 중`·`최신순`·`LIVE`·태그)과 본문·라벨은 Pretendard 그대로다.

**Why this priority**: 원본의 액센트 버튼은 **예외 0건으로 전부** `class="px"`인데 구현은 `bg-accent` 조합 9종 중 `px`가 0개다. 42 클러스터의 터미널·레트로 정서를 전달하는 자리가 통째로 빠져 있다.

**Independent Test**: 액센트 버튼·탭 11개 파일의 클래스 문자열에 `px`가 있고 `font-bold`가 없는지, 칩·라벨에는 `px`가 없는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 액센트 버튼·탭 컴포넌트, **When** 클래스를 수정한다, **Then** 폰트 클래스 `px`가 붙고 `font-bold`가 **제거된다**. Galmuri11에 bold가 없어 합성 굵게가 픽셀을 뭉갠다. (`interactions.md` §3.3 주의 1, `TC-DESIGN-02`)
2. **Given** 숫자·대문자 약어 자리(`D-3`·`HL`·`GH`), **When** 폰트를 정한다, **Then** `px`를 쓴다. 이니셜 뱃지에서만 `font-weight:800`을 함께 유지하고 버튼·탭으로 옮기지 않는다. (`interactions.md` §3.3 주의 1)
3. **Given** 한글 문구 칩과 본문·라벨, **When** 폰트를 정한다, **Then** Pretendard를 유지한다. 버튼 규칙을 칩까지 넓히지 않는다. (`TC-DESIGN-03`)
4. **Given** 원본의 세로 패딩 비대칭(위가 아래보다 2px 큼), **When** 패딩을 옮긴다, **Then** 그대로 따른다. 픽셀 폰트 글리프의 광학 중심 보정이지 오타가 아니다. (`interactions.md` §3.3 주의 2)
5. **Given** `detail/CompletionModal.tsx`, **When** 대상 파일을 센다, **Then** 제외한다. 007b가 이미 `px`를 쓰고 있다. (`next-steps.md` §3.4-4)

---

### User Story 4 - 유저가 랭킹 상위 3명을 메달 색으로 구분한다 (Priority: P2)

명예의 전당 랭킹에서 1·2·3위 순위 뱃지가 각각 금·은·동으로 표시되고, 4·5위는 무채 표면색이다. 뱃지 치수는 다섯 자리 모두 같다.

**Why this priority**: **신규 요구가 아니다.** `FR-010`이 이미 "상위 5명(골드/실버/브론즈)"을 명시하고 있고 구현만 누락됐다. 현재 `Leaderboard.tsx:22`는 전 순위가 `bg-white`라 상위 3명이 구분되지 않는다.

**Independent Test**: 랭킹 섹션을 원본과 대조해 1·2·3위 색과 4·5위 표면색, 공통 치수가 일치하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 랭킹 상위 5명, **When** 뱃지를 렌더한다, **Then** 1·2·3위가 각각 금·은·동이고 4·5위는 무채 표면색 바탕에 보조 텍스트 색 글자다. 값은 `interactions.md` §3.4를 쓴다. (`findings` 2-2)
2. **Given** 순위 뱃지 치수, **When** 다섯 자리를 비교한다, **Then** 모두 같고 `box-shadow`가 없으며 폰트는 `px`다. 현재 구현(24px·radius 5px·border 1.5px·12px)은 원본(26px·radius 6px·border 2px·13px)과 다르다. (`interactions.md` §3.4)

---

### User Story 5 - 유저가 원본과 같은 크기의 제목·뱃지·버튼을 본다 (Priority: P2)

상세 모달 CTA, 개설 페이지 제목, 프로필 뱃지·유저명·통계 숫자, 섹션 제목, 인원 스테퍼가 원본과 같은 치수로 보인다. 지금은 전반적으로 원본보다 작아 화면 위계가 평평하다.

**Why this priority**: 개별 차이는 작지만 합쳐지면 "밋밋하다"는 인상을 만든다. US1~US3보다 뒤에 두는 이유는 색·폰트가 먼저 맞아야 치수 차이가 눈에 들어오기 때문이다.

**Independent Test**: 상세 모달·개설 페이지·프로필을 원본 HTML과 나란히 열어 글자 크기·패딩·뱃지 크기를 대조한다.

**Acceptance Scenarios**:

1. **Given** `findings.md` 2-6~2-9가 나열한 치수 차이 지점, **When** 값을 맞춘다, **Then** `interactions.md` §3.3 표와 `findings.md`의 지점별 표를 쓴다. 새 숫자를 만들지 않는다. (`next-steps.md` §3.4-6)
2. **Given** 이니셜 뱃지, **When** 크기를 맞춘다, **Then** 34px / 리더 52px / 프로필 84px로 바꾸고 **배경색 종류는 늘리지 않는다.** `dark`/`light` 2종을 유지한다. (`findings` 2-6b, `next-steps.md` §3.4-8)
3. **Given** 상세 모달의 리더 통계 자리(`4회`·`92%`), **When** 레이아웃을 맞춘다, **Then** 자리와 서식(`px` 18px·`accent-dark`)만 만들고 **완주율 값 산출은 `FR-024`(Phase 3.5)에 맡긴다.** 두 번 구현하지 않는다. (`findings` 2-6c)
4. **Given** 프로필 뱃지의 원본 그림자색 `#0d1409`, **When** 채택 여부를 정한다, **Then** 채택하지 않고 전역 `#18181b`를 유지한다. 그림자색을 둘로 늘리면 `--nb-depth` 한 변수로 깊이를 관리하는 `interactions.md` §3.1 구조가 깨진다. (`findings` 2-8e)
5. **Given** 프로필 이력의 `ENDED` 분류, **When** 카피를 정한다, **Then** `HistoryCategory`의 `ENDED`가 원본의 `회고`와 같은 의미인지 `src/lib/view-types.ts`에서 확인한 뒤 맞춘다. **의미가 다르면 카피를 그대로 두고 색만 맞춘다.** (`findings` 2-8d)

---

### User Story 6 - 유저가 상세 모달을 몇 번 열어도 참여자 목록 순서가 같다 (Priority: P1)

유저가 같은 글의 상세 모달을 반복해서 열 때 참여자 목록이 항상 같은 순서로 나오고, 리더가 맨 앞에 있다.

**Why this priority**: **디자인이 아니라 도메인 로직 버그다.** `getPostDetail()`의 참여자 조회에 `ORDER BY`가 없어 PostgreSQL이 실행 계획에 따라 행 순서를 바꾼다. 행이 적을 때는 삽입 순서로 나와 숨고, 운영 데이터가 쌓이면 재현된다. 성격이 다르지만 변경이 3줄이라 분리 비용이 더 크므로 같은 PR에 넣기로 확정했다 (2026-10-18 사용자 결정). **PR 본문에서 디자인 덩어리와 나누어 적는다.**

**Independent Test**: 참여 행을 늘린 뒤 `getPostDetail()`을 반복 호출해 순서가 고정되고 리더가 첫 행인지 확인한다.

**Acceptance Scenarios**:

1. **Given** 참여자가 여럿인 글, **When** `getPostDetail()`을 호출한다, **Then** 참여자가 `joined_at` 오름차순 → `login` 오름차순으로 정렬되어 반환된다. (`TC-DETAIL-01`)
2. **Given** 개설 시 리더가 첫 참여 행으로 기록된다는 사실(`src/lib/posts.ts`의 `createPost`), **When** 목록을 렌더한다, **Then** 리더가 항상 맨 앞에 온다. 리더를 별도 정렬 키로 올리지 않는다. (`findings` 1-1)

---

### User Story 7 - 유저가 설계된 폭 안에서 원본과 같은 순서로 배치된 화면을 본다 (Priority: P1)

유저가 넓은 모니터에서 대시보드를 열어도 본문이 설계 폭(1300px) 안에 머물고, 카드가 늘어나지 않는다. 성실 멤버 랭킹은 아카이브 카드 옆에 있고, CLI 푸터는 맨 아래에 있다. 스터디 카드의 `[상세보기]`는 제목 길이와 무관하게 모두 같은 높이에 있다. 점선 개설 카드는 내용이 가운데 모여 있고 픽셀 개구리가 함께 보인다.

**Why this priority**: **2026-10-18에 사용자가 실제 화면을 보고 추가한 항목이다.** 전수 대조(`findings.md` 2-B)가 색·폰트 중심이라 레이아웃을 보지 않았고, 그래서 "전체적으로 커 보인다"는 인상의 실제 원인(`max-width` 누락)이 목록에 없었다. 치수(US5)를 아무리 맞춰도 바깥 폭이 틀리면 비율이 복구되지 않으므로 US5보다 앞선다.

**Independent Test**: 1920px 폭 브라우저에서 대시보드를 열어 본문이 1300px를 넘지 않는지, 블록 순서가 원본과 같은지, 제목 줄 수가 다른 카드들의 `[상세보기]`가 한 줄에 맞는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 1920px 폭 브라우저, **When** 대시보드를 연다, **Then** `<main>` 본문이 1300px에서 멈춘다. 375px에서는 여전히 1열로 접힌다 — `min-width` 제거는 그대로 유지한다. (`interactions.md` §3.5)
2. **Given** 대시보드, **When** 세로 순서를 본다, **Then** LIVE 전광판 → 파티 레일 → 스터디 그리드(전체 폭) → 아카이브 + 랭킹(`1.5fr : 1fr`) → CLI 푸터(맨 아래, 좌측 정렬) 순이다. 랭킹이 스터디 그리드의 사이드바에 있지 않다. (`interactions.md` §3.5)
3. **Given** 제목이 한 줄인 카드와 두 줄인 카드가 섞인 그리드, **When** 화면을 본다, **Then** 모든 `[상세보기]`가 같은 높이에 있다. 카드에 `min-height`와 하단 스페이서가 있다. (`interactions.md` §3.5)
4. **Given** 점선 개설 카드, **When** 화면을 본다, **Then** 내용이 가로·세로 모두 중앙에 모여 있고 42px 픽셀 개구리 → 제목 → 설명 순으로 쌓여 있으며 연녹색 틴트 배경이 깔린다. (`interactions.md` §3.5)
5. **Given** 섹션 제목 옆 건수, **When** 화면을 본다, **Then** 테두리·배경 없이 `#3c7a1e` 글자만 보인다. (`interactions.md` §3.5)
6. **Given** CLI 푸터, **When** 화면을 본다, **Then** 글꼴이 고정폭(`GalmuriMono`)이고, 박스가 폭을 채우지 않으며, 안내 문구가 박스 밖 아래에 있다. (`interactions.md` §3.5)
7. **Given** `campus`가 있는 리더와 `null`인 리더, **When** 카드를 본다, **Then** 둘 다 리더 정보가 `#F4F7E8` 패널에 담기고, `✓`는 `campus`가 있는 쪽에만 보인다. (`FR-023`)
8. **Given** 스터디 카드, **When** 메타를 본다, **Then** `스터디 기간`·`진행 방식`은 메타 영역에, `모집 현황`은 하단 CTA 왼쪽에 있다. `사이클`은 없다. (`FR-024`)

---

### Edge Cases

- **`px` 검색 시 Tailwind 가로 패딩 유틸 혼동**: `px-3`·`px-4`는 가로 패딩이고 폰트 클래스 `px`와 이름만 같다. 테스트와 수정 양쪽에서 걸러낸다. (`interactions.md` §3.3 주의 3)
- **아카이브 탭 비활성의 그림자**: `.nb` 클래스가 항상 `box-shadow`를 주므로 비활성 탭에서 그림자를 없애려면 `.nb`를 떼거나 덮어써야 한다. 색만 바꾸면 선택이 그림자로 구분되지 않는다. (`findings` 2-9c)
- **이미 맞는 지점을 건드리지 않는다**: 사이드바, 상세 모달 메타 값(`PostDetailModal.tsx:119~155`), `.nb` 깊이 체계, `pulse` 점, CLI 푸터 색, `CompletionModal`의 `px`·`✓` 원형 칩은 원본과 일치한다. 수정 대상이 아니다. (`findings` 2-11, 2-9b)
- **포팅하지 않는 것을 "누락"으로 다시 세지 않는다**: 주차별 커리큘럼·참여자별 증빙(둘 다 저장 스키마 없음), 기간 선택 버튼(`FR-001`이 `end_date` 자동 산출), 개구리 도감·획득 배지·대왕 개구리 게이지(§1.3 보류). 근거는 `findings.md` 2-10이다.
- **검증 수단의 한계**: `vitest.config.ts`의 `environment`가 `node`이고 jsdom·testing-library가 없다. 계산된 스타일을 단정할 수 없으므로 `TC-DESIGN-*`은 **설정값과 소스 문자열의 정적 단정**으로 구현한다. **jsdom·testing-library를 새로 설치하지 않는다.** 색의 시각적 일치는 브라우저 수동 대조로 확인한다. (`requirement.md` §3 Test Suite 9)
- **미등록 색의 토큰화 범위**: `#FF4D4F`(D-Day 칩)·표면 틴트(`#eceedd`·`#F4F7E8`·`#d8dcc6`·`#e0e3cf`·`#E7F6EC`·`#F0F1E4`·`#aef5bf`·`#b9c0a4`) 중 **포팅한 화면에서 실제 사용처가 확인된 것만** 토큰에 넣는다. 원본에 있다는 이유만으로 토큰을 만들지 않는다. (`findings` 2-4, 2-12)

## Requirements *(mandatory)*

구현 순서는 `docs/next-steps.md` §3.4의 9단계를 따른다. 1단계(전수 대조)는 완료됐으므로 아래는 2~9단계에 대응한다.

### Functional Requirements

- **FR-001** (§3.4-2, US1): 선택 상태의 배경색을 제출·참여 버튼과 분리해야 한다. 세그먼트·탭·메뉴의 선택 상태는 `accent-bright`, 카드의 선택 상태는 `accent-soft`, 제출·참여만 `accent`다. 고칠 지점은 `feed/ArchiveTabs.tsx:36`, `create/TypeSwitch.tsx:24`, `create/LivePingForm.tsx:88`, `create/RecruitForm.tsx:194`, `profile/HistoryList.tsx:13`이다. **토큰 3종이 모두 존재하므로 새 토큰을 만들지 않고 클래스만 바꾼다.** (`req FR-026`, `findings` 2-5)
- **FR-002** (§3.4-2, US1): 아카이브 탭은 **색과 그림자 유무** 두 가지로 선택을 표시해야 한다. 비활성 탭은 `box-shadow:none`이다. (`findings` 2-9c)
- **FR-003** (§3.4-2, US1): 유형 선택 카드의 선택 표시는 우상단 원형 `✓` 칩이어야 한다. 현재 `TypeSwitch.tsx:29`의 텍스트 접두 `✓`를 대체한다. 구현 참고는 `detail/CompletionModal.tsx:154`의 기존 원형 칩이다. (`findings` 2-5)
- **FR-004** (§3.4-2, US1): LIVE 핑 개설 폼의 제출 버튼(`create/LivePingForm.tsx:112`)은 `live` 토큰을 써야 한다. LIVE 계열 녹색은 `accent`와 별개다. (`findings` 2-7e)
- **FR-005** (§3.4-2, US1): 대시보드 정렬 칩(`feed/StudyGrid.tsx:45`)은 **녹색을 쓰지 않아야 한다.** 활성은 검정 바탕·흰 글자, 비활성은 배경·그림자 없이 테두리까지 투명하다. `findings.md` 2-5의 5개 목록에 빠져 있던 6번째 지점이며 2026-10-18에 채택이 확정됐다. 값은 `interactions.md` §3.3이다.
- **FR-006** (§3.4-3, US2): `tailwind.config.ts`의 `muted` 토큰을 `#6b705c`로 교정해야 한다. 선행 문서 교정(`CLAUDE.md` §10)은 완료됐다. 하드코딩된 `#71717a`가 저장소에 남지 않아야 한다. (`req FR-026`, `TC-DESIGN-01`)
- **FR-007** (§3.4-7, US2): 텍스트 색 토큰을 4단으로 만들되 **신설은 2개뿐이어야 한다** — 부속 메타(`#8a8f7a`, 56곳)와 본문 단락(`#4b5040`, 5곳)이다. `#aab49c`(사이드바 전용)와 `#9aa088`(도감 보류)은 토큰화하지 않는다. **토큰 이름은 `speckit-plan`에서 정한다.** (`findings` 2-13)
- **FR-008** (§3.4-4, US3): 액센트 버튼·탭에 폰트 클래스 `px`를 추가하고 `font-bold`를 제거해야 한다. 대상 파일 11개는 `findings.md` 2-3에 목록이 있다. `detail/CompletionModal.tsx`는 이미 적용돼 있어 대상이 아니다. (`req FR-026`, `TC-DESIGN-02`)
- **FR-009** (§3.4-4, US3): 폰트 경계는 **"한글 문구냐 숫자·대문자 약어냐"**여야 한다. 한글 문구 칩·본문·라벨은 Pretendard, 숫자·이니셜(`D-3`·`HL`·`GH`)은 `px`다. 이니셜 뱃지에서만 `px`와 `font-weight:800`을 함께 유지한다. (`interactions.md` §3.3, `TC-DESIGN-03`)
- **FR-010** (§3.4-5, US4): 랭킹 순위 뱃지(`feed/Leaderboard.tsx:22`)에 1·2·3위 금·은·동과 4·5위 무채 표면색을 적용하고 공통 치수를 원본에 맞춰야 한다. 값은 `interactions.md` §3.4다. (`req FR-010`, `findings` 2-2)
- **FR-011** (§3.4-6, US5): `findings.md` 2-6~2-9가 나열한 치수 차이를 `interactions.md` §3.3 표의 값으로 맞춰야 한다 — 상세 모달 CTA, 개설 페이지 제목(`create/page.tsx:49`), 프로필 뱃지·유저명·통계 숫자(`profile/ProfileHeader.tsx`), 섹션 제목(`detail/ParticipantList.tsx:21`), 인원 스테퍼(`create/RecruitForm.tsx:233`), 완주 모달 제출 버튼 글자 크기(`detail/CompletionModal.tsx:286`), 파티 진행 방식 세그먼트(`create/RecruitForm.tsx:194`).
- **FR-012** (§3.4-6, US5): 상세 모달의 리더 통계 자리는 **레이아웃과 서식만** 만들어야 한다. 완주율 값 산출은 `FR-024`(Phase 3.5) 범위다. (`findings` 2-6c)
- **FR-013** (§3.4-8, US5): 이니셜 뱃지(`detail/InitialBadge.tsx:10`)는 **크기만** 원본에 맞추고 배경색 종류를 늘리지 않아야 한다. 원본은 사람마다 색이 다르지만 채택하지 않는다 — 색이 사람을 식별하지 못하고 anti-ai-slop의 「색은 의미에만」에 걸린다. (`findings` 2-6b)
- **FR-014** (§3.4-9, US6): `src/lib/posts.ts`의 `getPostDetail()` 참여자 조회에 `.orderBy(asc(participants.joinedAt), asc(users.login))`을 추가해야 한다. (`req FR-026`, `TC-DETAIL-01`)
- **FR-016** (§3.4-10, US7): `AppShell`의 `<main>`에 본문 최대 폭 1300px를 되살려야 한다. 루트의 `min-width:1280px` 제거(375px 1열 대응, `prd.md` F0-3)는 그대로 유지한다 — 두 값은 독립이며, `AppShell.tsx:4` 주석이 `min-width`만 설명하고 있으므로 주석도 두 값을 구분해 다시 쓴다. (`interactions.md` §3.5)
- **FR-017** (§3.4-11, US7): 성실 멤버 랭킹을 스터디 그리드의 사이드바에서 아카이브 카드와 같은 행(`1.5fr : 1fr`)으로 옮기고, CLI 푸터를 맨 아래 독립 블록으로 내려야 한다. `RealtimeFeed`의 `aside` prop을 없애고 `app/dashboard/page.tsx`의 조립 순서를 바꾼다. **이 항목만 컴포넌트 구조를 바꾼다** — 데이터 흐름·응답 계약·Realtime 채널 수(1개)는 그대로다. (`interactions.md` §3.5)
- **FR-018** (§3.4-12, US7): 스터디 카드에 `min-height`와 하단 스페이서를 넣어 `[상세보기]`가 항상 카드 바닥에 오게 하고 패딩을 원본 값으로 맞춰야 한다. (`interactions.md` §3.5)
- **FR-019** (§3.4-12, US7): 점선 개설 카드(`feed/EmptyState.tsx`)를 가로·세로 중앙 정렬하고 연녹색 틴트 배경과 **42px 픽셀 개구리 SVG**를 넣어야 한다. 개구리는 `Dashboard.html` 개설 카드가 쓰는 **1종만** 컴포넌트로 만든다 (2026-10-18 사용자 결정) — 색 변형을 prop으로 받는 범용 컴포넌트를 만들지 않는다. **개구리 도감·획득 배지(§1.3 보류)와 무관하며 그 보류를 푸는 것이 아니다.** (`interactions.md` §3.5)
- **FR-020** (§3.4-12, US7): 섹션 제목 옆 건수(`feed/StudyGrid.tsx:34`)에서 흰 바탕·테두리를 제거하고 `#3c7a1e` 글자만 남겨야 한다. 같은 단계에서 태그 칩(`card/CardMeta.tsx`의 `TagList`)의 **첫 칸만** 액센트 틴트로 바꾼다 — 원본은 대표 주제를 앞세우고 나머지는 무채인데 구현은 전부 같다. (`interactions.md` §3.3·§3.5)
- **FR-023** (§3.4-12, US7): 카드의 리더 줄(`card/CardMeta.tsx`의 `LeaderLine`)을 `#F4F7E8` 패널에 담고 우측에 20px 원형 `✓`를 붙여야 한다. **`✓`는 42 인증 완료 표시이며 `campus !== null`일 때만 렌더한다** (2026-10-18 사용자 결정). 응답 계약을 바꾸지 않고 쓸 수 있는 유일한 신호가 `campus`이기 때문이다. 캠퍼스 뱃지와 정보가 겹치지만 원본이 부제와 `✓`를 함께 두므로 따른다. 리더 횟수는 표기하지 않는다. `✓`는 anti-ai-slop에 이미 등재된 글리프 6종 안에 있으므로 새 예외가 아니다. (`interactions.md` §3.5)
- **FR-024** (§3.4-12, US7): 카드 메타는 **항목을 바꾸지 않고 배치만** 원본을 따라야 한다. `스터디 기간`·`진행 방식`은 메타 영역에 남기고 `모집 현황`만 하단 CTA 왼쪽으로 내린다. 원본의 `사이클`을 추가하지 않고, 원본에 없는 `진행 방식`을 빼지 않는다 — 온/오프라인 구분이 참여 판단에 쓰인다 (2026-10-18 사용자 결정). (`interactions.md` §3.5)
- **FR-025** (§3.4-5, US4): 랭킹 행 박스는 **채택하지 않아야 한다.** 원본은 1~3위 행에 패널·테두리·그림자를 씌워 메달 색과 함께 두 번 구분하지만, 구현은 메달 색만 쓰고 다섯 행을 같은 맨 줄로 둔다 (2026-10-18 사용자 결정). 다음 대조에서 "누락"으로 세지 않는다. (`interactions.md` §3.4)
- **FR-021** (§3.4-13, US7): CLI 푸터가 고정폭 `GalmuriMono`를 써야 한다. `globals.css`에 CDN 배포명(`GalmuriMono11`)을 가리키는 별칭 `@font-face`를 추가한다. 박스가 폭을 채우지 않는 것과 안내 문구가 박스 밖 아래에 오는 것도 함께 맞춘다. (`interactions.md` §3.5)
- **FR-022** (전 범위, US5·US7): 원본보다 **작아진** 치수를 원본 값으로 키워야 한다. 실측 결과 확인한 모든 자리에서 구현이 더 작으며, 줄인 근거가 문서 어디에도 없다. 임의로 중간값을 쓰지 않는다. (`interactions.md` §3.3·§3.5)
- **FR-015** (전 범위): DB 마이그레이션·스키마·API 응답 계약을 바꾸지 않아야 한다. 변경은 토큰·클래스 문자열·컴포넌트 치수·레이아웃 조립과 위 정렬 1건으로 한정한다. (`req FR-026`)

### Key Entities

- **색 역할 3단 (`AccentRole`)**: 원본이 녹색을 쓰는 세 자리의 구분. `submit`(`accent` `#5FB63A` — 제출·참여·완주 `✓` 칩) / `selected-segment`(`accent-bright` `#9be06a` — 세그먼트·탭·메뉴·이력 `완주` 칩) / `selected-card`(`accent-soft` `#E4F1D4` — 유형 선택 카드·이력 `진행중` 칩). LIVE 계열(`live` `#16a34a`)은 이 3단 밖의 별도 축이다.
- **텍스트 색 4단 (`TextTone`)**: `ink`(본문 강조) → `muted`(일반 보조, `#6b705c`) → 부속 메타(`#8a8f7a`) → 본문 단락(`#4b5040`). 뒤 2개가 신설이고 이름은 `speckit-plan`에서 정한다. 사이드바 비활성(`#aab49c`)은 어두운 배경 전용이라 이 축에 넣지 않는다.
- **픽셀 폰트 적용 자리 (`PixelFontSlot`)**: `px`를 쓰는 자리는 버튼·탭·숫자/대문자 약어 뱃지이고, 쓰지 않는 자리는 한글 문구 칩·본문·라벨이다. 전자 중 **버튼·탭만** `font-weight`를 금지하고 이니셜 뱃지는 `800`을 유지한다. 자리 10종의 치수는 `interactions.md` §3.3 표가 SSOT다.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 선택 상태에 `bg-accent`를 쓰는 지점이 `src/`에 0건이다. 세그먼트·탭·메뉴는 `accent-bright`, 카드는 `accent-soft`, `accent`는 제출·참여 버튼에만 남는다.
- **SC-002**: `#71717a`가 저장소에 0건이고 `tailwind.config.ts`의 `muted`가 `#6b705c`다. 신설 텍스트 토큰은 정확히 2개다.
- **SC-003**: 액센트 버튼·탭 컴포넌트의 클래스 문자열에 폰트 클래스 `px`가 있고 `font-bold`가 없다. 정렬 칩·상태 칩·라벨에는 `px`가 없다. (Tailwind 가로 패딩 유틸은 세지 않는다)
- **SC-004**: 랭킹 1·2·3위 뱃지 색이 서로 다르고 4·5위가 무채 표면색이며, 다섯 자리 치수가 같다.
- **SC-005**: `getPostDetail()`의 참여자 목록이 참여 행 수와 무관하게 결정적이고 리더가 첫 행이다.
- **SC-006**: 9개 화면 중 포팅 대상 8개를 브라우저에서 원본 HTML과 나란히 열어 대조했을 때, `findings.md` 2-5~2-9가 나열한 불일치가 전부 해소되거나 **불채택 근거가 문서에 남아 있다**(2-6b·2-8e).
- **SC-007**: 1920px 폭에서 본문이 1300px를 넘지 않고, 375px에서 여전히 1열로 접힌다. 블록 순서가 원본과 같고, 제목 줄 수가 다른 카드들의 `[상세보기]`가 모두 같은 높이에 있다.
- **SC-008**: 로컬 필수 게이트 5종(`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm drizzle-kit check`)이 100% 통과하고, 새 마이그레이션이 0건이다.

## Assumptions

- **`findings.md` 2-B절의 전수 대조는 색·폰트 중심이었고 레이아웃을 보지 않았다.** 그래서 US7의 6건(본문 폭·블록 배치·CTA 바닥 정렬·개설 카드 중앙 정렬과 개구리·건수 박스·CLI 글꼴)과 FR-005(정렬 칩)가 목록에 없었다. 전부 2026-10-18에 사용자가 실제 화면을 보고 추가했다. **다음 대조에서는 "색이 맞는가"와 별개로 "블록이 제자리에 같은 폭으로 있는가"를 따로 센다.**
- `interactions.md` §3.3~3.4의 치수·색은 정적 렌더된 원본 HTML 실측값이므로 재측정하지 않고 그대로 쓴다.
- 토큰 이름(`FR-007`의 신설 2개)과 미등록 색의 채택 범위는 `speckit-plan` 단계에서 정한다. 이 스펙은 "몇 개를 만드는가"와 "무엇을 만들지 않는가"만 고정한다.
- Test Suite 9는 정적 단정으로 구현 가능하다고 본다. 소스 문자열 단정은 클래스 문자열이 템플릿 리터럴로 쪼개지면 깨지므로, `speckit-plan`에서 단정 방식(파일 읽기 + 정규식 vs. 상수 추출)을 정한다.

## Dependencies

- `docs/requirement.md` (`FR-026`, `FR-010`, `FR-019`, `FR-021`, §3 Test Suite 9: `TC-DESIGN-01`~`03`·`TC-DETAIL-01`)
- `docs/designs/interactions.md` §3.3~3.5 — **값의 SSOT** (§3.5는 2026-10-18 신설: 레이아웃 골격·카드 치수·CLI 글꼴)
- `specs/008-design-fidelity/findings.md` 2-5~2-13 — 지점별 대조 결과
- `docs/next-steps.md` §3.4 — 작업 순서 9단계
- `CLAUDE.md` §10, `.claude/rules/anti-ai-slop.md` 「프로젝트 예외」
- `docs/designs/*.html` 8개 (`PixelFrog.html` 제외)
