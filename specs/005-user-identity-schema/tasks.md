---

description: "유저 식별 스키마 전환 (005) 작업 체크리스트"
---

# Tasks: 유저 식별 스키마 전환 (Phase 3 선행)

**Input**: Design documents from `/specs/005-user-identity-schema/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: 포함한다. 헌법 I이 핵심 도메인 로직에 TDD(Red → Green → Refactor)를 강제하고, 테스트 제목에 `docs/requirement.md` §3의 인수 테스트 ID를 그대로 쓴다.

**Organization**: 스토리별로 묶는다. 단 이 기능은 스키마 전환이라 **US1~US4가 서로 독립적이지 않다** — Phase 2(스키마·마이그레이션)가 모든 스토리의 선행 조건이다. 솔직하게 Phase 2에 모아 두고, 스토리 단계는 각자의 검증과 코드 경로를 갖는다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완료 작업에 의존하지 않음)
- **[Story]**: 소속 사용자 스토리 (US1~US4)
- 설명에 정확한 파일 경로를 쓴다

## Path Conventions

단일 프로젝트. 저장소 루트의 `src/`, `tests/`, `drizzle/`, `docs/`를 쓴다 (CLAUDE.md §3).

---

## Phase 1: Setup (문서 SSOT 선행)

**Purpose**: 기준값 확보와 문서 선행 수정. 헌법 II에 따라 코드가 문서를 앞지르지 않는다. 테스트 제목이 `TC-IDENT-*`를 쓰므로 그 ID가 `requirement.md`에 먼저 있어야 한다.

- [X] T001 전환 전 기준값을 기록한다 — `users`·`posts`·`participants` 건수를 세어 `/tmp/claude-1000/-home-erdos-workspace-modoo42/586e3c84-e665-4414-821b-f75495a6c5f0/scratchpad/005-baseline.txt`에 남긴다 (현재 실측: users 3 / posts 3 / participants 6). T012의 데이터 보존 검증 기준이다
- [X] T002 [P] `docs/requirement.md` §3에 인수 테스트 ID `TC-IDENT-01`~`TC-IDENT-05`를 신설하고, Phase 0 표의 `FR-000` 설명을 "3종 페르소나"에서 "4종 페르소나(`gs_leader`, `gs_member`, `seoul_member`, `github_only`) 및 로그아웃(`guest`)"으로 갱신한다
- [X] T003 [P] `docs/trd.md` §2.1의 "Mock 페르소나 정의 (3종)" 목록을 4종으로 갱신한다 — `github_only`는 `campus: null`, 각 페르소나의 식별자는 `github_id`·`login`임을 명시한다 (`trd.md` §3.2는 이미 목표 스키마이므로 수정하지 않는다)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 스키마 전환과 마이그레이션. 모든 스토리가 이것 없이는 돌지 않는다.

**⚠️ CRITICAL**: T009 완료 전에는 어떤 스토리 작업도 시작하지 않는다. T010은 마이그레이션 직후 즉시 깨지는 테스트를 복구하는 작업이라 같은 Phase에 둔다.

- [X] T004 `tests/identity-schema.test.ts`를 신설해 `TC-IDENT-01`(식별자 제약)과 `TC-IDENT-03`(백필 후 데이터 보존)을 작성하고 **실패(Red)를 확인한다** — `github_id`·`login`이 `NOT NULL`·`UNIQUE`인지, `intra_id`·`campus`·`intra_verified_at`이 `null`을 허용하는지, `github_id`·`login`의 `null` 행이 0건인지 검사한다
- [X] T005 `src/db/schema.ts`의 `users`를 전환한다 — `githubId: text('github_id').unique().notNull()`, `login: text('login').unique().notNull()` 신설, `intraId: text('intra_id').unique()`(`.notNull()` 제거), `campus: campusEnum('campus')`(`.notNull()` 제거), `intraVerifiedAt: timestamp('intra_verified_at', { withTimezone: true })` 신설. 선언 순서와 주석은 `docs/trd.md` §3.2를 그대로 따른다
- [X] T006 `src/db/schema.ts`의 `locationTypeEnum`을 `['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'OFFLINE_ETC', 'HYBRID']`로 바꾸고, `OFFLINE_ETC`가 캠퍼스 미인증 유저의 LIVE 핑용이며 열거형 값 추가는 롤백할 수 없다는 주석을 단다 (`trd.md` §3.2 주석과 동일 문구)
- [X] T007 `pnpm drizzle-kit generate`로 `drizzle/0002_*.sql`과 `drizzle/meta/0002_snapshot.json`을 생성한다. 아직 적용하지 않는다
- [X] T008 `drizzle/0002_*.sql`의 SQL 본문을 [data-model.md §4](./data-model.md)의 5단 순서로 손 편집한다 — ① `ALTER TYPE "public"."location_type" ADD VALUE 'OFFLINE_ETC'`(이 파일에서 그 값을 **쓰지 않는다**) ② 3개 컬럼을 제약 없이 `ADD COLUMN` ③ `UPDATE "users" SET "github_id" = 'mock:' || "intra_id", "login" = "intra_id" WHERE "github_id" IS NULL` ④ `SET NOT NULL` + 유일 제약 ⑤ `intra_id`·`campus`의 `DROP NOT NULL`. `drizzle/meta/*` 스냅샷은 생성물을 그대로 둔다
- [X] T009 `pnpm drizzle-kit migrate`로 적용한 뒤 `pnpm drizzle-kit check`를 통과시키고, T004가 **통과(Green)**하는지 확인한다. 실패 시 SQL 편집 순서를 먼저 의심한다 (`column "github_id" of relation "users" contains null values`는 ③ 누락 신호다)
- [X] T010 마이그레이션으로 깨진 기존 테스트의 직접 `users` insert를 복구한다 — `tests/posts-join.test.ts:107`, `tests/posts-complete.test.ts:127,184,285`, `tests/posts-live.test.ts:451`, `tests/leaderboard.test.ts:22,40`의 `.values({ intraId, campus })`에 `githubId`·`login`을 채운다(유일해야 하므로 기존 유일 접미사를 재사용한다). 기대값 전환은 US3(T020~T024)에서 하고 여기서는 insert만 고친다

**Checkpoint**: 스키마·마이그레이션 적용 완료. `pnpm test`가 US3 기대값 외에는 통과한다. 스토리 작업 시작 가능

---

## Phase 3: User Story 1 - GitHub 핸들만으로 식별되는 유저 (Priority: P1) 🎯 MVP

**Goal**: 42 정보가 전혀 없는 유저가 GitHub 식별자 2개만으로 서비스를 끝까지 쓸 수 있다. 기존 데이터는 전환 후에도 연결이 끊기지 않는다.

**Independent Test**: `intra_id`·`campus`·`intra_verified_at`이 모두 `null`인 유저를 만들어 글 작성·참여가 되는지 확인한다. 전환 전 건수와 전환 후 건수를 대조한다.

### Tests for User Story 1 ⚠️

- [X] T011 [US1] `tests/identity-schema.test.ts`에 `TC-IDENT-01` 케이스를 보강한다 — 같은 `github_id`로 두 번째 insert 시 유일 제약 위반, 같은 `login`으로 두 번째 insert 시 유일 제약 위반, 42 컬럼 3개가 `null`인 유저로 정규 스터디 생성·참여가 성공함을 검증한다

### Implementation for User Story 1

- [X] T012 [US1] `tests/identity-schema.test.ts`의 `TC-IDENT-03`을 T001 기준값과 대조해 확정한다 — `users` 3 / `posts` 3 / `participants` 6 유지, `github_id`·`login`의 `null` 0건, 백필 값이 `github_id = 'mock:' || intra_id`·`login = intra_id` 규칙과 일치, 기존 글의 `leader_id`가 유효한 유저를 가리킴을 검증한다

**Checkpoint**: 식별 체계가 GitHub 2키로 서고 기존 데이터가 보존됐다. US1 독립 검증 가능

---

## Phase 4: User Story 2 - 캠퍼스 없는 유저의 LIVE 핑 (Priority: P1)

**Goal**: 캠퍼스가 비어 있는 유저의 LIVE 핑이 `OFFLINE_ETC`로 기록되고, 등록이 거부되지 않는다. 캠퍼스를 가진 유저의 파생은 그대로다.

**Independent Test**: 캠퍼스가 `null`인 유저로 LIVE 핑 1건 등록 → 201, `location_type = 'OFFLINE_ETC'`. `GS`/`SEOUL` 유저의 핑은 기존 값 유지.

### Tests for User Story 2 ⚠️

- [X] T013 [P] [US2] `tests/lib/public-user.test.ts`를 신설해 `campusToLocationType`의 3분기를 작성하고 Red를 확인한다 — `'GS'` → `'OFFLINE_GS'`, `'SEOUL'` → `'OFFLINE_SEOUL'`, `null` → `'OFFLINE_ETC'`
- [X] T014 [P] [US2] `tests/posts-live.test.ts`에 `TC-IDENT-02`를 추가하고 Red를 확인한다 — `campus: null` 작성자의 핑 생성이 성공하고 `locationType`이 `'OFFLINE_ETC'`, 기존 `OFFLINE_GS`/`OFFLINE_SEOUL` 파생 단정(`:74`, `:75`)은 변하지 않음을 검증한다
- [X] T015 [P] [US2] `tests/lib/validation.test.ts`에 개설 입력 열거형 고정 케이스를 추가한다 — `locationType: 'OFFLINE_ETC'`를 보낸 `createPostSchema` 파싱이 실패해야 한다 (FR-005a, research R7). DB 열거형 5값과 입력 4값의 분리를 테스트로 못박는다

### Implementation for User Story 2

- [X] T016 [US2] `src/lib/public-user.ts`에 `campusToLocationType(campus: Campus): 'OFFLINE_GS' | 'OFFLINE_SEOUL' | 'OFFLINE_ETC'`를 구현한다. 파생 규칙은 [data-model.md §3](./data-model.md) 표를 그대로 따르고, LIVE 핑 전용이라는 주석을 단다
- [X] T017 [US2] `src/lib/posts.ts:148`의 `locationType: author.campus === 'GS' ? 'OFFLINE_GS' : 'OFFLINE_SEOUL'`를 `campusToLocationType(author.campus)` 호출로 교체한다. 작성자 조회(`.for('update')`)와 트랜잭션 구조는 건드리지 않는다
- [X] T018 [US2] `src/lib/validation.ts:32`의 `locationTypeSchema`가 `['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']` 4종임을 확인하고, `OFFLINE_ETC`가 서버 파생 전용이라 입력에서 제외된다는 주석을 추가한다 (코드 값 자체는 변경 없음)

**Checkpoint**: 캠퍼스 없는 유저가 LIVE 핑을 올릴 수 있다. T013~T015 Green

---

## Phase 5: User Story 3 - 조회 응답의 작성자 표기 전환 (Priority: P2)

**Goal**: 5개 조회 응답의 유저 투영이 `{ login, campus }`로 통일되고, 랭킹 타이브레이커가 `login`이 된다. `intraId`는 응답에서 사라진다.

**Independent Test**: 캠퍼스 있는 유저와 없는 유저가 섞인 데이터로 5개 응답을 받아 `login` 표기와 `campus: null` 허용을 확인한다. 어떤 응답에도 `intraId`가 없다.

**Depends on**: Phase 2 완료. T019~T023(테스트 Red)은 서로 다른 파일이라 병렬 가능하다.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] `tests/posts-list.test.ts`의 `leader` 기대값을 `{ login, campus }`로 전환하고, `campus: null` 작성자 글이 목록에 정상 노출되는 `TC-IDENT-04` 케이스를 추가한다
- [X] T020 [P] [US3] `tests/posts-detail.test.ts`의 `leader`·`participants[]` 기대값을 `{ login, campus }`로 전환한다. 비참여자 `chatUrl` 제외 단정은 그대로 유지한다
- [X] T021 [P] [US3] `tests/hall-of-fame.test.ts:75,76,99`의 `leader`·`completedMembers` 기대값을 `{ login, campus }`로 전환하고, 완주 멤버 정렬이 `login` 오름차순임을 검증한다
- [X] T022 [P] [US3] `tests/leaderboard.test.ts`를 `login` 기준으로 전환한다 — insert 데이터와 기대 배열의 `intraId`를 `login`으로 바꾸고, 완주·리더 동률 시 `login` 오름차순으로 순위가 갈리는지 검증한다 (FR-009). `describe`/`it` 제목의 기존 ID 표기(`intra_id ASC`)도 `login ASC`로 고친다
- [X] T023 [P] [US3] `tests/api/cli-list.test.ts:24,39,86`과 `tests/lib/cli-format.test.ts:16,112,133,174`의 `leader`를 `{ login, campus }`로 전환하고, `campus: null` 작성자 라벨이 `(github_only)`로 렌더되는 케이스를 추가한다 — `·` 구분자나 빈 괄호가 남지 않아야 한다 (FR-011)

