---

description: "006 대시보드 UI 결합 & 실시간 동기화 작업 체크리스트"
---

# Tasks: 대시보드 UI 결합 & 실시간 동기화 (Phase 3 본편)

**Input**: Design documents from `/specs/006-dashboard-realtime/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: 헌법 I이 핵심 도메인 로직에 TDD를 강제한다. 이 브랜치의 TDD 대상은 **단기 파티 마감(FR-020)·표기 파생·이력 분류·KST 경계**다. 컴포넌트 렌더 테스트는 도입하지 않는다(research R14) — 화면은 [quickstart.md](./quickstart.md) 수동 시나리오로 검증한다.

**Organization**: 유저 스토리별 Phase로 묶는다. 각 Phase는 독립적으로 동작·검증 가능한 증분이다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완 작업에 의존하지 않음)
- **[Story]**: 해당 유저 스토리 (US1~US5)
- 설명에 정확한 파일 경로를 적는다

## Path Conventions

단일 프로젝트. 저장소 루트의 `src/`·`tests/`를 쓴다 (`CLAUDE.md` §3).

**Phase 순서에 관한 주의:** 실시간(US4, P2)을 프로필(US5, P3)보다 **뒤**에 둔다. 우선순위 역행이지만 의도된 것이다 — 피드가 먼저 그려져야 붙일 자리가 생기고, 공개 키 형식 실측(U3)이 걸려 있어 막히면 다른 화면 작업이 함께 멈춘다 (`docs/next-steps.md` §3, plan.md R11).

---

## Phase 1: Setup (디자인 기반)

**Purpose**: 폰트·토큰·눌림 클래스를 먼저 세운다. 이게 없으면 포팅한 화면의 색과 폰트가 디자인과 다르게 나온다 (`docs/next-steps.md` §3.1의 1~3).

- [X] T001 `tailwind.config.ts`에 색 토큰 등록 — `bg:#EDEFE0`, `ink:#18181b`, `accent:#5FB63A`, `accent-hover:#6cc546`, `accent-dark:#3c7a1e`, `accent-soft:#E4F1D4`, `accent-bright:#9be06a`, `live:#16a34a`, `sidebar:#20301C`, `card:#fffef7`, `muted:#71717a` (research R6)
- [X] T002 `tailwind.config.ts`에 폰트 토큰 등록 — `sans: ['Pretendard Variable', ...]`, `px: ['Galmuri11', 'Pretendard Variable', sans-serif]`
- [X] T003 `src/app/globals.css` 전면 교체 — Pretendard(`cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css`)·Galmuri(`cdn.jsdelivr.net/gh/quiple/galmuri@2.40.4/dist/galmuri.css`) `@import`, `body` 배경 `#EDEFE0`·텍스트 `#18181b`, Next 기본 다크모드 변수와 `font-family: Arial` 제거 (research R5)
- [X] T004 `src/app/globals.css`에 `@layer components`로 `.nb` 추가 — `--nb-depth:3px` 기본, `border:2.5px solid #18181b`, `box-shadow:var(--nb-depth) var(--nb-depth) 0 #18181b`, `transition:background-color 120ms,color 120ms`, `.nb:active`는 `transform:translate(var(--nb-depth),var(--nb-depth))`+`box-shadow:none`. `transform`에 `transition`을 걸지 않는다 (`docs/designs/interactions.md` §3.1)
- [X] T005 `src/app/globals.css`에 `.px`(Galmuri 타이틀)·`pulse` 키프레임(`opacity`+`transform:scale`만, 1.4s)·`.hs`(가로 스크롤바) 추가. `pulse`는 지름 10px 이하 LIVE 상태 점에만 쓴다 (CLAUDE.md §10)
- [X] T006 `src/app/layout.tsx` 교체 — `next/font/local`과 Geist 2개 제거, `<html lang="ko">`, `metadata`를 `모두의 42`로, `MockAuthModal` 유지
- [X] T007 `src/app/fonts/GeistVF.woff`·`GeistMonoVF.woff` 삭제
- [X] T008 [P] `src/lib/supabase/client.ts` 신규 — `createBrowserClient`(`@supabase/ssr`) 싱글턴. `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`가 없으면 명확한 에러를 던진다 (research R10)
- [X] T009 [P] `src/app/page.tsx` 교체 — Next.js 기본 템플릿을 지우고 `/dashboard`로 `redirect()` (research R12)

