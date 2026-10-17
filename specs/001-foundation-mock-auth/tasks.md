---
description: "Task list — Phase 0 기반 인프라 & Mock 인증"
---

# Tasks: Phase 0 — 기반 인프라 & Mock 인증

**Input**: Design documents from `/specs/001-foundation-mock-auth/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mock-auth.md, quickstart.md

**Tests**: 포함한다. 프로젝트 헌법 원칙 I(NON-NEGOTIABLE)과 CLAUDE.md §9가 핵심 도메인
로직의 TDD(Red-Green-Refactor)를 강제한다. 로직 있는 부분(`getCurrentUser()`,
`/api/mock-auth`, dev-only 가드)은 테스트를 먼저 쓴다.

**Organization**: 작업은 사용자 스토리별로 묶는다. 패키지 매니저는 pnpm 전용 (`npm`/`npx`
금지).

## Path Conventions

Next.js App Router 단일 프로젝트. 소스 `src/`, 테스트 `tests/`, 마이그레이션 `drizzle/`
(plan.md 구조).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성·설정 초기화.

- [X] T001 `pnpm add zod` 및 `pnpm add -D vitest` 설치 후 `package.json` scripts에 `"test": "vitest"` 추가
- [X] T002 [P] `drizzle.config.ts` 생성 — schema `src/db/schema.ts`, out `drizzle/`, dialect `postgresql`, `DATABASE_URL` 사용
- [X] T003 [P] `vitest.config.ts` 생성 — `.env.local`의 `DATABASE_URL` 로드, Node 환경, `tests/setup/db.ts` setupFiles 등록
- [X] T004 [P] `.env.example`에 `DATABASE_URL` 키 문서화 확인/갱신 (키 추가 시 함께 갱신, CLAUDE.md §4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 사용자 스토리가 의존하는 공통 토대. 스키마·DB 클라이언트·테스트 하네스는
US1·US2·US3가 공유하므로 여기 둔다.

**⚠️ CRITICAL**: 이 Phase 완료 전에는 어떤 사용자 스토리도 시작할 수 없다.

- [X] T005 `src/db/schema.ts`에 Drizzle 스키마 정의 (원본 `docs/trd.md` §3.2, 같은 PR에서 일치 유지). enum: `campus_type`(`GS`,`SEOUL`), `post_type`(`STUDY`,`PARTY`,`LIVE`), `post_status`(`RECRUITING`,`CLOSED`,`COMPLETED`,`CANCELLED`), `location_type`(`ONLINE`,`OFFLINE_GS`,`OFFLINE_SEOUL`,`HYBRID`), `participant_status`(`JOINED`,`LEFT`,`REMOVED`,`COMPLETED`,`INCOMPLETE` — `LEFT`/`REMOVED`는 미사용 값, 로직 미구현). `avatar_url` 컬럼 없음.
- [X] T006 `src/db/schema.ts`에 `users` 테이블 — `id` uuid PK `defaultRandom()`, `intra_id` text unique not null, `campus` not null, `completed_count`/`leader_count` integer default 0 not null, `created_at`/`updated_at` timestamptz `defaultNow()` not null
- [X] T007 `src/db/schema.ts`에 `posts` 테이블 + 인덱스 (data-model.md 참조). `current_members` default 1 not null, `status` default `RECRUITING` not null, `leader_id` FK→users `onDelete: restrict`, `tags` text[] not null. 인덱스 `posts_feed_idx`(type,status,created_at)·`posts_live_ping_idx`(type,status,expires_at)
- [X] T008 `src/db/schema.ts`에 `participants` 테이블 + 인덱스. `post_id` FK→posts `onDelete: cascade`, `user_id` FK→users `onDelete: cascade`, `status` default `JOINED` not null. unique 인덱스 `participants_post_user_idx`(post_id,user_id), `participants_user_id_idx`(user_id). relations 3종 정의
- [X] T009 `src/db/index.ts` 생성 — `postgres(DATABASE_URL)` 클라이언트 + `drizzle(client, { schema })`, `db.transaction()` 노출 (Phase 1에서 `FOR UPDATE` 사용처)
- [X] T010 `pnpm drizzle-kit generate`로 `drizzle/` 마이그레이션 생성
- [X] T011 [P] `src/lib/errors.ts`에 `AppError` + HTTP 매핑 토대 (CLAUDE.md §8: `BAD_REQUEST` 400, `CLOSED` 400, `FULL` 400, `FORBIDDEN` 403, `NOT_FOUND` 404, `RATE_LIMITED` 429)
- [X] T012 [P] `src/templates/types.ts`에 `StudyTemplate` 인터페이스 (trd.md §3.3, zod import) + 빈 `src/templates/registry.ts` 등록부
- [X] T013 `tests/setup/db.ts` 테스트 하네스 — 각 테스트 트랜잭션 롤백 격리, TRUNCATE 금지 (CLAUDE.md §9)

**Checkpoint**: 토대 준비 완료 — 사용자 스토리 시작 가능.

---

## Phase 3: User Story 1 - 페르소나 전환으로 즉시 테스트 (Priority: P1) 🎯 MVP

**Goal**: 개발 환경에서 Mock 모달로 페르소나(`gs_leader`/`gs_member`/`seoul_cadet`)와
로그아웃(`guest`)을 1회 클릭 전환하고, 세션이 즉시 교체된다.

**Independent Test**: 로컬에서 모달의 각 페르소나를 클릭해 `getCurrentUser()`가 해당 유저
(또는 `guest`→null)를 반환하는지 확인 (quickstart 시나리오 3).

### Tests for User Story 1 ⚠️ (먼저 작성, 실패 확인)

- [X] T014 [P] [US1] `tests/lib/auth.test.ts` — `getCurrentUser()`: 유효 페르소나 쿠키 시 users Upsert 후 해당 유저 반환, 쿠키 없음/`guest`/손상 시 `null` 반환(예외 없음)
- [X] T015 [P] [US1] `tests/api/mock-auth.test.ts` — POST `/api/mock-auth` persona `gs_leader` 시 `modoo42_mock_user` 쿠키 세팅 200, `guest` 시 쿠키 삭제 200

### Implementation for User Story 1

- [X] T016 [US1] `src/lib/auth.ts`에 `getCurrentUser()` 구현 — `modoo42_mock_user` 쿠키 파싱, 페르소나→고정 `intra_id`/campus 매핑 후 users Upsert(research 결정 3), `guest`/없음/손상/미지값 → `null`
- [X] T017 [US1] `src/app/api/mock-auth/route.ts`에 POST 핸들러 — body `{persona}` 수신, 유효 페르소나 쿠키 세팅, `guest` 쿠키 삭제, 200 `{persona}` 반환 (contracts/mock-auth.md)
- [X] T018 [US1] `src/components/MockAuthModal.tsx` — 우하단 플로팅 `[🛠 Mock Auth]` 모달, 4버튼(3 페르소나 + 로그아웃), 클릭 시 POST 후 페이지 즉시 갱신
- [X] T019 [US1] `src/app/layout.tsx`에 `MockAuthModal` 마운트 (기존 Geist 폰트 유지, 폰트 교체는 Phase 3 UI 범위)

**Checkpoint**: US1 독립 동작 — 페르소나 전환 MVP 완성.

---

## Phase 4: User Story 2 - 상용 환경에서 Mock 인증 차단 (Priority: P1)

**Goal**: 상용 빌드에서 Mock 모달 비노출 + Mock 세션 주입 거부. 서버·클라이언트 이중 차단.

**Independent Test**: 상용 모드 구동 시 모달 비노출, `/api/mock-auth` POST가 404 (quickstart
시나리오 4).

### Tests for User Story 2 ⚠️ (먼저 작성, 실패 확인)

- [X] T020 [US2] `tests/api/mock-auth.test.ts`에 추가 — `NODE_ENV !== 'development'`일 때 POST `/api/mock-auth`가 404, 세션 불변 (T015와 같은 파일이라 순차)
- [X] T021 [P] [US2] `tests/api/mock-auth.test.ts`가 아닌 별도 케이스로 알 수 없는 persona → 400, 쿠키 불변 검증 (FR-005) — T020과 같은 파일이면 순차 처리

### Implementation for User Story 2

- [X] T022 [US2] `src/app/api/mock-auth/route.ts`에 `NODE_ENV === 'development'` 가드 추가 (아니면 404) + 미지/누락 persona → 400 `{error:"BAD_REQUEST"}` 세션 불변
- [X] T023 [US2] `src/components/MockAuthModal.tsx`에 가드 — `process.env.NODE_ENV !== 'development'`면 `null` 렌더

**Checkpoint**: US2 독립 검증 — 상용 인증 우회 차단 완성 (보안 불변식).

---

## Phase 5: User Story 3 - 데이터 모델과 개발 도구 준비 (Priority: P2)

**Goal**: 유저·게시글·참여 저장소와 개발 도구가 갖춰져 Phase 1 TDD를 시작할 수 있다.

**Independent Test**: 마이그레이션 적용 시 세 테이블 생성 + `drizzle-kit check` 통과, 테스트
러너가 실 DB로 실행 (quickstart 시나리오 1·2).

### Implementation for User Story 3

- [X] T024 [US3] `pnpm drizzle-kit migrate` 적용 후 `pnpm drizzle-kit check`로 스키마/마이그레이션 정합성 검증 (세 테이블·enum·인덱스 생성 확인, 재적용 멱등)
- [X] T025 [P] [US3] `tests/lib/auth.test.ts`에 통합 케이스 — 세 페르소나 Upsert 후 조회 시 campus가 각각 `GS`/`GS`/`SEOUL` (data-model.md seed)
- [X] T026 [US3] `pnpm test`가 `DATABASE_URL` 접속으로 트랜잭션 롤백 격리 하에 통과하고 TRUNCATE 미발생함을 확인

**Checkpoint**: US3 독립 검증 — 토대·도구 준비 완료.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 [P] `.env.example`와 CLAUDE.md "아직 준비되지 않은 것"(zod/vitest/drizzle.config/vitest.config) 기술 상태 일치 갱신
- [X] T028 CI 게이트 로컬 실행 — `pnpm lint && pnpm typecheck && pnpm test && pnpm drizzle-kit check` 전부 통과
- [X] T029 quickstart.md 시나리오 1~4 수동 수행 (상용 차단 `curl` 404 포함)

---

## Dependencies

- **Phase 1 Setup** → **Phase 2 Foundational** → 사용자 스토리.
- **US1 (P1)**: Foundational(T005–T013) 의존 — users 테이블·db 클라이언트·테스트 하네스.
- **US2 (P1)**: US1 의존 — 같은 `route.ts`/`MockAuthModal.tsx`에 가드 추가.
- **US3 (P2)**: Foundational(스키마·마이그레이션) 의존, T025는 US1의 `getCurrentUser` Upsert 의존.
- 상용 차단(US2)은 보안 불변식이므로 US1 직후 즉시 처리 권장.

## Parallel Opportunities

- Setup: T002·T003·T004 병렬.
- Foundational: T011·T012 병렬 (T005–T009는 같은 `schema.ts`/순차 의존).
- US1 테스트: T014·T015 병렬 (다른 파일).
- 같은 파일 수정은 병렬 불가 — `mock-auth.test.ts`(T015/T020/T021), `route.ts`(T017/T022), `MockAuthModal.tsx`(T018/T023)는 순차.

## Implementation Strategy

**MVP = User Story 1** (페르소나 전환). Foundational + US1 완료 시 로컬 개발 세션 주입이
동작한다. US2(상용 차단)는 보안상 MVP와 함께 머지 권장. US3는 토대 검증이므로
Foundational과 사실상 겹치며 마지막에 정합성·격리를 확인한다.
