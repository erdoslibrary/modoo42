---
description: "Task list for 코어 모집 & 참여 루프 (Phase 1)"
---

# Tasks: 코어 모집 & 참여 루프 (Phase 1)

**Input**: Design documents from `/specs/002-recruit-join-core/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함(강제). 헌법 I(NON-NEGOTIABLE) — 핵심 도메인 로직은 TDD(Red→Green→Refactor), `describe`/`it`에 requirement §3 TC ID 그대로.

**Organization**: 유저 스토리별 그룹. 서비스 로직은 `src/lib/posts.ts` 한 파일을 공유하므로 스토리 간 impl 태스크는 파일 충돌로 [P] 불가 — 의존성에 명시.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일 + 선행 미완 의존 없음 → 병렬 가능
- **[Story]**: US1~US5 (spec.md 매핑)

## Path Conventions
Next.js 단일 앱. `src/`, `tests/` 리포 루트. plan.md 구조 따름.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Phase 1 공용 기반. 대부분 Phase 0에서 완료됨 — 신규 설정 없음.

- [X] T001 기존 자산 확인: `src/lib/auth.ts`(`getCurrentUser`, `DbLike` 주입 패턴), `src/lib/errors.ts`(`AppError`/`toErrorResponse`), `src/db/index.ts`(`db`), `src/db/schema.ts` 재사용 가능 상태인지 점검. 신규 의존성 설치 없음(zod/vitest/drizzle 이미 설치).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: 이 Phase 완료 전 어떤 유저 스토리도 시작 불가.

- [X] T002 `src/db/schema.ts` `posts` 테이블에 `cancelReason: text('cancel_reason')` 컬럼 추가(nullable, FR-005 취소 사유 저장). **같은 변경을 `docs/trd.md` §3.2 스키마 블록과 ERD(§3.1 POSTS)에 동반 반영**(헌법 II). 이어서 `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`로 마이그레이션 1건 생성·적용.
- [X] T003 [P] `docs/trd.md` §4 API 표에 행 추가: `POST /api/posts/:id/status` — 리더의 수동 마감/재모집 토글(`RECRUITING↔CLOSED`), 인증 리더 본인, Phase 1 (research R5 근거).
- [X] T004 [P] `tests/helpers/db.ts` 작성: 트랜잭션 롤백 격리 헬퍼. 서비스 함수에 `tx` 주입 → 테스트 종료 시 롤백. TRUNCATE 금지(공용 Supabase, CLAUDE.md §9). 동시성 테스트용으로 실제 커밋 후 특정 글/참여 정리하는 보조 유틸도 포함.
- [X] T005 [P] `src/lib/validation.ts` 생성: `chat_url` 화이트리스트 정규식 상수 3종(`^https://open\.kakao\.com/`, `^https://discord\.gg/`, `^https://discord\.com/invite/`)과 `reference_url`(`^https://`) 검증, `chatPlatform` 유도 헬퍼(`kakao`|`discord`). Zod 스키마는 각 스토리에서 추가.
- [X] T006 `src/lib/posts.ts` 모듈 스켈레톤 생성: `db`/`schema`/`AppError`/drizzle(`eq`,`and`,`sql`) import, 공용 타입(`ViewerId` 등), 함수 시그니처 스텁(`createPost`/`joinPost`/`getPostDetail`/`listPosts`/`updatePost`/`cancelPost`/`toggleStatus`). 본문은 각 스토리에서 구현. (T005 의존)

**Checkpoint**: 스키마·문서·검증·서비스 모듈 준비 완료.

---

## Phase 3: User Story 1 - 스터디/단기 파티 개설 (Priority: P1) 🎯 MVP

**Goal**: 리더가 STUDY/PARTY를 개설하고 자동으로 첫 참여자가 된다.

**Independent Test**: 유효 STUDY 개설 → 201, `status RECRUITING`, `currentMembers 1`, 리더 `JOINED` 레코드 존재.

### Tests (Red 먼저)