**Checkpoint**: `pnpm dev`에서 배경·폰트가 디자인 톤으로 바뀌고 `/`가 `/dashboard`(아직 404)로 간다.

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**Purpose**: 표기 파생·KST 경계·앱 셸처럼 모든 화면이 공유하는 조각. **⚠️ 이 Phase가 끝나기 전에는 스토리 작업을 시작하지 않는다.**

### 테스트 먼저 (Red)

- [X] T010 [P] `tests/lib/display.test.ts` 신규 — `remainingLabel`(1분 미만 올림 `1분 남음`, 60분 미만 `N분 남음`, `N시간`·`N시간 M분 남음`), `ddayLabel`(0 이하 `D-Day`, 그 외 `D-N`, KST 날짜 기준), `initials`(`borlee→BR`, `42-foo→42`, 1자 핸들은 1자), `headcountLabel`(`max=null`이면 `null`, 그 외 `4/6명`), `cycleLabel`(`26.11.1~11.30`)을 Red로 작성 (data-model.md §5)
- [X] T011 [P] `tests/lib/end-date.test.ts`에 `endOfKstDay` 경계 케이스 추가 — 입력 시각이 속한 KST 날짜의 `23:59:59.999`를 UTC로 돌려주고, `kstDayRange(now).end - 1ms`와 같은 값임을 Red로 고정 (research R3)

### 구현 (Green)

- [X] T012 `src/lib/display.ts` 신규 — `remainingLabel`·`ddayLabel`·`initials`·`headcountLabel`·`cycleLabel`. `@/db`를 import하지 않는다(클라이언트 안전). `remainingLabel`·`ddayLabel` 본문은 `src/lib/cli-format.ts`에서 **이동**시킨다 (research R2)
- [X] T013 `src/lib/cli-format.ts` 수정 — 자체 `remainingLabel`·`ddayLabel` 정의를 지우고 `@/lib/display`에서 import. **CLI 출력 문자열이 1바이트도 바뀌지 않아야 한다** (기존 `tests/lib/cli-format.test.ts`·`tests/api/cli-list.test.ts`가 안전망)
- [X] T014 `src/lib/end-date.ts`에 `endOfKstDay(date: Date): Date` 추가 — 주석에 용도(단기 파티 마감 경계, FR-020)를 적는다
- [X] T015 [P] `src/components/card/InitialBadge.tsx` 신규 — `login`을 받아 `initials()`로 2자 뱃지를 렌더. 외부 이미지를 쓰지 않는다 (CLAUDE.md §7.2)
- [X] T016 [P] `src/components/card/CampusBadge.tsx` 신규 — `campus`가 `null`이면 **요소 자체를 만들지 않는다**(`return null`). `GS→42경산`, `SEOUL→42서울`. 기수 표기 없음 (data-model.md §5.6)
- [X] T017 [P] `src/lib/error-message.ts` 신규 — `AppError` 코드별 한국어 문장 매핑. `CLOSED`는 상황에 따라 "모집이 마감되었습니다."/"마감일이 지난 파티입니다.", `FULL` "정원이 찼습니다.", `FORBIDDEN` "권한이 없습니다.", `BAD_REQUEST`는 서버 메시지 우선, `NOT_FOUND` "게시글을 찾을 수 없습니다." (spec FR-024, CLAUDE.md §8)
- [X] T018 `src/components/layout/Sidebar.tsx` 신규 — 로고(`42` + `모두의 42`, Galmuri), 메뉴 4개(대시보드·정규 스터디·단기 파티·명예의 전당)를 섹션 앵커(`/dashboard`, `#studies`, `#parties`, `#archive`)로, 하단 프로필 블록(`/profile` 링크, `InitialBadge`+`CampusBadge`). 비활성 메뉴 호버는 `hover:bg-white/[0.08] hover:text-white`. 개구리 도감 항목은 만들지 않는다 (spec FR-005, FR-039)
- [X] T019 `src/components/layout/AppShell.tsx` 신규 — 사이드바 + 메인 2열. 디자인 원본의 `min-width:1280px`를 **옮기지 않고** 375px에서 1열로 접히게 한다 (spec SC-008)
- [X] T020 `src/components/layout/LoginRequired.tsx` 신규 — 비로그인 안내 + 개발 환경에서만 Mock 전환 안내. `NODE_ENV !== 'development'`에서는 Mock 문구를 렌더하지 않는다 (spec FR-040, FR-041)