### Implementation for User Story 3

- [X] T024 [US3] `src/lib/public-user.ts`에 `export type PublicUser = { login: string; campus: Campus }`와 `toPublicUser()`를 추가한다. `Campus`는 `(typeof users.$inferSelect)['campus']`에서 가져오고 `import type`으로만 참조한다
- [X] T025 [US3] `src/lib/posts.ts`의 투영과 쿼리를 전환한다 — `publicUser()`(`:47`)를 `toPublicUser()`로 교체, `:611`의 `type PublicUser = ReturnType<typeof publicUser>`를 `public-user.ts`의 명시적 타입으로 대체, `getPostDetail`(`:253,259`)·`listPosts`(`:327,350`)·`listHallOfFame`(`:657,670,681,685`)·`getLeaderboard`(`:712,719`)의 `users.intraId` 선택을 `users.login`으로 바꾼다
- [X] T026 [US3] `src/lib/posts.ts`의 정렬 키를 전환한다 — `getLeaderboard`의 `orderBy(desc(users.completedCount), desc(users.leaderCount), asc(users.login))`, `listHallOfFame` 완주 멤버의 `orderBy(asc(users.login))`. `:706` 주석의 "intra_id 순" 설명도 `login` 순으로 고친다
- [X] T027 [US3] `src/lib/cli-format.ts`를 전환한다 — `CliItem.leader`(`:14`) 타입을 `PublicUser`로 바꾸고(`import type`), `leaderLabel()`(`:72`)에서 `campus`가 `null`이면 `(login)`, 있으면 `(login·campus)`로 렌더한다. `stripControl`은 `login`에도 적용한다
- [X] T028 [US3] `src/app/api/list/route.ts:23`의 `project()`에서 `leader: { intraId: … }`를 `leader: { login: item.leader.login, campus: item.leader.campus }`로 바꾼다. 노출 필드 수는 늘리지 않는다

