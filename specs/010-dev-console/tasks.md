---

description: "Task list for 010-dev-console"
---

# Tasks: 개발자 콘솔 — 시각 주입 및 샌드박스 격리 (010)

**Input**: Design documents from `/specs/010-dev-console/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/dev-console-api.md`, `contracts/sandbox-isolation.md`, `quickstart.md`

**Tests**: 포함한다. Constitution 원칙 I이 핵심 도메인 로직의 TDD를 강제하고(`NON-NEGOTIABLE`), 인수 테스트 ID 12개(`TC-DEV-01`~`TC-DEV-12`)가 `requirement.md` §3 Test Suite 10에 이미 정의돼 있다. 테스트 제목에 그 ID를 그대로 쓴다.

**Organization**: `spec.md`의 US1~US6별 단계로 묶는다. Phase 2까지 끝나면 각 스토리를 독립적으로 구현·검증할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완 작업에 의존하지 않음)
- **[Story]**: US1~US6
- 경로는 저장소 루트 기준이다

---

## Phase 1: Setup

**Purpose**: 디렉터리와 스크립트 자리를 만든다. 코드 변경 없음.

- [X] T001 `.env.local`에 `DEV_CONSOLE_PASSWORD`를 추가하고 `.env.example`의 같은 키 설명과 일치하는지 확인한다 (`.env.example` 17~21행, 이미 등재돼 있다)
- [X] T002 [P] `src/lib/dev/`와 `src/components/dev/` 디렉터리를 만든다 — 상용에서 죽어야 하는 코드를 두 곳에 모은다 (`plan.md` Structure Decision)
- [X] T003 [P] `package.json`의 `scripts`에 `"sandbox:sync": "node scripts/sandbox-sync.mjs"`를 추가한다. 새 의존성을 설치하지 않는다 — `tsx`가 없으므로 `.mjs`를 쓴다 (`research.md` R7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 시각 소유권·게이트·콘솔 진입의 최소 골격. **US1~US6 전부가 이 단계를 기다린다.**

**⚠️ CRITICAL**: `requestDatabase()`는 이 단계에서 **항상 `public` 핸들**을 반환한다. 샌드박스 분기는 US4(T050)에서 붙인다 — 그래야 US1~US3이 샌드박스 없이 독립 검증된다.

### Tests (Red 먼저)

- [X] T004 [P] `tests/dev-clock.test.ts`를 만들고 `TC-DEV-02`(절대 시각 → `offsetMs` → 유효 시각 왕복, 음수 오프셋 포함)와 `TC-DEV-03`(`DEV_CONSOLE_PASSWORD` 미설정 시 `modoo42_dev_clock` 무시)을 작성한다. 환경변수 분기는 `vi.stubEnv` + `vi.resetModules`로 모듈을 다시 읽는다 (`contracts/dev-console-api.md` C7)
- [X] T005 [P] `tests/dev-timestamps.test.ts`를 만들고 `TC-DEV-08`(과거 `now`로 만든 정규 스터디의 `end_date`가 그 시점 기준)과 `TC-DEV-12`(`created_at`·`joined_at`이 그 과거 시각)를 작성한다. DB 통합이므로 트랜잭션 롤백으로 격리한다

### 시각·게이트 모듈

- [X] T006 `src/lib/dev/console-session.ts`를 만든다 — `isDevConsoleEnabled()`(`process.env.DEV_CONSOLE_PASSWORD`가 비어 있지 않은지), 서명 토큰 발급·검증(HMAC-SHA256, **키는 `DEV_CONSOLE_PASSWORD` 자체**, `research.md` R4), `hasValidConsoleSession()`. 비밀번호 비교는 `timingSafeEqual`을 쓰고 포맷은 `src/lib/session.ts`의 기존 서명 포맷을 재사용한다
- [X] T007 `src/lib/clock.ts`를 만든다 — `realNow()`, `serverOffsetMs()`, `serverNow()`. **오프셋 반영 조건은 `isDevConsoleEnabled()` 그리고 `hasValidConsoleSession()` 둘 다**이며, 하나라도 거짓이면 `modoo42_dev_clock`을 **읽지 않고** 실제 시각을 반환한다. 쿠키 값 형식은 `^-?\d{1,15}$`이고 파싱 실패는 `0`으로 본다 (`data-model.md` §1, `research.md` R5)
- [X] T008 `src/lib/dev/sandbox.ts`를 만든다 — `export const DEV_SANDBOX_SCHEMA = 'dev_sandbox'` 상수와 `requestDatabase()`. 이 단계에서는 항상 `public` 핸들(`src/db`의 `db`)을 반환한다. 스키마 이름 문자열 리터럴을 이 파일 밖에 두지 않는다 (`contracts/sandbox-isolation.md` 머리말)

### 기본값 제거와 주입 (`research.md` R1)

- [X] T009 `src/lib/session.ts`의 `createSessionToken`·`verifySessionToken`에서 `now: Date = new Date()` 기본값을 제거한다 (`31`·`38`행)
- [X] T010 `src/lib/auth.ts`와 `src/app/api/auth/**`의 세션 검증 호출부가 `realNow()`를 주입하도록 고친다. **세션 만료는 dev 시계를 따르지 않는다** (`FR-006`)
- [X] T011 `src/lib/posts.ts`의 함수 12개에서 `database: Database = defaultDb`와 `now: Date = new Date()` **기본값을 모두 제거**하고, `createPost`에 `now`를 마지막 인자로 신설한다(`61`행의 `computeStudyEndDate(new Date())`를 주입값으로 교체). `listHallOfFame` 오버로드의 `database?`도 필수로 바꾼다. 인자 순서(`…, database, now`)는 유지한다
- [X] T012 [P] `src/lib/leader-actions.ts`의 `leaderActionStateOf`(`101`행)와 완주 액션 함수(`205`행)에서 `now` 기본값을 제거한다
- [X] T013 `src/lib/posts.ts`의 타임스탬프 9지점에 유효 시각을 명시 삽입한다 — `created_at` 2곳(`70`·`145`), `joined_at` 삽입 2곳(`92`·`242`)과 재참여 갱신 1곳(`239`), 도메인 `updated_at` 4곳(`187`·`444`·`478`·`507`). **컬럼 기본값(`defaultNow()`)은 건드리지 않는다 — 마이그레이션 0건** (`research.md` R6). T005가 Green이 된다
- [X] T014 `tests/` 15개 파일의 도메인 호출부에 `database`·`now` 인자를 보강한다 (`identity-schema`·`posts-update`·`posts-cancel`·`posts-postmortem`·`profile`·`hall-of-fame`·`posts-complete`·`templates`·`posts-status`·`posts-join`·`posts-list`·`party-expiry`·`posts-live`·`posts-create`·`posts-detail`). `pnpm typecheck`가 남은 누락을 전부 열거한다
- [X] T015 Route Handler 14곳이 `requestDatabase()`와 `serverNow()`를 주입하도록 고친다 — `api/posts/route.ts`, `api/posts/[id]/{route,join,complete,cancel,postmortem,status,complete-ping}`, `api/hall-of-fame`, `api/leaderboard`, `api/templates`, `api/list`
- [X] T016 RSC 3곳의 직접 `new Date()` 호출을 `serverNow()`로 교체한다 — `src/app/dashboard/page.tsx:39`, `src/app/create/page.tsx:36`, `src/app/api/list/route.ts:34`. 이후 RSC·Route Handler에 직접 `new Date()`가 0건이어야 한다 (`SC-002`)

### 콘솔 진입 골격

- [X] T017 `src/app/api/dev/console/route.ts`를 만든다 — `POST`(게이트 404 → `timingSafeEqual` 비밀번호 검증 → `modoo42_dev_console` 서명 쿠키 발급), `DELETE`(`modoo42_dev_console`·`modoo42_dev_clock` 함께 삭제). **샌드박스 초기화·스냅샷은 US4(T053)에서 이 순서에 끼운다** (`contracts/dev-console-api.md` C2·C3)
- [X] T018 `src/components/dev/DevConsole.tsx`를 만든다 — 인증 · 시계 · 시나리오 3섹션의 빈 틀. 서버에서 `isDevConsoleEnabled()`가 거짓이면 `null`을 반환한다. 스타일은 기존 `src/components/MockAuthModal.tsx`의 네오브루탈리즘 패널을 그대로 잇고 새 색·모션·글리프를 들이지 않는다
- [X] T019 `src/components/dev/ConsoleEntry.tsx`를 만들고 `src/app/login/page.tsx`에 배치한다 — 비밀번호 입력 + 진입 안내 카피("이 세션에서 만든 데이터는 `dev_sandbox`에 들어가고 다음 진입 시 사라집니다. 오픈채팅방 링크는 더미입니다."). 게이트가 닫히면 렌더하지 않는다 (`prd.md` F7)
- [X] T020 `pnpm lint && pnpm typecheck && pnpm test`를 통과시킨다. T004·T005가 Green이고 기존 테스트가 전부 살아 있어야 한다

**Checkpoint**: 시각 단일 소스와 콘솔 세션이 섰다. US1~US6을 병렬로 시작할 수 있다.

---

## Phase 3: User Story 1 - 운영자가 달이 바뀌기를 기다리지 않고 시각 게이트를 통과한다 (Priority: P1) 🎯 MVP

**Goal**: 절대 시각(KST)을 입력해 서버·클라이언트의 유효 시각을 함께 옮기고, 판정창·LIVE 만료·파티 만료가 그 시각으로 판단되게 한다.

**Independent Test**: 판정창 밖의 정규 스터디를 띄워 두고 그 글의 `end_date` 월 15일로 이동 → 리더에게 완주 판정 입구가 열린다. `[실제 시각으로 복귀]`로 되돌아온다. 샌드박스(US4) 없이 검증된다.

### Tests

- [X] T021 [P] [US1] `tests/dev-clock.test.ts`에 절대 시각 이동 시나리오를 추가한다 — 콘솔 세션이 있을 때 `offsetMs`가 반영되고, 복귀 후 `serverNow()`가 실제 시각과 1초 이내로 같아진다

### Implementation

- [X] T022 [US1] `src/app/api/dev/clock/route.ts`의 `POST`를 만든다 — 입력 `{ at: ISO 8601 }`을 Zod로 검증하고 `offsetMs = 목표 − realNow()`를 정수로 환산해 `modoo42_dev_clock`에 담는다. 게이트가 닫히면 404, 콘솔 세션이 없으면 **403 `FORBIDDEN`**이다. 응답은 `{ offsetMs, effectiveAt }` (`contracts/dev-console-api.md` C4)
- [X] T023 [US1] 같은 파일에 `DELETE`를 만든다 — `modoo42_dev_clock`을 삭제하고 `{ offsetMs: 0 }`을 반환한다 (C5)
- [X] T024 [P] [US1] `src/components/dev/ClockProvider.tsx`를 만든다 — `offsetMs`를 prop으로 받는 클라이언트 Context와 `useDevClock()`이 `new Date(Date.now() + offsetMs)`를 돌려준다 (`research.md` R10)
- [X] T025 [US1] `src/app/layout.tsx`에서 `MockAuthModal` 마운트를 `ClockProvider` + `DevConsole`로 교체한다. **게이트가 닫힌 환경에서는 쿠키를 읽지 않고 `offsetMs = 0`을 넘긴다** — 루트 레이아웃이 상용에서 정적으로 남아야 한다
- [X] T026 [US1] `DevConsole`의 시계 섹션을 구현한다 — 현재 유효 시각(KST) 1초 갱신, 절대 시각 입력 + `[이동]`, `[실제 시각으로 복귀]`. **오프셋 숫자는 노출하지 않는다.** 패널 하단에 "시계는 되돌아가지만 데이터는 되돌아가지 않습니다" 한 줄을 둔다 (`FR-020`, `prd.md` F7)
- [X] T027 [P] [US1] `src/components/feed/LivePingBoard.tsx:24`의 1초 인터벌이 `useDevClock()`을 쓰도록 고친다. 자체 `new Date()`를 남기지 않는다
- [X] T028 [P] [US1] `src/components/detail/LeaderActions.tsx:19`가 `useDevClock()`에서 `now`를 받도록 고친다

**Checkpoint**: 시각 이동이 서버·클라이언트에서 일치한다. 판정창·LIVE 만료·파티 만료를 손으로 재현할 수 있다.

---

## Phase 4: User Story 2 - 운영 도메인에는 콘솔이 존재하지 않는다 (Priority: P1)

**Goal**: 게이트가 닫힌 환경에서 콘솔 라우트·페르소나 라우트가 404이고, 쿠키를 위조해도 시각이 변하지 않는다. 세션 만료만 실제 시각을 본다.

**Independent Test**: `DEV_CONSOLE_PASSWORD`를 비우고 `curl`로 `/api/dev/*`·`/api/mock-auth`가 404임을 확인한다. 위조 오프셋 쿠키로 유효 시각이 변하지 않음을 확인한다.

### Tests

- [X] T029 [P] [US2] `tests/dev-clock.test.ts`에 `TC-DEV-10`을 추가한다 — 콘솔 세션 쿠키 없이 `modoo42_dev_clock`만 보낸 요청에서 유효 시각이 실제 시각과 같고, `POST /api/dev/clock`이 403이다
- [X] T030 [P] [US2] `tests/session.test.ts`에 `TC-DEV-04`를 추가한다 — dev 시계를 +31일 이상 옮긴 상태에서 `verifySessionToken(token, realNow())`이 유효 판정을 유지한다

### Implementation

- [X] T031 [US2] `src/app/api/mock-auth/route.ts`의 게이트를 `isMockAuthEnabled()`에서 콘솔 게이트(`isDevConsoleEnabled()` + `hasValidConsoleSession()`)로 교체한다. 404 본문 형식(`{ error: 'NOT_FOUND' }`)은 유지한다
- [X] T032 [US2] `src/lib/auth.ts:18`의 `isMockAuthEnabled()`와 `115`행의 사용처를 콘솔 게이트로 정리한다. **`NODE_ENV` 전용 게이트를 콘솔 경로에 남기지 않는다** (2026-10-19 사용자 결정)
- [X] T033 [US2] `/api/dev/console`·`/api/dev/clock`의 모든 메서드가 게이트 판정을 **핸들러 첫 줄**에서 하는지 확인한다. 미들웨어로 중복 차단을 만들지 않는다 (`research.md` R3)
- [X] T034 [US2] `ConsoleEntry`·`DevConsole`가 게이트가 닫힐 때 서버에서 `null`을 반환하는지 확인하고, 클라이언트 번들에 비밀번호·오프셋 판정 로직이 들어가지 않는지 점검한다
- [ ] T035 **(사람 검증 — 브라우저 필요)** [US2] `quickstart.md` §1을 실행한다 — 키를 비운 상태에서 404 4종과 위조 쿠키 무효를 손으로 확인한다

**Checkpoint**: 상용 노출 경로가 전부 닫혔다.

---

## Phase 5: User Story 3 - 운영자가 현재 세션 해석 소스를 보고 페르소나를 바꾼다 (Priority: P1)

**Goal**: 패널 인증 섹션이 `session`/`persona`/`비로그인`을 표시하고, 페르소나 전환과 세션 쿠키 삭제를 한자리에서 한다. `MockAuthModal`은 사라진다.

**Independent Test**: OAuth로 로그인한 상태에서 해석 소스가 `session`으로 보이고, 세션 쿠키 삭제 후 페르소나 버튼이 다시 먹는다.

### Tests

- [X] T036 [P] [US3] 세션 해석 소스 파생 함수의 단위 테스트를 추가한다 — 쿠키 조합 3가지가 `session`/`persona`/`비로그인`으로 갈린다 (`data-model.md` §5)

### Implementation

- [X] T037 [US3] 해석 소스 파생 함수를 구현한다. `getCurrentUser()`의 우선순위(`modoo42_session` → `modoo42_mock_user`)를 **바꾸지 않고** 표시만 추가한다
- [X] T038 [US3] `DevConsole`의 인증 섹션을 구현한다 — 페르소나 버튼 4종(`gs_leader`·`gs_member`·`seoul_member`·`github_only`) + 로그아웃, 해석 소스 표시. 페르소나 정의는 `src/lib/personas.ts` 한 곳에서 읽는다 (`FR-016`)
- [X] T039 [US3] 세션 쿠키 삭제 버튼을 같은 섹션에 둔다. 기존 `/api/auth/logout`을 재사용하고 새 엔드포인트를 만들지 않는다
- [X] T040 [US3] `src/components/MockAuthModal.tsx`를 삭제하고 남은 참조를 제거한다 — `src/app/layout.tsx:3`의 import와 `src/lib/personas.ts:2`의 주석이다. 저장소에 `MockAuthModal`이 0건이어야 한다 (`SC-010`)
- [ ] T041 **(사람 검증 — 브라우저 필요)** [US3] `quickstart.md` §5를 실행한다

**Checkpoint**: 플로팅 패널이 1개이고 페르소나 전환이 콘솔 안에서만 가능하다.

---

## Phase 6: User Story 4 - 콘솔 세션의 쓰기가 운영 테이블에 닿지 않는다 (Priority: P2)

**Goal**: 콘솔 세션 쿠키가 있는 브라우저의 모든 읽기·쓰기가 `dev_sandbox`를 본다. 진입이 비우고 스냅샷하며 실제 초대 링크를 복사하지 않는다.

**Independent Test**: 콘솔 세션에서 글 생성·참여·판정을 수행한 뒤 쿠키를 지우고 운영 피드의 행 수가 그대로인지 확인한다.

### Tests (Red 먼저 — T042가 파괴적 코드(T052)보다 **앞서야 한다**)

- [X] T042 [P] [US4] `tests/dev-sandbox.test.ts`에 `TC-DEV-06`을 작성한다 — 대상 스키마가 `dev_sandbox`가 아니면 **SQL을 한 줄도 실행하지 않고** 던진다. 실행 호출 수 0을 단정한다
- [X] T043 [P] [US4] 같은 파일에 `TC-DEV-05`를 작성한다 — 스냅샷 후 운영 `chat_url` 값이 0건이고 전부 `dev-sandbox` 더미 또는 `NULL`이며, 파생 `chat_platform`이 원본과 같고 `reference_url`이 복사된다
- [X] T044 [P] [US4] 같은 파일에 `TC-DEV-09`를 작성한다 — 샌드박스 핸들로 생성·참여·판정 후 `public` 3테이블 행 수가 불변이다
- [X] T045 [P] [US4] 같은 파일에 `TC-DEV-11`을 작성한다 — 같은 조회 함수를 두 핸들로 호출해 서로 다른 행 집합을 반환한다

### 재생 스크립트 (`contracts/sandbox-isolation.md` S1)

- [X] T046 [US4] `scripts/sandbox-sync.mjs`를 만든다 — `dotenv`로 `.env.local`을 읽고, `DROP SCHEMA IF EXISTS dev_sandbox CASCADE` → `CREATE SCHEMA dev_sandbox` → `drizzle/0000`~`0003`을 번호 순서로 `SET LOCAL search_path = dev_sandbox` 아래에서 실행한다. `--> statement-breakpoint`로 문장을 나눈다. 실행 전에 대상 스키마 이름을 출력한다
- [X] T047 [US4] 같은 스크립트에 표식 테이블 2개를 만든다 — `dev_sandbox.sandbox_session(id integer PK=1, started_at timestamptz NOT NULL, expires_at timestamptz NOT NULL)`과 `dev_sandbox.sandbox_meta(id integer PK=1, journal_tag text NOT NULL, synced_at timestamptz NOT NULL)` (`data-model.md` §3)
- [X] T048 [US4] 같은 스크립트에 컬럼 권한을 적용한다 — `REVOKE SELECT ON TABLE dev_sandbox.posts FROM anon, authenticated` 후 `GRANT SELECT (id, type, max_members, current_members, expires_at, status, created_at, updated_at)`. 목록은 `drizzle/0003_revoke_anon_chat_url.sql`과 **같은 8개**다 (S5)
- [X] T049 [US4] 같은 스크립트에서 `pg_publication_tables`로 존재를 확인한 뒤 `ALTER PUBLICATION supabase_realtime ADD TABLE dev_sandbox.posts`를 실행한다 — 중복 등록은 에러이므로 건너뛴다
- [X] T050 [US4] 같은 스크립트에서 `drizzle/meta/_journal.json`의 마지막 `tag`를 `sandbox_meta.journal_tag`에 기록한다

### 핸들과 스냅샷

- [X] T051 [US4] `src/lib/dev/sandbox.ts`에 샌드박스 drizzle 인스턴스를 추가한다 — `postgres(connectionString, { connection: { search_path: 'dev_sandbox' } })`를 **모듈 수준에서 1개만** 만들고(연결 풀 중복 방지), `requestDatabase()`가 유효한 콘솔 세션에서 그 핸들을 반환하도록 분기한다 (S7)
- [X] T052 [US4] `src/lib/dev/snapshot.ts`에 S6 단정과 S3 비우기를 구현한다 — 스키마 이름을 인자로 받아 `DEV_SANDBOX_SCHEMA`와 대조하고, 문장에 `public.`이 없는지 검사한 뒤 `TRUNCATE dev_sandbox.participants, dev_sandbox.posts, dev_sandbox.users`를 **한 문장으로** 실행한다. T042이 Green이 된다
- [X] T053 [US4] 같은 파일에 S4 스냅샷을 구현한다 — `users` → `posts` → `participants` 순서, **컬럼 전부 명시 열거**(`SELECT *` 금지), `id`·`created_at`·`joined_at` 보존 복사. `chat_url`은 `CASE WHEN chat_url IS NULL THEN NULL WHEN chat_url LIKE 'https://open.kakao.com/%' THEN 'https://open.kakao.com/o/dev-sandbox' ELSE 'https://discord.gg/dev-sandbox' END`로 치환한다. 비우기와 같은 트랜잭션에서 돈다. T043가 Green이 된다
- [X] T054 [US4] `/api/dev/console`의 `POST`에 S2 순서를 끼운다 — 게이트 → 비밀번호 → **`sandbox_meta.journal_tag` 대조(불일치·스키마 없음 → 409 `SANDBOX_STALE` + `pnpm sandbox:sync` 안내)** → 비우기 + 스냅샷 → 표식 기록 → 쿠키 발급. 응답은 `{ joined, snapshotRows }` (C2)
- [X] T055 [US4] `src/lib/auth.ts`의 유저 조회(`100`행 부근의 `defaultDb` 직접 사용)가 `requestDatabase()`를 쓰도록 고친다. 쓰지 않으면 콘솔 세션에서 `leader_id` 외래키가 샌드박스 안에서 풀리지 않는다
- [X] T056 [US4] `src/hooks/useRealtimePosts.ts`가 `schema` 인자를 받아 `postgres_changes` 구독(`UPDATE`·`INSERT` 둘 다)에 넘기고, 채널 이름에 스키마를 붙이도록 고친다(`posts-channel:dev_sandbox`). 동시 채널 수는 1개를 유지한다 (`research.md` R11)
- [X] T057 [US4] 피드를 조립하는 RSC가 `realtimeSchema`를 prop으로 내려보내도록 고친다 — 콘솔 세션이면 `'dev_sandbox'`, 아니면 `'public'`
- [ ] T058 **(사람 검증 — 브라우저 필요)** [US4] `quickstart.md` §2를 실행한다 — 스냅샷 직후 플랫폼 배지와 참여 확인 카피가 운영과 같은지, 쿠키 삭제 후 운영 피드에 콘솔 글이 없는지 확인한다

**Checkpoint**: 콘솔 세션의 쓰기가 운영 테이블에 0건이다.

---

## Phase 7: User Story 5 - 운영자가 경계 시각에 한 번에 도달한다 (Priority: P2)

**Goal**: 프리셋 8종과 "이 글 기준으로 이동"으로 KST 경계를 손계산 없이 맞춘다.

**Independent Test**: 프리셋 8종을 눌러 각각 기대한 경계 안/밖에 도달하고, 파티 글 기준 점프로 그 글만 만료된다.

### Tests

- [X] T059 [P] [US5] `tests/dev-clock.test.ts`에 `TC-DEV-01`을 추가한다 — 프리셋 8종이 KST 경계 기준 기대 시각을 반환한다. 모집창 시작은 당월 15일 00:05 KST, Grace 만료는 `end_date` 월 기준 익월 11일 00:01 KST다. 순수 함수이므로 DB 없이 돈다

### Implementation

- [X] T060 [US5] `src/lib/dev/presets.ts`에 `presetTime(preset, ctx)`를 구현한다 — `ctx = { now: Date; post?: { endDate: Date | null; expiresAt: Date | null } }`, 쿠키·DB 접근 없음. 키 8종과 산출식은 `data-model.md` §4가 SSOT다. 날짜 계산은 `src/lib/end-date.ts`의 `kstDayRange()`·`toKstWall()`·`computeVerdictWindow()`를 재사용하고 **새 날짜 유틸을 만들지 않는다**
- [X] T061 [US5] `POST /api/dev/clock`에 `{ preset, postId }` 분기를 추가한다 — `at`과 배타(`superRefine`), `ctx.post`가 필수인 3종(`party_ended`·`live_before_expiry`·`live_after_expiry`)에 `postId`가 없으면 400 `BAD_REQUEST`. 글은 **현재 요청의 핸들**에서 읽고 없으면 404 (C4)
- [X] T062 [US5] `DevConsole`의 시나리오 섹션을 구현한다 — 버튼 8종, `ctx.post`가 필수인 3종은 비활성
- [X] T063 [US5] 상세 모달에 개발 전용 "이 글 기준으로 이동" 입구를 둔다. 게이트가 닫히면 렌더하지 않는다 (`FR-021`)
- [ ] T064 **(사람 검증 — 브라우저 필요)** [US5] `quickstart.md` §3·§4를 실행한다 — 판정창·Grace·LIVE 만료 전후·다음 KST 자정(1일 1회 리셋)

**Checkpoint**: 경계 재현이 클릭 1회로 끝난다.

---

## Phase 8: User Story 6 - 2창 실시간 검증이 서로를 지우지 않는다 (Priority: P3)

**Goal**: 살아 있는 표식이 있으면 두 번째 진입이 합류하고, TTL이 지나면 초기화한다.

**Independent Test**: 한 창에서 글을 만들고 시크릿 창으로 진입했을 때 그 글이 남아 있다. 표식을 만료시킨 뒤 진입하면 초기화된다.

### Tests

- [X] T065 [P] [US6] `tests/dev-sandbox.test.ts`에 `TC-DEV-07`을 추가한다 — 표식이 유효하면 초기화를 건너뛰어 행 수가 유지되고, TTL이 지나면 초기화가 수행된다

### Implementation

- [X] T066 [US6] `/api/dev/console`의 진입 판정에 합류 분기를 넣는다 — `sandbox_session.expires_at > realNow()`이면 비우기·스냅샷을 **건너뛰고** `{ joined: true }`를 반환한다. 비교에 `realNow()`를 쓴다 — 미래로 점프한 순간 자기 샌드박스를 지우지 않기 위함이다 (`research.md` R9)
- [X] T067 [US6] TTL 상수를 2시간으로 두고 초기화 시 `started_at = realNow()`, `expires_at = realNow() + 2시간`으로 표식을 갱신한다. 상수는 한 곳에만 둔다
- [ ] T068 **(사람 검증 — 브라우저 필요)** [US6] `quickstart.md` §6을 실행한다 — 2창 합류와 1초 이내 인원 수 갱신, 표식 만료 후 초기화
- [ ] T069 **(사람 검증 — 브라우저 필요)** [US6] `quickstart.md` §7을 실행한다 — 시계를 +40일로 옮겨도 콘솔·로그인 세션이 유지된다

**Checkpoint**: `NFR-004` 2창 검증 절차가 콘솔 안에서 성립한다.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T070 [P] 핵심 도메인 커버리지 90% 이상을 확인한다 (`NFR-006`) — 시각 주입·게이트 판정·스냅샷 마스킹·스키마 단정이 포함돼야 한다
- [X] T071 [P] 구현이 SSOT와 어긋나지 않는지 대조한다 — `requirement.md` `FR-027`·`FR-028`·Test Suite 10, `trd.md` §2.4, `prd.md` F7, `CLAUDE.md` §4·§6.1·§7.2, `next-steps.md` §4.0. 어긋나면 **문서를 먼저 고친다**
- [X] T072 [P] `.env.example`의 `DEV_CONSOLE_PASSWORD` 설명이 실제 게이트 동작과 일치하는지 확인한다 (페르소나 전환까지 이 키에 종속된다는 점)
- [X] T073 [P] `DevConsole` 신규 UI에 `.claude/rules/anti-ai-slop.md` 출력 전 자가 점검 6항목을 적용한다 — 그라데이션·컬러 그림자·hover `transform`·배경 장식 0건
- [X] T074 필수 게이트 5종을 통과시킨다 — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm drizzle-kit check`. **`public` 대상 새 마이그레이션이 0건**이어야 한다 (`SC-011`)
- [ ] T075 **(사람 검증 — 브라우저 필요)** `quickstart.md` 8단계를 처음부터 끝까지 한 번 더 실행한다 (게이트 → 스냅샷 → 시각 → LIVE → 세션 → 2창 → 미래 점프 → 되돌리기 한계)
- [X] T076 PR 본문을 `.github/pull_request_template.md` 구조(📌 Summary, 🛠️ Key Changes, 🧪 Verification, 🔗 Related Specs)로 작성한다. 결정 2건(게이트 단일화, 브라우저 단위 샌드박스)과 plan 단계의 번복 2건(`database` 기본값 제거, 더미 링크 마스킹)을 Key Changes에 적는다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 의존 없음
- **Phase 2 Foundational**: Setup 완료 후. **US1~US6 전부를 막는다**
- **Phase 3~8 User Stories**: Foundational 완료 후 — 우선순위대로(P1 → P2 → P3) 또는 병렬
- **Phase 9 Polish**: 구현하려는 스토리 전부 완료 후

### User Story Dependencies

- **US1 (P1)**: Foundational만 의존. 샌드박스 없이 독립 검증됨 — `requestDatabase()`가 `public`을 반환하는 상태로도 시각 이동이 성립한다
- **US2 (P1)**: Foundational만 의존. US1과 무관하게 게이트만 검증
- **US3 (P1)**: Foundational만 의존. T040(`MockAuthModal` 삭제)이 T025(layout 교체)보다 뒤여야 한다 — 두 작업이 같은 파일을 만진다
- **US4 (P2)**: Foundational만 의존. 단 T056·T057(실시간 스키마)은 US1의 클라이언트 변경과 같은 컴포넌트 트리를 만지므로 US1 뒤가 편하다
- **US5 (P2)**: Foundational + **T022(clock POST)**에 의존 — 프리셋이 같은 라우트에 분기를 추가한다
- **US6 (P3)**: Foundational + **T047(표식 테이블)**과 **T054(진입 순서)**에 의존 — US4를 먼저 끝낸다

### Within Each Story

- 테스트를 먼저 쓰고 **실패를 확인한 뒤** 구현한다 (Constitution 원칙 I)
- 모듈 → 라우트 → UI 순서
- `TC-DEV-06`(T042)은 파괴적 SQL 구현(T052)보다 반드시 앞선다

### Parallel Opportunities

- T002·T003 (Setup)
- T004·T005 (Foundational 테스트 2종)
- T012는 T011과 다른 파일이므로 병렬
- T021 / T029·T030 / T036 / T042~T045 / T059 / T065 — 각 스토리의 테스트는 서로 병렬
- T024·T027·T028 (US1의 클라이언트 3파일)
- T070~T073 (Polish 점검 4종)
- Foundational 이후 US1·US2·US3은 서로 다른 파일이 많아 사람이 둘 이상이면 병렬 가능하다 (단 T025·T040의 `layout.tsx` 충돌만 조율)

---

## Parallel Example: Foundational 테스트

```bash
# 둘을 함께 띄우고 Red을 확인한다
Task: "tests/dev-clock.test.ts — TC-DEV-02 / TC-DEV-03"
Task: "tests/dev-timestamps.test.ts — TC-DEV-08 / TC-DEV-12"
```

## Parallel Example: US4 테스트

```bash
Task: "TC-DEV-06 대상 스키마 단정 (실행 호출 0)"
Task: "TC-DEV-05 스냅샷 마스킹"
Task: "TC-DEV-09 운영 테이블 불변"
Task: "TC-DEV-11 샌드박스 범위"
```

---

## Implementation Strategy

### MVP (US1까지)

1. Phase 1 Setup
2. Phase 2 Foundational — 여기가 가장 무겁다 (호출부 약 217곳)
3. Phase 3 US1
4. **중단하고 검증**: 판정창·Grace·LIVE 만료를 손으로 재현한다
5. 이 시점에서 이미 `FR-008`·`FR-011`·`FR-018`·`FR-020` 검증이 가능하다 — 샌드박스 없이도 목적의 절반이 선다

### Incremental Delivery

1. Setup + Foundational → 시각 단일 소스 확보
2. US1 → 시각 이동 (MVP)
3. US2 → 상용 차단 확정. **US1과 같은 PR에 넣는다** — 게이트 없이 머지하면 상용에 시각 우회가 열린다
4. US3 → 인증 섹션 흡수, `MockAuthModal` 제거
5. US4 → 샌드박스 격리 (운영 피드 오염 중단)
6. US5 → 프리셋으로 반복 비용 절감
7. US6 → 2창 검증 보존

### 주의

- **US1과 US2는 분리 배포하지 않는다.** 시계가 열렸는데 게이트가 없으면 `FR-011`(LIVE 1일 1회)과 `FR-008`(판정창)이 상용에서 무력화된다.
- **T052·T053는 복구 수단이 없는 유일한 동작이다.** 단정(T042) Green 없이 실행하지 않는다.
- `pnpm sandbox:sync`는 `dev_sandbox`를 DROP한다. `public`을 지우지 않음을 출력으로 확인한 뒤 돌린다.

---

## Notes

- `[P]` = 다른 파일, 미완 작업 의존 없음
- `[Story]` 라벨로 추적한다. Setup·Foundational·Polish에는 라벨이 없다
- 커밋은 작업 단위 또는 논리 묶음마다 한다. Conventional Commits, 제목은 한국어
- 각 Checkpoint에서 멈춰 스토리를 독립 검증할 수 있다