**Checkpoint**: `pnpm test`가 T010·T011 포함 전건 통과. 셸과 공통 뱃지가 준비됨.

---

## Phase 3: User Story 1 — 대시보드 피드 (Priority: P1) 🎯 MVP

**Goal**: 로그인한 유저가 LIVE 핑 전광판·마감 임박 파티·모집 중 정규 스터디·아카이브·랭킹을 한 화면에서 본다.

**Independent Test**: 네 유형이 섞인 데이터로 `/dashboard`를 열어 각 영역이 자기 정렬 기준으로 렌더되고, 만료된 LIVE 핑·마감된 파티·취소된 글이 피드에 없음을 확인한다.

### 테스트 먼저 (Red)

- [X] T021 [P] [US1] `tests/party-expiry.test.ts` 신규 — **TC-PARTY-01**: `end_date`가 과거인 `RECRUITING` 파티가 `listPosts({type:'PARTY'})`와 `listForCli()` 결과에서 제외되고, 마감 전 파티·정규 스터디·`end_date IS NULL` 파티는 포함되며, 제외된 글의 `status`가 DB에서 여전히 `RECRUITING`임을 Red로 작성 (contracts/party-expiry.md §1)
- [X] T022 [P] [US1] `tests/party-expiry.test.ts`에 개설 정규화 케이스 추가 — `PARTY`를 `endDate: '2026-10-14'`로 개설하면 저장값이 `2026-10-14T14:59:59.999Z`(KST 23:59:59.999)이고, `STUDY`의 자동 산출은 변하지 않음을 Red로 작성 (contracts/party-expiry.md §4)

### 도메인 구현 (Green)

- [X] T023 [US1] `src/lib/posts.ts`의 `createPost` 수정 — `PARTY`의 `endDate`를 `endOfKstDay()`로 정규화해 저장. `STUDY`는 `computeStudyEndDate` 그대로 (data-model.md §1)
- [X] T024 [US1] `src/lib/posts.ts`의 `listPosts` 수정 — LIVE Lazy Filter 옆에 `OR(type <> 'PARTY', end_date IS NULL, end_date > now)` 조건 추가. 주석에 FR-020과 "상태 전이가 아니다"를 명시 (data-model.md §2)

### 화면 구현

- [X] T025 [P] [US1] `src/components/card/StudyCard.tsx` 신규 — 태그·모집 상태 뱃지·제목·리더(`InitialBadge`+`login`+`CampusBadge`)·스터디 기간(`cycleLabel`)·모집 현황(`headcountLabel`)·`[상세보기 ↗]`. **리더 횟수·완주율·42 인트라 뱃지는 렌더하지 않는다** (spec FR-005, FR-008)
- [X] T026 [P] [US1] `src/components/card/PartyCard.tsx` 신규 — 태그 뱃지·`ddayLabel` 배지·제목·`10/14 마감 · 코엑스` 표기·인원·`[상세보기 ↗]`
- [X] T027 [P] [US1] `src/components/card/LivePingCard.tsx` 신규 — 내용·위치·`remainingLabel`·작성자 본인에게만 `[완료]`. 상태 점에만 `pulse` 사용 (spec FR-013)
- [X] T028 [P] [US1] `src/components/feed/EmptyState.tsx` 신규 — 점선 테두리 개설 카드. 호버 `hover:bg-accent-soft` (spec FR-015)
- [X] T029 [US1] `src/components/feed/LivePingBoard.tsx` 신규 — 전광판 가로 바(`.hs`), `[+ 핑 보내기]`는 `/create?type=LIVE`로. 조기 완료는 `POST /api/posts/:id/complete-ping` 호출 후 `router.refresh()`
- [X] T030 [US1] `src/components/feed/PartyRail.tsx` 신규 — 마감 임박순 가로 스크롤(`.hs`), `#parties` 앵커, "전체 보기"는 같은 섹션 앵커로 둔다(새 라우트를 만들지 않는다, research R12)
- [X] T031 [US1] `src/components/feed/StudyGrid.tsx` 신규 — `#studies` 앵커, `[최신순]`/`[마감임박순]` 토글을 `?sort=latest|deadline` 쿼리로 서버 재조회 (spec FR-007)
- [X] T032 [US1] `src/components/feed/ArchiveTabs.tsx` 신규 — `#archive` 앵커, 🏆명예의 전당 / 🪦Post-mortem 탭을 `?archive=completed|postmortem` 쿼리로. `GET /api/hall-of-fame` 응답을 렌더하며 단기 파티는 들어오지 않는다 (spec FR-011)
- [X] T033 [P] [US1] `src/components/feed/Leaderboard.tsx` 신규 — 1~5위 `login`·누적 완주·누적 리더. **완주율 표기 없음** (spec FR-012)
- [X] T034 [P] [US1] `src/components/feed/CliFooter.tsx` 신규 — `$ curl modoo42.com/api/list` 안내 블록
- [X] T035 [US1] `src/app/dashboard/page.tsx` 신규 — RSC. `getCurrentUser()`로 세션 확인(없으면 `LoginRequired`), `listPosts`를 유형별로 호출하고 `listHallOfFame`·`getLeaderboard`를 함께 조회해 위 컴포넌트에 내려준다. `fetch`를 쓰지 않는다 (research R1)

