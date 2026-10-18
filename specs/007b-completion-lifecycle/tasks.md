# Tasks: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Input**: Design documents from `/specs/007b-completion-lifecycle/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/completion-ui.md](./contracts/completion-ui.md)

**Tests**: 본 프로젝트 헌법 I(사양 주도 · 테스트 우선)에 따라 상세 조회 리더 전용 투영 및 완주·회고 파생/직렬화 로직은 반드시 실패하는 테스트(Red)를 먼저 작성하고 구현(Green)한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능 (서로 다른 파일, 미완료 의존성 없음)
- **[Story]**: 해당 작업이 속한 유저 스토리 (`[US1]`, `[US2]`, `[US3]`)
- 모든 작업 설명에 정확한 파일 경로 포함

---

## Phase 1: Setup (뷰 타입 확장)

**Purpose**: 상세 모달과 마무리 모달이 공유하는 `VerdictMember` 및 `PostDetail` 확장 필드를 `src/lib/view-types.ts`에 선언.

- [x] T001 `src/lib/view-types.ts`에 `VerdictMember` 타입(`PublicUser & { userId: string }`)을 정의하고 `PostDetail`에 `proofUrl: string | null`, `postmortemText: string | null`, `verdictMembers?: VerdictMember[]` 필드 추가 (data-model.md §2)

---

## Phase 2: Foundational (상세 조회 리더 전용 투영 및 파생 함수 시그니처)

**Purpose**: `getPostDetail`이 `TC-IDENT-04`를 깨뜨리지 않고 리더 본인에게만 `verdictMembers`를 내려주도록 확장하고, `leader-actions.ts`의 완주·회고 파생/빌더 함수 시그니처 마련.

### Tests for Foundational (Red 먼저) ⚠️

- [x] T002 `tests/posts-detail.test.ts`에 상세 조회 확장 테스트 추가 — 리더 본인 조회 시에만 리더 제외 `JOINED` 참여자가 `verdictMembers`(`{ userId, login, campus }`)로 포함되고 비리더 조회 시에는 `verdictMembers` 키가 없으며, `leader`·`participants`는 여전히 `PublicUser`(`TC-IDENT-04`)이고 `proofUrl`·`postmortemText`가 반환됨을 검증 (data-model.md §2)

### Implementation for Foundational (Green)

- [x] T003 `src/lib/posts.ts`의 `getPostDetail`에 `proofUrl`, `postmortemText` 및 리더 본인(`viewerId === post.leaderId`) 전용 `verdictMembers` 매핑을 구현하여 T002 테스트 통과 (data-model.md §2)
- [x] T004 `src/lib/leader-actions.ts`에 `CompletionChoice`, `CompletionActionState`, `CompleteFormInput`, `BuiltCompletePayload`, `BuiltPostmortemPayload` 타입 및 `completionActionStateOf`, `buildCompletePayload`, `buildPostmortemPayload` 시그니처 정의 (data-model.md §3~§4)

**Checkpoint**: 상세 조회 데이터와 타입 시그니처 준비 완료 — US1·US2 Red 테스트 작성 가능.

---

## Phase 3: User Story 1 - 리더가 판정 창이 열린 정규 스터디에서 팀원 완주를 벌크 판정하고 명예의 전당에 등록한다 (Priority: P1) 🎯 MVP

**Goal**: 정규 스터디(`STUDY`) 리더가 판정 창(종료월 15일~익월 10일) 안에 상세 모달에서 마무리 모달(`CompletionModal.tsx`)을 열어 팀원 완주 체크박스(기본 전원 체크)와 선택적 증빙 URL(`https://`)로 완주 판정(`POST /api/posts/:id/complete`)을 수행한다.

**Independent Test**: `tests/lib/leader-actions.test.ts`의 `completionActionStateOf`·`buildCompletePayload` 테스트가 통과하고, 마무리 모달에서 팀원 체크박스 및 증빙 링크 제출 시 `POST /api/posts/:id/complete`가 호출된다.

### Tests for User Story 1 (Red 먼저) ⚠️

- [x] T005 [US1] `tests/lib/leader-actions.test.ts`에 `completionActionStateOf`(비리더·`PARTY`·`LIVE`·최종 상태 `showEntry: false`, 창 오픈 전 `canOpenModal: false`, 창 안+팀원 1명 이상 `canComplete: true` & `defaultChoice: 'complete'`, 팀원 0명 `canComplete: false` & `defaultChoice: 'postmortem'`) 및 `buildCompletePayload`(전원 미체크 거절, 증빙 URL 빈 값 허용·키 생략, `https://` 통과, 비-HTTPS 거절) 단위 테스트 작성 (data-model.md §3, §4.1)

### Implementation for User Story 1 (Green)

- [x] T006 [US1] `src/lib/leader-actions.ts`에 `completionActionStateOf`와 `buildCompletePayload`를 구현하여 T005 테스트 통과 (data-model.md §3, §4.1)
- [x] T007 [US1] `src/components/detail/CompletionModal.tsx` 생성 — `docs/designs/complete.html` 기반 모달 헤더·경로 선택 카드(`[🏆 완주했어요]` / `[🪦 Post-mortem 남기기]`)·팀원 완주 체크박스 목록(초기 전원 체크)·증빙 URL 선택 입력 및 `POST /api/posts/${post.id}/complete` 연동 구현 (contracts/completion-ui.md §2)
- [x] T008 [US1] `src/components/detail/LeaderActions.tsx`에 `completionActionStateOf` 기반 마무리 입구 버튼(`[스터디 종료 및 결과 기록]`)과 `CompletionModal` 연결 (contracts/completion-ui.md §2)