**Checkpoint**: 5개 응답이 `login` 기준으로 통일됐다. T019~T023 Green. `contracts/public-user.md`와 응답이 일치한다

---

## Phase 6: User Story 4 - Mock 페르소나 4종 (Priority: P3)

**Goal**: 개발자가 Mock Auth 모달 클릭 1번으로 캠퍼스 없는 세션으로 전환한다. 페르소나 정의가 한 곳에만 있다.

**Independent Test**: 모달에서 `GitHub 전용`을 고르면 세션 유저의 `campus`가 `null`이고, 그 상태로 올린 LIVE 핑이 `OFFLINE_ETC`로 저장된다.

### Tests for User Story 4 ⚠️

- [X] T029 [US4] `tests/lib/auth.test.ts`에 `TC-IDENT-05`를 작성하고 Red를 확인한다 — 페르소나 4종이 해석되고, `github_only`의 `campus`가 `null`·`login`이 `'github_only'`, 같은 페르소나를 2회 해석해도 `users` 행이 1건(멱등), `guest`·미지값은 `null` 반환. 기존 `intraId`·`campus` 기대값(`:12,13,20,29,57`)을 `login`·`campus` 기준으로 전환한다

### Implementation for User Story 4

- [X] T030 [US4] `src/lib/personas.ts`를 신설한다 — `Record<string, { label: string; githubId: string; login: string; campus: Campus }>` 형태로 [data-model.md §6](./data-model.md) 표의 4종을 그대로 정의한다(`gs_leader`/`gs_member`/`seoul_member`는 `campus` 보유, `github_only`는 `null`). `intra_id`·`intra_verified_at`은 정의에 넣지 않는다. `@/db`를 런타임 import하지 않는다(클라이언트 컴포넌트가 읽는다)
- [X] T031 [US4] `src/lib/auth.ts`를 전환한다 — `PERSONAS` 정의(`:15`)를 `personas.ts` 재export로 바꾸고, `resolvePersonaUser`의 Upsert를 `.values({ githubId, login, campus })` + `.onConflictDoNothing({ target: users.githubId })`로, 조회를 `eq(users.githubId, githubId)`로 바꾼다. `guest`·손상·미지값이 예외 없이 `null`을 반환하는 동작은 유지한다
- [X] T032 [US4] `src/components/MockAuthModal.tsx:7`의 하드코딩된 `PERSONA_BUTTONS`를 `personas.ts`의 정의에서 생성하고(`Object.entries`), 로그아웃(`guest`) 버튼을 뒤에 붙인다. `NODE_ENV !== 'development'` 렌더 차단은 그대로 둔다