**Checkpoint**: `/dashboard`에서 네 영역이 보이고 정렬·탭 전환이 동작한다. `pnpm test`에 TC-PARTY-01이 포함돼 통과한다.

---

## Phase 4: User Story 2 — 상세 모달과 2단계 참여 (Priority: P1)

**Goal**: 카드에서 상세를 열어 정보를 확인하고, 확인 팝업을 거쳐 참여하면 기록이 남고 새 탭으로 채팅방이 열린다. 비참여자에게 초대 링크는 어디에도 노출되지 않는다.

**Independent Test**: 비참여자 세션으로 상세 모달을 열어 초대 링크가 화면·전달 데이터 모두에 없음을 확인한 뒤 참여를 끝까지 수행하고, 같은 글을 다시 열어 링크 재열람 버튼이 보이는지 확인한다.

### 테스트 먼저 (Red)

- [X] T036 [US2] `tests/party-expiry.test.ts`에 **TC-PARTY-02** 추가 — 마감 지난 파티에 비참여자가 `joinPost`를 호출하면 `CLOSED`(400)이고 `current_members`가 불변이며, 이미 `JOINED`인 유저는 200 + 기존 `chatUrl`을 받고, 상세 조회(`getPostDetail`)는 계속 성공함을 Red로 작성 (contracts/party-expiry.md §3)

### 도메인 구현 (Green)

- [X] T037 [US2] `src/lib/posts.ts`의 `joinPost` 수정 — **멱등 반환 뒤, 정원 검증 앞**에 `type='PARTY' && end_date <= now` → `AppError('CLOSED', '마감일이 지난 파티입니다.')` 추가. 순서를 바꾸면 마감된 파티의 기존 참여자가 링크를 잃는다 (data-model.md §3)

### 화면 구현

