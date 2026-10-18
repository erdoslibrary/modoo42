# Tasks: 리더 기본 액션 상세 모달 결합 (007a)

**Input**: Design documents from `/specs/007a-leader-actions/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/leader-actions.md](./contracts/leader-actions.md)

**Tests**: 본 프로젝트 헌법 I(사양 주도 · 테스트 우선)에 따라 파생 로직 및 검증 스키마는 반드시 실패하는 테스트(Red)를 먼저 작성하고 구현(Green)한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (서로 다른 파일, 미완료 의존성 없음)
- **[Story]**: 해당 작업이 속한 유저 스토리 (`[US1]`, `[US2]`, `[US3]`)
- 모든 작업 설명에 정확한 파일 경로 포함

---

## Phase 1: Setup (SSOT 동기화)

**Purpose**: `007a`/`007b` 분할 명세를 요구사항 정의서 SSOT에 반영하고 사양 산출물 고정.

- [x] T001 `docs/requirement.md`의 `FR-021`에 `007a`(리더 기본 액션 3종)와 `007b`(완주·회고 화면 포팅) 분할 범위 및 검증 기준 반영

---

## Phase 2: Foundational (리더 액션 상태 파생 모듈 골격)

**Purpose**: US1~US3가 공통으로 참조하는 `LeaderActionState` 타입 및 `src/lib/leader-actions.ts` 모듈 진입점 마련.

- [ ] T002 `src/lib/leader-actions.ts`에 `LeaderActionState`, `EditFormInput`, `BuiltUpdatePatch` 타입과 함수 시그니처(`leaderActionStateOf`, `buildUpdatePatch`) 정의 (data-model.md §2~§3)

**Checkpoint**: 타입 정의 완료 — 각 유저 스토리의 Red 테스트 작성 가능.

---

## Phase 3: User Story 1 - 리더가 모집 상태를 수동으로 마감하거나 재모집으로 되돌린다 (Priority: P1) 🎯 MVP

**Goal**: 리더 본인이 상세 모달에서 모집 중(`RECRUITING`) 글을 수동 마감(`CLOSED`)하거나 마감(`CLOSED`) 글을 재모집(`RECRUITING`)으로 전환한다. 정원 도달이나 단기 파티 마감일 도과 시에는 토글을 비활성화한다.

**Independent Test**: `tests/lib/leader-actions.test.ts`의 `leaderActionStateOf` 테스트가 통과하고, 상세 모달에서 `[마감하기]` ↔ `[재모집하기]` 버튼이 `POST /api/posts/:id/status`와 연동된다.

### Tests for User Story 1 (Red 먼저) ⚠️

- [ ] T003 [US1] `tests/lib/leader-actions.test.ts`에 `leaderActionStateOf` 단위 테스트 작성 — 비리더/게스트(`visible: false`), LIVE 핑(`visible: false`), `COMPLETED`/`CANCELLED`(`visible: false`), `RECRUITING`(`canToggleStatus: true`, `nextToggleStatus: 'CLOSED'`, `toggleLabel: '마감하기'`), `CLOSED`+정원 여유(`canToggleStatus: true`, `nextToggleStatus: 'RECRUITING'`, `toggleLabel: '재모집하기'`), `CLOSED`+정원 도달 `currentMembers >= maxMembers`(`canToggleStatus: false`), 마감일 지난 `PARTY` `endDate <= now`(`canToggleStatus: false`) 검증 (data-model.md §2)

### Implementation for User Story 1 (Green)

- [ ] T004 [US1] `src/lib/leader-actions.ts`에 `leaderActionStateOf(post, role, now)` 구현하여 T003 테스트 통과 (data-model.md §2)
- [ ] T005 [US1] `src/components/detail/LeaderActions.tsx` 및 `src/components/detail/PostDetailModal.tsx`에 `leaderActionStateOf`를 연결하고, `POST /api/posts/${post.id}/status`를 호출하는 `[마감하기]` / `[재모집하기]` 토글 버튼 추가 (contracts/leader-actions.md §2)

**Checkpoint**: US1 완료 — 리더가 상세 모달에서 마감/재모집을 토글할 수 있고 정원 도달·만료 시 비활성화된다.

---

## Phase 4: User Story 2 - 리더가 모집 중인 게시글의 정보를 수정한다 (Priority: P1)

**Goal**: 리더가 `RECRUITING` 상태에서 제목·설명·장소·초대 링크를 수정하고, 설명·장소를 빈칸으로 제출하면 `null`로 초기화하며, `CLOSED` 상태에서는 `[수정하기]` 버튼을 비활성화한다.

**Independent Test**: `tests/lib/leader-actions.test.ts`의 `buildUpdatePatch` 테스트가 통과하고, `CLOSED` 상태에서 `[수정하기]`가 비활성화되며 수정 폼에서 설명·장소 비우기가 `null`로 전송된다.

### Tests for User Story 2 (Red 먼저) ⚠️

- [ ] T006 [US2] `tests/lib/leader-actions.test.ts`에 `buildUpdatePatch` 단위 테스트 추가 — 제목 1~40자 필수(빈 값·41자 거절), 설명·장소 빈 문자열 입력 시 `null` 직렬화(301자 설명 거절), `ONLINE`·`HYBRID`에서 `chatUrl` 빈 값 거절, `OFFLINE_GS`·`OFFLINE_SEOUL`에서 `chatUrl` 빈 값 허용(키 생략), 허용 외 `chatUrl` 도메인 거절 검증 (data-model.md §3)

### Implementation for User Story 2 (Green)

- [ ] T007 [US2] `src/lib/leader-actions.ts`에 `buildUpdatePatch(input, locationType)` 구현하여 T006 테스트 통과 (data-model.md §3)
- [ ] T008 [US2] `src/components/detail/LeaderActions.tsx`의 수정 버튼에 `disabled={!state.canEdit || pending}` 적용 및 수정 폼 제출 시 `buildUpdatePatch`를 사용해 클라이언트 검증·`null` 직렬화 반영 (contracts/leader-actions.md §2)

**Checkpoint**: US2 완료 — `RECRUITING`에서만 수정 가능하고 설명·장소 비우기(`null`) 및 `chatUrl` 조건부 검증이 동작한다.

---

## Phase 5: User Story 3 - 리더가 스터디 시작 전에 모집을 취소한다 (Priority: P2)

**Goal**: 리더가 `RECRUITING` 또는 `CLOSED` 상태에서 취소 사유(공백 제외 1~300자)를 입력해 모집을 취소(`CANCELLED`)한다.

**Independent Test**: 공백만 있는 취소 사유(`"   "`)가 `cancelSchema`와 취소 폼 양쪽에서 거절되고, 유효한 사유 입력 시 `CANCELLED` 전이 및 사유 표출이 동작한다.

### Tests for User Story 3 (Red 먼저) ⚠️

- [ ] T009 [P] [US3] `tests/lib/validation.test.ts`에 `cancelSchema` 단위 테스트 추가 — 공백만 있는 문자열(`"   "`) 실패, 301자 실패, 앞뒤 공백 포함 유효 사유(`"  인원 미달  "`) 통과 및 trim 결과(`"인원 미달"`) 확인 (data-model.md §4)

### Implementation for User Story 3 (Green)

- [ ] T010 [US3] `src/lib/validation.ts`의 `cancelSchema`에 `.trim()` 추가 (`z.string().trim().min(1).max(300)`)하여 T009 테스트 통과 (data-model.md §4)
- [ ] T011 [US3] `src/components/detail/LeaderActions.tsx`의 취소 폼에서 `reason`을 `.trim()` 검증(1~300자) 후 `POST /api/posts/${post.id}/cancel`로 전송하도록 보강 (contracts/leader-actions.md §2)

**Checkpoint**: US3 완료 — 모집 취소가 공백 사유를 방어하며 정상 동작한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 동기화 및 로컬 필수 게이트 5종 통과 확인.

- [ ] T012 [P] `docs/next-steps.md` §3에 `007a-leader-actions` 구현 완료 상태 반영
- [ ] T013 로컬 필수 게이트 5종 실행 및 통과 확인 — `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm drizzle-kit check` (quickstart.md §1)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 완료 (`T001`)
- **Phase 2 (Foundational)**: Phase 1 이후 (`T002`) — US1·US2의 공통 타입 제공
- **Phase 3 (US1 - 상태 토글)**: Phase 2 이후 (`T003` Red → `T004` Green → `T005` UI 결합)
- **Phase 4 (US2 - 게시글 수정)**: Phase 2 이후 (`T006` Red → `T007` Green → `T008` UI 결합)
- **Phase 5 (US3 - 모집 취소)**: `T009`·`T010`은 독립 실행 가능, `T011`은 `LeaderActions.tsx` 수정이므로 `T005`·`T008`과 순차 적용
- **Phase 6 (Polish)**: 전 스토리 완료 후 게이트 실행

### Parallel Opportunities

- `T003`/`T006`(리더 액션 순수 함수 테스트)과 `T009`(`validation.test.ts` 취소 스키마 테스트)는 서로 다른 파일이므로 병렬 작성 가능.

---

## Implementation Strategy

### Incremental Delivery & Commit Units

1. **Commit 1 (`docs`)**: `docs/requirement.md` SSOT 동기화 및 `specs/007a-leader-actions/` 명세·설계·할일 산출물 커밋.
2. **Commit 2 (`feat` + `test`)**: `leader-actions` 순수 함수(`leaderActionStateOf`, `buildUpdatePatch`) + `cancelSchema` trim 보강(TDD Red → Green) 및 `LeaderActions.tsx`·`PostDetailModal.tsx` UI 결합 커밋.
3. **Commit 3 (`docs`)**: `docs/next-steps.md` 및 `specs/007a-leader-actions/tasks.md` 체크 완료 반영 후 원격 푸시 & PR 생성.