- [X] T007 [US1] `tests/posts-create.test.ts` 작성 후 실패 확인: TC-POST-01(정상 생성 + 리더 `JOINED` 자동 삽입), TC-POST-02(title 41자 → `BAD_REQUEST`), TC-POST-03(maxMembers 1 또는 11 → `BAD_REQUEST`), TC-POST-04(`https://google.com` 차단 / `https://open.kakao.com/o/xxx` 통과). STUDY `end_date` 자동 산출(1~14→당월말, 15~말일→익월말) 경계 테스트 포함.

### Implementation (Green)

- [X] T008 [P] [US1] `src/lib/end-date.ts`: 순수 함수 `computeStudyEndDate(openedAt: Date): Date`. 개설일 1~14일→당월 말일, 15일~말일→익월 말일(KST). 12월→익년 1월 경계 처리.
- [X] T009 [P] [US1] `src/lib/validation.ts`에 `createPostSchema` 추가: `type` ∈ {STUDY,PARTY}, `title` 1~40자, `tags` 1~3개, `locationType` enum, `maxMembers` 2~10(기본 10), `chatUrl` 화이트리스트(T005), `referenceUrl` https 선택, `description` 0~300자 선택, `place` 선택, PARTY만 `endDate` 사용. 서버가 최종 방어선.
- [X] T010 [US1] `src/lib/posts.ts` `createPost(input, leaderId, db)` 구현: 트랜잭션에서 STUDY `end_date` 산출(입력 무시)·PARTY 입력값 사용 → `posts` insert(`currentMembers:1`,`status:RECRUITING`,`leaderId` 서버 주입) → 리더 `participants(JOINED)` insert. (T006,T008,T009 의존)
- [X] T011 [US1] `src/app/api/posts/route.ts` POST 핸들러: `getCurrentUser()`(null→`FORBIDDEN`) → body `createPostSchema` 파싱(실패→`BAD_REQUEST`) → `createPost` 호출 → 201 `{id,status,currentMembers}`. 에러는 `toErrorResponse`. (T010 의존)

**Checkpoint**: 개설 end-to-end 독립 동작.

---

## Phase 4: User Story 2 - 원클릭 참여 & 동시성 방어 + 링크 가시성 (Priority: P1)

**Goal**: 참여 시 정원 초과 없이 원자적 처리, 비참여자에게 `chat_url` 마스킹.

**Independent Test**: 정원 1자리에 5명 동시 참여 → 1명 성공·4명 `FULL`, 초과 0건. 비참여자 상세에 `chatUrl` 키 없음.

### Tests (Red 먼저)

- [X] T012 [US2] `tests/posts-join.test.ts` 작성 후 실패 확인: TC-JOIN-01(참여 → `current_members+1`, `JOINED` 레코드, `chatUrl` 반환), TC-JOIN-02(중복 참여 멱등 → 카운트 미증가, 기존 `chatUrl`, `reJoined:true`), TC-JOIN-03(마지막 자리 → 자동 `CLOSED`), TC-RACE-01(정원 1자리 5명 동시 → 1 성공/4 `FULL`, 초과 0 — 독립 커넥션/실제 커밋 후 정리).
- [X] T013 [US2] `tests/posts-detail.test.ts` 작성 후 실패 확인: 비참여자 상세 응답에 `chatUrl` 키 미존재(SC-005), 참여자/리더 응답엔 포함, `chatPlatform`·`referenceUrl`은 비참여자에게도 공개, 리스트는 전원 `chatUrl` 미포함.

### Implementation (Green)