- [X] T038 [P] [US2] `src/components/detail/ParticipantList.tsx` 신규 — 참여자 `InitialBadge`+`login`+`CampusBadge`, 리더 표시, 남은 자리를 `+ 빈 자리`로. 기수 표기 없음
- [X] T039 [P] [US2] `src/components/detail/JoinConfirmDialog.tsx` 신규 — 네이티브 `<dialog>`. 문구는 "정말 참여하시겠습니까? 참여 후에는 취소가 불가능하며 오픈채팅방으로 이동합니다." 그대로. `::backdrop`은 `rgba(24,24,27,.45)` 단색(`backdrop-filter` 금지) (research R7, spec FR-019)
- [X] T040 [US2] `src/components/detail/JoinConfirmDialog.tsx`에 참여 확정 처리 — 클릭 시점에 `window.open('', '_blank')`로 탭 선점 → `POST /api/posts/:id/join` → 응답 `chatUrl`을 그 탭 `location`에 주입. 반환값이 `null`(차단)이면 모달에 링크 버튼을 남긴다. 처리 중 버튼 비활성화로 중복 클릭 차단 (research R9, spec FR-020)
- [X] T041 [US2] `src/components/detail/LeaderActions.tsx` 신규 — 리더 본인에게만 `[수정하기]`·`[스터디 취소]`. **완주 판정·회고 버튼은 만들지 않는다**(`FR-021` 후속 브랜치, spec FR-045)
- [X] T042 [US2] `src/components/detail/PostDetailModal.tsx` 신규 — 소개·기간·사이클·진행 방식·장소·`chatPlatform` 배지·`referenceUrl`·참여자 목록을 렌더. `joinability`(data-model.md §6)로 버튼을 가른다 — `[참여하기 ↗]`/`[오픈채팅 바로가기 ↗]`/`[모집 완료]`/`[마감]`/`[완주 종료]`/`[취소된 모집]`+`cancelReason`. 자진 취소 버튼은 없다
- [X] T043 [US2] `src/app/dashboard/page.tsx` 수정 — `?post=<id>`를 받아 `getPostDetail(id, me.id)` 결과를 `PostDetailModal`에 내려준다. 비참여자 응답에 `chatUrl` 키가 없는 상태 그대로 전달한다(별도 마스킹 코드를 만들지 않는다) (research R8, 헌법 V)
- [X] T044 [US2] 참여 성공 후 `router.refresh()`로 서버 재판정 — 같은 글을 다시 열면 `[오픈채팅 바로가기 ↗]`가 보인다 (spec FR-021)

**Checkpoint**: 비참여자 상세에 링크 없음, 2단계 참여 성공, 재열람 가능. TC-PARTY-02 통과.

---

## Phase 5: User Story 3 — 개설 폼 3종 (Priority: P2)

**Goal**: 유형별 폼으로 정규 스터디·단기 파티·LIVE 핑을 개설한다. 제한을 넘는 입력은 이유와 함께 거절된다.

**Independent Test**: 세 유형으로 각 1건을 개설해 대시보드에 나타나는지 확인하고, 제목 41자·정원 11명·화이트리스트 밖 링크·태그 4개가 거절되는지 확인한다.

- [X] T045 [P] [US3] `src/components/create/TypeSwitch.tsx` 신규 — `?type=STUDY|PARTY|LIVE` 쿼리로 유형 전환. 선택된 유형의 항목만 렌더 (spec FR-025)
- [X] T046 [P] [US3] `src/components/create/TemplatePicker.tsx` 신규 — `GET /api/templates`의 6종(코딩테스트·모각코·책 완독·듀오링고·음악 감상·자유) 버튼. 누르면 기본 제목·설명·태그를 채우고 유저가 수정할 수 있다 (spec FR-026)
- [X] T047 [US3] (구현: `src/components/create/RecruitForm.tsx` — STUDY·PARTY가 입력 항목이 같아 한 폼으로 뒀다) — `title` **최대 40자**, `description` **최대 300자**, `tags` **1~3개**, `locationType` **ONLINE/OFFLINE_GS/OFFLINE_SEOUL/HYBRID 4종만**, `place`, `maxMembers` **2~10, 기본 10**, `chatPlatform`, `chatUrl` **화이트리스트**(`https://open.kakao.com/`·`https://discord.gg/`·`https://discord.com/invite/`), `referenceUrl` **`https://` 만**. 종료일은 **읽기 전용 안내**로 보여주고 입력받지 않는다 (CLAUDE.md §7.1, spec FR-027·FR-029)
- [X] T048 [US3] (구현: `RecruitForm.tsx`의 `type="PARTY"` 분기) — `StudyForm`과 같은 제약에 **마감일 Datepicker 직접 지정**을 더한다. 과거 날짜를 고를 수 없게 한다 (spec FR-027)
- [X] T049 [US3] `src/components/create/LivePingForm.tsx` 신규 — `text` **최대 50자**, `place` **필수**, `durationMinutes` **30/60/120/180 택1** 3개만. 정원·초대 링크·태그 입력을 두지 않는다 (spec FR-028)
- [X] T050 [US3] `src/app/create/page.tsx` 신규 — RSC 셸 + 클라이언트 폼. `POST /api/posts` 호출, 성공 시 `/dashboard`로 이동. 실패 시 `error-message.ts`로 사유 표시 (spec FR-024)
- [X] T051 [US3] LIVE 핑 하루 1회 제한 안내 — 서버가 `BAD_REQUEST`로 거절하면 등록 입구를 비활성화하고 이유를 보여준다. 클라이언트가 직접 날짜를 세지 않는다(서버가 SSOT) (spec FR-030)