**Checkpoint**: US1 완료 — 판정 창 내 정규 스터디 리더가 팀원 벌크 완주 판정을 수행할 수 있다.

---

## Phase 4: User Story 2 - 리더가 목표 미달성 스터디의 Post-mortem 회고를 등록하거나 보강한다 (Priority: P1)

**Goal**: 리더가 마무리 모달에서 `[🪦 Post-mortem 남기기]` 경로를 선택(또는 팀원 0명·기한 경과·회고 기등록 시 자동 선택)해 1~1000자 회고를 등록·덮어쓴다 (`POST /api/posts/:id/postmortem`).

**Independent Test**: `tests/lib/leader-actions.test.ts`의 회고 기등록·기한 경과 상태 파생 및 `buildPostmortemPayload` 테스트가 통과하고, 마무리 모달에서 Post-mortem 제출 및 수정이 동작한다.

### Tests for User Story 2 (Red 먼저) ⚠️

- [x] T009 [US2] `tests/lib/leader-actions.test.ts`에 `completionActionStateOf`의 회고 기등록(`postmortemText !== null` → `canComplete: false`, `entryLabel: 'Post-mortem 회고 수정'`)·판정 기한 경과(`now > closesAt` → `canComplete: false`, `canPostmortem: true`) 케이스와 `buildPostmortemPayload`(공백만 있는 문자열 거절, 1001자 거절, 1~1000자 trim 통과) 단위 테스트 추가 (data-model.md §3, §4.2)

### Implementation for User Story 2 (Green)

- [x] T010 [US2] `src/lib/leader-actions.ts`에 `buildPostmortemPayload` 및 회고 기등록/기한 경과 분기를 완성하여 T009 테스트 통과 (data-model.md §3, §4.2)
- [x] T011 [US2] `src/components/detail/CompletionModal.tsx`에 `docs/designs/complete_postmortem.html` 기반 Post-mortem 회고 입력 폼(`defaultValue={post.postmortemText ?? ''}`, 1~1000자 검증) 및 `POST /api/posts/${post.id}/postmortem` 호출 연결 (contracts/completion-ui.md §2)

**Checkpoint**: US2 완료 — 완주 판정과 Post-mortem 회고 등록/수정이 단일 마무리 모달에서 모두 동작한다.

---

## Phase 5: User Story 3 - 상세 모달에서 완주 증빙 링크와 등록된 Post-mortem 회고를 열람한다 (Priority: P2)

**Goal**: 상세 모달(`PostDetailModal.tsx`)에서 완주 스터디의 `proofUrl` 외부 링크와 등록된 `postmortemText` 회고 본문을 표시한다.

**Independent Test**: `post.proofUrl` 또는 `post.postmortemText`가 있는 글의 상세 모달에 해당 정보가 노출된다.

### Implementation for User Story 3

- [x] T012 [US3] `src/components/detail/PostDetailModal.tsx`에 `post.proofUrl`(`완주 결과물 링크 ↗`) 및 `post.postmortemText`(Post-mortem 회고 박스) 조건부 렌더링 추가 (contracts/completion-ui.md §2.3)

**Checkpoint**: US3 완료 — 상세 모달에서도 완주 결과물과 회고를 열람할 수 있다.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 문서 동기화 및 로컬 필수 게이트 5종 통과 확인.

- [x] T013 [P] `docs/next-steps.md` §3에 `007a-leader-actions` 머지(PR #13) 및 `007b-completion-lifecycle` 구현 완료 상태 반영
- [x] T014 로컬 필수 게이트 5종 실행 및 통과 확인 — `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` → `pnpm drizzle-kit check` (quickstart.md §1)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 (`T001`)
- **Phase 2 (Foundational)**: Phase 1 이후 (`T002` Red → `T003`·`T004` Green)
- **Phase 3 (US1 - 완주 판정)**: Phase 2 이후 (`T005` Red → `T006`·`T007`·`T008` Green)
- **Phase 4 (US2 - Post-mortem 회고)**: Phase 3 이후 (`T009` Red → `T010`·`T011` Green)
- **Phase 5 (US3 - 상세 모달 표출)**: Phase 1 이후 독립 실행 가능 (`T012`)
- **Phase 6 (Polish)**: 전 스토리 완료 후 게이트 실행 (`T013`, `T014`)

### Parallel Opportunities

- `T002`(`tests/posts-detail.test.ts`)와 `T005`/`T009`(`tests/lib/leader-actions.test.ts`)는 서로 다른 테스트 파일이므로 독립 검증 가능.
- `T012`(`PostDetailModal.tsx`)와 `T007`(`CompletionModal.tsx`)은 서로 다른 컴포넌트 파일이므로 병렬 작업 가능.

---

## Implementation Strategy

### Incremental Delivery & Commit Units

1. **Commit 1 (`docs`)**: `specs/007b-completion-lifecycle/` 명세·설계·작업 분해 산출물 커밋.
2. **Commit 2 (`feat` + `test`)**: `getPostDetail` 리더 전용 `verdictMembers` 확장 + `completionActionStateOf`/`buildCompletePayload`/`buildPostmortemPayload` 순수 함수(TDD Red → Green) + `CompletionModal.tsx`·`LeaderActions.tsx`·`PostDetailModal.tsx` UI 포팅 및 결합 커밋.
3. **Commit 3 (`docs`)**: `docs/next-steps.md` 및 `specs/007b-completion-lifecycle/tasks.md` 완료 체크 갱신 후 원격 푸시 & PR 생성.