- [X] T014 [US2] `src/lib/posts.ts` `joinPost(postId, userId, db)` 구현: trd §4.1 순서 그대로 — `.for('update')` 락 → 없으면 `NOT_FOUND` → `status!=='RECRUITING'`→`CLOSED` → 기존 `JOINED` 멱등 반환 → `maxMembers` 도달→`FULL` → participants insert/update → `currentMembers+1` 및 도달 시 `CLOSED` 전이. 반환 `{chatUrl, reJoined}`. (T006 의존)
- [X] T015 [US2] `src/lib/posts.ts` `getPostDetail(postId, viewerId, db)`·`listPosts(filter, db)` 구현: 참여 여부 조회 → 비참여자면 반환 객체에서 `chatUrl` 키 제외(null 치환 아님, 헌법 V). `chatPlatform` 유도(T005). 리스트는 전원 `chatUrl` 제외, `type`/`status`/`sort`(latest|deadline) 필터, 캠퍼스 필터 없음. 참여자/리더는 `intraId`·`campus`만(avatar 없음). (T006 의존)
- [X] T016 [US2] `src/app/api/posts/[id]/join/route.ts` POST: 인증 → `joinPost` → 200 `{chatUrl,reJoined}`. (T014 의존)
- [X] T017 [US2] `src/app/api/posts/[id]/route.ts` GET(detail) + `src/app/api/posts/route.ts` GET(list) 핸들러: 인증 → `getPostDetail`/`listPosts` → 200. (T015 의존, T011과 `posts/route.ts` 공유 — POST/GET 병합)

**Checkpoint**: US1 + US2 독립 동작. MVP 완성(개설·참여·조회).

---

## Phase 5: User Story 3 - 리더 수동 마감/재모집 토글 (Priority: P2)

**Goal**: 리더가 `RECRUITING↔CLOSED`를 수동 토글.

**Independent Test**: 리더 마감→`CLOSED`, 재모집→`RECRUITING`. 비리더 토글→403.

### Tests (Red 먼저)

- [X] T018 [US3] `tests/posts-status.test.ts` 작성 후 실패 확인: 마감→재모집 복귀, 비리더 토글→`FORBIDDEN`, `COMPLETED`/`CANCELLED` 대상→`BAD_REQUEST`, 허용 외 status 값→`BAD_REQUEST`.

### Implementation (Green)

- [X] T019 [US3] `src/lib/posts.ts` `toggleStatus(postId, leaderId, nextStatus, db)` 구현: 리더 검증(불일치→`FORBIDDEN`), 현재 상태 `RECRUITING`|`CLOSED`만 토글 허용, 최종상태→`BAD_REQUEST`, `nextStatus`∈{CLOSED,RECRUITING} 외→`BAD_REQUEST`. (T006 의존)
- [X] T020 [US3] `src/app/api/posts/[id]/status/route.ts` POST: 인증 → body `{status}` 파싱 → `toggleStatus` → 200 `{id,status}`. (T019 의존)

**Checkpoint**: US1~US3 독립 동작.

---

## Phase 6: User Story 4 - 리더 게시글 수정 (Priority: P2)

**Goal**: 리더가 `RECRUITING` 글의 title/description/chatUrl/place 수정.

**Independent Test**: 리더 수정 즉시 반영. 비리더→403. 비 RECRUITING→400.

### Tests (Red 먼저)

- [X] T021 [US4] `tests/posts-update.test.ts` 작성 후 실패 확인: TC-LEADER-01(비리더 수정→`FORBIDDEN`), 정상 수정 반영, `chatUrl` 화이트리스트 재검증, `RECRUITING` 아닌 글 수정→`BAD_REQUEST`.

### Implementation (Green)

- [X] T022 [P] [US4] `src/lib/validation.ts`에 `updatePostSchema` 추가: `title` 1~40자?, `description` 0~300자?, `chatUrl` 화이트리스트?, `place`? — 전부 선택(부분 수정), 그 외 필드 거부.
- [X] T023 [US4] `src/lib/posts.ts` `updatePost(postId, leaderId, patch, db)` 구현: 없으면 `NOT_FOUND`, 비리더→`FORBIDDEN`, `status!=='RECRUITING'`→`BAD_REQUEST`, 허용 필드만 갱신·`updatedAt` 갱신. (T006,T022 의존)
- [X] T024 [US4] `src/app/api/posts/[id]/route.ts` PUT 핸들러 추가: 인증 → `updatePostSchema` 파싱 → `updatePost` → 200 `{id,updatedAt}`. (T023 의존, T017과 `[id]/route.ts` 공유 — GET/PUT 병합)

**Checkpoint**: US1~US4 독립 동작.

---

## Phase 7: User Story 5 - 스터디 중도 취소 (Priority: P2)

**Goal**: 리더가 사유와 함께 취소 → `CANCELLED`(최종), 이후 액션 전부 차단.