**Checkpoint**: 세 유형 개설 성공, 제한 위반 시 사유 표시.

---

## Phase 6: User Story 5 — 프로필과 스터디 이력 (Priority: P3)

**Goal**: 내 누적 완주·리더 횟수와 참여 이력을 완주·진행 중·종료로 나눠 본다.

**Independent Test**: 완주·리더·진행 중 이력이 섞인 유저로 `/profile`을 열어 세 구분이 실제 참여 기록과 일치하고 카운트가 완주 판정 결과와 같은지 확인한다.

### 테스트 먼저 (Red)

- [X] T052 [P] [US5] (구현: `tests/profile.test.ts` — DB를 쓰는 테스트라 `tests/lib`(순수 함수) 대신 루트에 뒀다) — `getProfile`의 분류 규칙을 Red로 작성: 참여 `COMPLETED`→`COMPLETED`, 글 `RECRUITING`·`CLOSED`+참여 `JOINED`→`ONGOING`, 참여 `INCOMPLETE`·글 `CANCELLED`→`ENDED`. `isLeader`는 `post.leader_id === userId`, `hasPostmortem`은 `postmortem_text` 유무, 정렬은 최신순. 응답에 `id`·`github_id`·`intra_id`·`intra_verified_at`·`chat_url`이 없음을 함께 고정 (contracts/profile-view.md)

### 구현 (Green)

- [X] T053 [US5] `src/lib/profile.ts` 신규 — `getProfile(userId, database?)`. `users` 1행 + `participants ⋈ posts` 조인 1회. `completedCount`·`leaderCount`는 `users` 저장값을 그대로 읽는다(이력에서 다시 세지 않는다). 신규 테이블·컬럼을 만들지 않는다 (req FR-019, research R13)
- [X] T054 [P] [US5] `src/components/profile/ProfileHeader.tsx` 신규 — `login`·`InitialBadge`·`CampusBadge`(null이면 미렌더)·누적 완주·누적 리더. **완주율·자기소개·관심 태그는 만들지 않는다** (spec FR-005, FR-038)
- [X] T055 [P] [US5] `src/components/profile/HistoryList.tsx` 신규 — `category` 라벨(완주/진행중/종료)·`리더` 뱃지·`periodLabel`·`headcountLabel`·회고 뱃지. 이력 0건이면 빈 상태 안내
- [X] T056 [US5] `src/app/profile/page.tsx` 신규 — RSC. `getCurrentUser()` → `getProfile()` 호출. **개구리 도감·획득 배지 섹션을 만들지 않는다** (req §1.3, spec FR-005)

**Checkpoint**: `/profile`이 실제 참여 기록과 일치하는 이력을 보여준다.

---

## Phase 7: User Story 4 — 실시간 동기화 (Priority: P2, 마지막 배치)

**Goal**: 열어 둔 대시보드가 참여·마감·LIVE 핑 등장·조기 완료를 1초 안에 새로고침 없이 반영한다.

**Independent Test**: 브라우저 2개로 한쪽에서 참여·LIVE 등록·조기 완료를 하고 다른 쪽이 1초 안에 바뀌는지 확인한다.

**선행 확인 사항**: 공개 키가 신형 `sb_publishable_` 형식이라 수용 여부를 먼저 실측한다. 실패하면 레거시 anon JWT로 교체한다 (research R11).