**Checkpoint**: 페르소나 4종이 한 정의에서 나오고, `/api/mock-auth`의 키 검사(`persona in PERSONAS`)가 그대로 동작한다

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T033 [P] `docs/next-steps.md`를 갱신한다 — §3 Phase 3 진행 상태(`005-user-identity-schema` 완료, 다음은 `006-dashboard-realtime`), §1에 "백필로 남은 Mock 유저 3건·글 3건 수동 정리"를 U8 옆 항목으로 추가(마이그레이션으로 지우면 다른 환경의 실데이터를 지우므로 수동 작업이다), §2 "CI 첫 실행 확인" 절은 PR #6·#7 머지로 완료 처리
- [X] T034 [P] `research.md` R9의 `login` 유일 제약 위험을 `docs/next-steps.md` §4 Phase 4 항목에 "GitHub 핸들 선점 충돌 처리"로 1줄 추가한다 (FR-015 스펙 작성 시 결정)
- [X] T035 `pnpm lint` → `pnpm typecheck` → `pnpm test`를 순서대로 통과시킨다. `pnpm test`는 CI에 없으므로 PR 전 필수 게이트다 (NFR-006)
- [X] T036 [quickstart.md](./quickstart.md) §4 수동 확인을 실행한다 — `pnpm dev`로 모달 버튼 5개 확인, `github_only` 세션에서 LIVE 핑 등록 후 `curl -s localhost:3000/api/list`와 `curl -s 'localhost:3000/api/list?format=json'` 응답 대조
- [X] T037 `.github/pull_request_template.md` 구조(📌 Summary, 🛠️ Key Changes, 🧪 Verification, 🔗 Related Specs)로 PR 본문을 작성한다. 제목은 한국어 Conventional Commits, 관련 사양은 `FR-016`과 `specs/005-user-identity-schema/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 의존 없음. T002·T003은 병렬
- **Phase 2 (Foundational)**: Phase 1 이후. **모든 스토리를 막는다**. 내부 순서는 T004(Red) → T005·T006(스키마) → T007(생성) → T008(편집) → T009(적용·Green) → T010(테스트 insert 복구)로 고정이며 병렬 없음
- **Phase 3~6 (스토리)**: Phase 2 완료 후 시작. 스토리 간 병렬 가능하나 아래 파일 충돌을 피한다
- **Phase 7 (Polish)**: 모든 스토리 완료 후

### Story Dependencies

- **US1 (P1)**: Phase 2가 곧 US1의 본체다. Phase 2 완료 시 T011·T012만 남는다
- **US2 (P1)**: Phase 2 이후 독립. `src/lib/public-user.ts`를 **생성**한다(T016)
- **US3 (P2)**: Phase 2 이후 독립. `src/lib/public-user.ts`에 타입을 **추가**한다(T024) → T016과 같은 파일이므로 US2의 T016보다 뒤에 둔다
- **US4 (P3)**: Phase 2 이후 독립. `Campus` 타입을 쓰므로 T024 또는 T016 중 하나가 먼저 끝나야 한다

### 파일 충돌 주의

| 파일 | 손대는 작업 | 순서 |
| :--- | :--- | :--- |
| `src/db/schema.ts` | T005, T006 | 순차 (같은 파일) |
| `src/lib/public-user.ts` | T016(생성), T024(추가) | T016 → T024 |
| `src/lib/posts.ts` | T017(파생), T025(투영), T026(정렬) | 순차 |
| `tests/identity-schema.test.ts` | T004(생성), T011, T012 | 순차 |
| `tests/posts-live.test.ts` | T010(insert), T014(TC-IDENT-02) | T010 → T014 |
| `tests/leaderboard.test.ts` | T010(insert), T022(기대값) | T010 → T022 |

### Parallel Opportunities

- T002, T003 (문서 2개)
- T013, T014, T015 (US2 테스트 3개, 서로 다른 파일)
- T019, T020, T021, T022, T023 (US3 테스트 5개, 서로 다른 파일)
- T033, T034 (문서 2개)

---

## Parallel Example: User Story 3 테스트

```bash
# 서로 다른 파일이므로 동시에 Red로 만든다:
Task: "tests/posts-list.test.ts의 leader 기대값을 { login, campus }로 전환"
Task: "tests/posts-detail.test.ts의 leader·participants 기대값 전환"
Task: "tests/hall-of-fame.test.ts의 leader·completedMembers 기대값 전환"
Task: "tests/leaderboard.test.ts를 login 타이브레이커 기준으로 전환"
Task: "tests/api/cli-list.test.ts·tests/lib/cli-format.test.ts의 leader 전환 + campus null 라벨 케이스"
```

---

## Implementation Strategy

### MVP (US1까지)

1. Phase 1 완료 — 문서 ID 선행
2. Phase 2 완료 — 스키마·마이그레이션 (**여기가 되돌리기 어려운 지점이다.** 열거형 값 추가는 전진 전용)
3. Phase 3 완료 — US1 검증
4. **중단하고 확인**: `pnpm drizzle-kit check` 통과, 기존 데이터 건수 보존, 42 컬럼 `null` 유저로 글 작성 가능

이 시점에 머지해도 서비스는 동작한다. 단 응답은 아직 `intraId`를 쓰므로 CLI 출력과 계약 문서가 어긋난다 — US3까지가 실질 최소 단위다.

### 증분 전달

1. Phase 2 + US1 → 스키마 전환 완료
2. US2 → 캠퍼스 없는 유저가 LIVE 핑을 올릴 수 있다
3. US3 → 응답 계약이 `login`으로 통일된다 (**여기까지가 PR 최소 범위**)
4. US4 → 브라우저에서 캠퍼스 `null` 분기를 눌러볼 수 있다
5. Phase 7 → 문서 동기화와 전체 게이트

### 순서 경고

T008(마이그레이션 SQL 편집)을 건너뛰고 T009를 실행하면 `column "github_id" of relation "users" contains null values`로 실패한다. 실패 자체는 안전하다(트랜잭션 롤백). 다만 같은 마이그레이션에 `OFFLINE_ETC`를 **쓰는** 문장을 넣으면 `unsafe use of new value of enum type`이 나므로, 편집 시 백필 `UPDATE`가 `users`만 건드리는지 확인한다.

---

## Notes

- [P]는 다른 파일·의존 없음을 뜻한다
- 테스트는 구현 전에 작성해 실패를 확인한다 (헌법 I)
- 테스트 제목에 `TC-IDENT-01`~`TC-IDENT-05`를 그대로 쓴다
- 작업 또는 논리적 묶음 단위로 커밋한다. 제목은 한국어 Conventional Commits
- `main`에 직접 커밋하지 않는다. 브랜치는 `005-user-identity-schema`
- DB 스키마 변경은 `src/db/schema.ts`와 `docs/trd.md` §3.2를 같은 PR에서 함께 고친다 — §3.2는 이미 목표 상태이므로 이 PR에서는 코드만 맞춘다