**Independent Test**: 리더 취소→`CANCELLED`+사유 저장. 이후 `/join`·수정→400. 비리더→403.

### Tests (Red 먼저)

- [X] T025 [US5] `tests/posts-cancel.test.ts` 작성 후 실패 확인: TC-CANCEL-01(취소 전이 + `cancel_reason` 저장 + 신규 액션 차단), 비리더 취소→`FORBIDDEN`, 이미 `CANCELLED`/`COMPLETED` 재취소→`BAD_REQUEST`, 취소 후 `joinPost`→`CLOSED`(RECRUITING 아님).

### Implementation (Green)

- [X] T026 [US5] `src/lib/posts.ts` `cancelPost(postId, leaderId, reason, db)` 구현: 없으면 `NOT_FOUND`, 비리더→`FORBIDDEN`, 현재 `RECRUITING`|`CLOSED`만 허용(최종상태→`BAD_REQUEST`), `status='CANCELLED'`+`cancelReason` 저장. (T002,T006 의존)
- [X] T027 [US5] `src/app/api/posts/[id]/cancel/route.ts` POST: 인증 → body `{reason}` 파싱 → `cancelPost` → 200 `{id,status}`. (T026 의존)

**Checkpoint**: US1~US5 전체 독립 동작.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T028 [P] 커버리지 확인: `pnpm test -- --coverage`로 핵심 도메인 로직(참여 동시성/상태 머신/권한) 90% 이상(NFR-006) 확인, 미달 시 테스트 보강.
- [X] T029 [P] `pnpm lint && pnpm typecheck && pnpm drizzle-kit check` 통과 확인.
- [X] T030 `specs/002-recruit-join-core/quickstart.md`의 수동 검증(curl 시나리오) 실행으로 end-to-end 확인.

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup(T001) → Foundational(T002~T006) → US1~US5 → Polish.
- **Foundational이 모든 스토리를 블록**한다(특히 T002 스키마, T006 posts.ts 스켈레톤).

### User Story Dependencies
- US1·US2(P1): Foundational 후 독립 시작 가능. MVP = US1+US2.
- US3·US4·US5(P2): Foundational 후 독립. 단 `src/lib/posts.ts`·일부 route 파일 공유로 impl 순차 권장.

### 파일 공유 주의 (= [P] 불가 지점)
- `src/lib/posts.ts`: T010/T014/T015/T019/T023/T026이 같은 파일 → 순차.
- `src/app/api/posts/route.ts`: T011(POST)+T017(GET) 병합.
- `src/app/api/posts/[id]/route.ts`: T017(GET)+T024(PUT) 병합.
- `src/lib/validation.ts`: T005/T009/T022 같은 파일 → 순차(추가만).

### Within Each Story
- 테스트(Red) → 서비스 → route. 테스트 실패 확인 후 구현.

---

## Parallel Example: Foundational
```bash
# T003(trd 문서), T004(테스트 헬퍼), T005(validation 상수)는 서로 다른 파일 → 병렬
Task: "docs/trd.md §4에 status 엔드포인트 행 추가"
Task: "tests/helpers/db.ts 롤백 격리 헬퍼 작성"
Task: "src/lib/validation.ts chat_url 화이트리스트 상수 작성"
```

---

## Implementation Strategy

### MVP First (US1 + US2)
1. Setup(T001) → Foundational(T002~T006).
2. US1(T007~T011) → 개설 검증.
3. US2(T012~T017) → 참여·동시성·링크 가시성 검증.
4. **STOP & VALIDATE**: TC-RACE-01, SC-005 통과 확인 → MVP.

### Incremental Delivery
US3(토글) → US4(수정) → US5(취소) 순으로 각각 독립 검증 후 추가.

---

## Notes
- [P] = 다른 파일·선행 의존 없음.
- 테스트 `describe`/`it` 제목에 TC ID 그대로(헌법 I).
- 커밋은 Conventional Commits(한국어 제목), `main` 직접 커밋 금지 — `002-recruit-join-core` 브랜치 PR.
- 스키마·문서 동반 수정(T002,T003)은 같은 PR에.