- [X] T057 [US4] 실시간 연결 실측 — `src/lib/supabase/client.ts`로 `posts-channel`을 구독해 `SUBSCRIBED` 상태와 이벤트 수신을 확인한다. 실패 시 Supabase 대시보드의 레거시 anon 키로 재시도하고, **결과를 `docs/next-steps.md` U3에 기록한다** (`docs/next-steps.md` §1)
- [X] T058 [US4] `src/hooks/useRealtimePosts.ts` 신규 — `posts-channel` 1개 구독(`postgres_changes`, `schema:'public'`, `table:'posts'`, `INSERT`·`UPDATE`). 초기 상태는 서버가 내려준 목록. unmount 시 `removeChannel` (contracts/realtime-posts.md §2)
- [X] T059 [US4] `useRealtimePosts`의 `UPDATE` 처리 — 같은 `id` 카드에 `currentMembers`·`status`·`expiresAt`만 머지(제목 등 기존 값 유지), 없는 `id`는 무시, `type='LIVE'`+`status='CLOSED'`는 전광판에서 제거. 같은 이벤트가 두 번 와도 결과가 같아야 한다(멱등) (contracts/realtime-posts.md §3)
- [X] T060 [US4] `useRealtimePosts`의 `INSERT` 처리 — `type='LIVE'`만 `GET /api/posts?type=LIVE`로 전광판 재조회(이벤트 1건당 1회 이하). `STUDY`·`PARTY`는 무시. 보강 조회 실패 시 목록을 바꾸지 않는다(제목 없는 핑을 그리지 않는다)
- [X] T061 [US4] 연결 끊김 처리 — 구독 실패·끊김에서 화면을 비우지 않고 초기 서버 렌더 결과를 유지한다. 새로고침으로 최신 상태를 얻을 수 있어야 한다 (spec FR-035)
- [X] T062 [US4] (구현: `src/components/feed/RealtimeFeed.tsx` 클라이언트 묶음이 훅 1개를 쥐고 세 섹션에 내려준다) 훅 상태와 연결 — 서버 초기 데이터를 props로 받고 훅이 머지한 결과를 렌더
- [X] T063 [US4] LIVE 남은 시간 클라이언트 카운트다운 — 1초 간격으로 `remainingLabel` 재계산, 0에 닿은 핑은 화면에서 제거하되 **서버에 만료 요청을 보내지 않는다**(만료는 상태 전이가 아니다, CLAUDE.md §6.4)
- [X] T064 [US4] **보안 확인** — 개발자 도구 Network의 WebSocket 프레임에 `chat_url`·`title`이 오지 않음을 눈으로 확인한다. 보이면 즉시 중단하고 복제 컬럼 설정(U2)을 다시 적용한다 (contracts/realtime-posts.md §5, 헌법 V)

**Checkpoint**: 2창 교차 조작이 1초 내 반영되고 WebSocket 프레임에 민감 필드가 없다.

---

## Phase 8: Polish & 문서 동기화

- [X] T065 [P] `CLAUDE.md` §3 디렉터리 규약에 `src/hooks/`(클라이언트 전용 훅)와 `src/lib/supabase/`를 추가 (plan.md 신규 디렉터리 정당화)
- [X] T066 [P] `docs/next-steps.md` 갱신 — §3.1 선행 작업 1~4 완료 표시, U3 실측 결과(T057) 기록, Phase 3 진행 상태 반영
- [ ] T067 [P] (브라우저 실측 필요 — 사용자) 반응형 점검 — 375px 폭에서 가로 페이지 스크롤 0, 그리드 1열 접힘, 가로 스크롤 영역 터치 이동 (spec SC-008)
- [X] T068 [P] 디자인 자가 점검 — `grep -r "gradient" src/`·`grep -r "Geist\|Arial" src/` 0건, 색 들어간 `box-shadow`·`blur` 0건, `:hover`에 `transform` 0건, `pulse`는 LIVE 상태 점 외 미사용 (`.claude/rules/anti-ai-slop.md` 출력 전 점검)
- [X] T069 [P] 범위 밖 섹션 미포팅 확인 — 개구리 도감·획득 배지·대왕 개구리 게이지·완주율·통합 검색창·자기소개·리더 완주율 패널·주차별 커리큘럼·모임 주기가 화면에 없음 (spec FR-005)
- [X] T070 게이트 전건 실행 — `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm drizzle-kit check`. `drizzle-kit check`는 신규 마이그레이션 없이 통과해야 한다 (quickstart.md §1)
- [ ] T071 (브라우저 2창 실측 필요 — 사용자. §4의 WebSocket 보안 확인은 T064에서 스크립트로 선행 검증했다) [quickstart.md](./quickstart.md) §3 수동 11건과 §4 실시간 4건을 순서대로 실행하고 결과를 기록
- [ ] T072 PR 작성 — `.github/pull_request_template.md` 구조(📌 Summary, 🛠️ Key Changes, 🧪 Verification, 🔗 Related Specs). 본문은 한국어. `FR-013`·`FR-014`·`FR-019`·`FR-020`·`NFR-004` 이행과 `FR-021` 분리 사유를 적는다

---

## Dependencies & Execution Order

### Phase 의존성

- **Phase 1 Setup**: 의존 없음. 즉시 시작
- **Phase 2 Foundational**: Phase 1 완료 후. **모든 스토리를 막는다**
- **Phase 3 US1**: Phase 2 후. 다른 스토리에 의존하지 않음
- **Phase 4 US2**: Phase 2 후 시작 가능하지만, 상세 모달 진입점이 US1의 카드이므로 US1 뒤에 두는 편이 검증이 쉽다
- **Phase 5 US3**: Phase 2 후. US1·US2에 의존하지 않음(개설 결과 확인은 US1이 있으면 편하다)
- **Phase 6 US5**: Phase 2 후. 완전 독립
- **Phase 7 US4**: **US1 필수**(붙일 카드가 있어야 한다). T057 실측이 막히면 이 Phase만 멈춘다
- **Phase 8 Polish**: 원하는 스토리 완료 후

### 스토리 내 순서

- 테스트(Red) → 도메인(Green) → 컴포넌트 → 페이지 결합
- `display.ts`·`InitialBadge`·`CampusBadge`가 모든 카드의 선행
- `joinability` 표(data-model.md §6)가 US2 버튼 분기의 기준

### 병렬 기회

- T008·T009 (Setup 후반)
- T010·T011 (Foundational 테스트 2건)
- T015·T016·T017 (공통 컴포넌트·매핑)
- T021·T022 (US1 테스트 2건)
- T025·T026·T027·T028·T033·T034 (카드·위젯 6개, 서로 다른 파일)
- T038·T039 (US2 컴포넌트 2건)
- T045·T046 (US3 폼 조각)
- T054·T055 (US5 컴포넌트 2건)
- T065~T069 (Polish 점검 5건)

---

## Parallel Example: User Story 1

```bash
# 테스트 먼저 (같이 작성 가능)
Task: "tests/party-expiry.test.ts TC-PARTY-01 (조회 제외)"
Task: "tests/party-expiry.test.ts 개설 정규화 케이스"

# 카드·위젯 6개 동시 작업 (전부 다른 파일)
Task: "src/components/card/StudyCard.tsx"
Task: "src/components/card/PartyCard.tsx"
Task: "src/components/card/LivePingCard.tsx"
Task: "src/components/feed/EmptyState.tsx"
Task: "src/components/feed/Leaderboard.tsx"
Task: "src/components/feed/CliFooter.tsx"
```

---

## Implementation Strategy

### MVP (US1까지)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1
4. **멈추고 검증**: `/dashboard`가 네 영역을 그리고 TC-PARTY-01이 통과한다
5. 이 시점에서 "읽을 수 있는 제품"이 된다

### 증분 전달

1. Setup + Foundational → 기반 완료
2. US1 → 피드 열람 (MVP)
3. US2 → 참여 전환 루프 완성 (제품의 핵심 동작)
4. US3 → 글을 만들 수 있게 됨 (자급 가능)
5. US5 → 기록 확인
6. US4 → 실시간 보강 (없어도 제품은 동작한다)

### 커밋 단위

- Phase 1·2는 각 Phase 끝에서 1커밋(`chore:`/`feat:`)
- 스토리 Phase는 테스트(Red) + 구현(Green)을 묶어 기능 단위 커밋(`feat:`)
- 문서 동기화는 `docs:`로 분리

---

## Notes

- `[P]` = 다른 파일, 의존 없음
- 테스트는 **반드시 실패를 확인한 뒤** 구현한다 (헌법 I)
- `pnpm test`는 CI에 없다. PR 전 로컬 전건 통과가 필수 게이트다 (NFR-006)
- 신규 의존성을 추가하지 않는다. 추가가 필요하다고 판단되면 그 자체를 설계 재검토 신호로 본다 (plan.md)
- DB 스키마를 바꾸지 않는다. 신규 마이그레이션 파일이 생기면 설계를 벗어난 것이다
- 완주 판정·회고 화면으로 가는 입구를 만들지 않는다 (`FR-021`은 후속 브랜치)
