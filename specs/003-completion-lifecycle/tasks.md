---
description: "Task list for 완주 라이프사이클 (Phase 2 A)"
---

# Tasks: 완주 라이프사이클 (Phase 2 A)

**Input**: Design documents from `/specs/003-completion-lifecycle/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함(강제). 헌법 I(NON-NEGOTIABLE) — 완주 판정·상태 머신·권한·템플릿 검증은 TDD(Red→Green→Refactor), `describe`/`it`에 requirement §3 TC ID(`TC-COMPLETE-01`, `TC-COMPLETE-02`, `TC-LEADER-01`) 그대로.

**Organization**: 유저 스토리별 그룹. 서비스 로직은 `src/lib/posts.ts` 한 파일을 공유하므로 스토리 간 impl 태스크는 파일 충돌로 [P] 불가 — 의존성에 명시.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일 + 선행 미완 의존 없음 → 병렬 가능
- **[Story]**: US1~US4 (spec.md 매핑)

## Path Conventions
Next.js 단일 앱. `src/`, `tests/` 리포 루트. plan.md 구조 따름. 테스트 DB 헬퍼는 `tests/setup/db.ts`(`withRollback`, `createRacePool`), 페르소나 유저는 `resolvePersonaUser(persona, tx)`(`src/lib/auth.ts`).

## 테스트 작성 공통 규칙
- 판정 창 테스트는 글 생성 후 `tx.update(posts).set({ endDate })`로 `end_date`를 고정하고, 서비스 함수의 마지막 인자 `now`로 시각을 주입한다(research R3). 시스템 시계는 건드리지 않는다.
- Mock 페르소나는 3종(`gs_leader`/`gs_member`/`seoul_member`)뿐이다. 더 많은 유저가 필요하면 트랜잭션 안에서 `users`에 직접 insert한다(롤백으로 사라짐).
- 공용 Supabase라 다른 데이터가 섞여 있다. 랭킹 테스트는 테스트 유저 카운트를 매우 크게(예: `completed_count` 1,000,000 이상) 넣어 상위 5명을 확정적으로 점유한다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 신규 의존성·마이그레이션 없음. 기존 자산 점검만.

- [X] T001 기존 자산 점검: `src/db/schema.ts`에 `templateId`/`templateData`/`proofType`/`proofUrl`/`postmortemText`/`completedCount`/`leaderCount`/`participant_status`(`COMPLETED`/`INCOMPLETE`) 존재 확인, `src/templates/types.ts`(`StudyTemplate`)·`src/templates/registry.ts`(`templateRegistry`, `getTemplate`) 상태 확인. `pnpm drizzle-kit check` 통과 확인(스키마 변경 없음).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1·US2가 공유하는 판정 창 계산. 이후 모든 스토리의 선행 조건.

**⚠️ CRITICAL**: US1·US2 구현 전 완료.

- [X] T002 `tests/lib/end-date.test.ts`에 `computeVerdictWindow` 테스트 추가 후 실패 확인(Red): `end_date` = 2026-10-31 23:59:59.999 KST → `opensAt` = 2026-10-15 00:00:00.000 KST, `closesAt` = 2026-11-10 23:59:59.999 KST. 12월 사이클(2026-12-31) → `closesAt` = 2027-01-10 23:59:59.999 KST 연도 경계. 기존 `computeStudyEndDate` 테스트가 있으면 그 파일에 함께 둔다.
- [X] T003 `src/lib/end-date.ts`에 `computeVerdictWindow(endDate: Date): { opensAt: Date; closesAt: Date }` 구현(Green). 기존 `KST_OFFSET_MS` 벽시계 환산 방식 재사용: `end_date`의 KST 연/월을 M이라 하면 `opensAt` = M월 15일 00:00:00.000 KST, `closesAt` = (M+1)월 10일 23:59:59.999 KST. (T002 의존)

**Checkpoint**: 판정 창 계산 준비 완료.

---

## Phase 3: User Story 1 - 완주 벌크 판정 (Priority: P1) 🎯 MVP

**Goal**: 리더가 정규 스터디 참여자를 완주/미완주로 일괄 판정하면 글 `COMPLETED`, 리더 `leader_count + 1`, 완주 멤버 `completed_count + 1`이 단일 트랜잭션으로 반영된다.

**Independent Test**: 판정 창 안 `CLOSED` 정규 스터디에 멤버 2명 중 1명만 완주 판정 → 글 `COMPLETED`, 완주 멤버 +1, 미완주 멤버 불변, 리더 `leader_count` +1.

### Tests for User Story 1 (Red 먼저) ⚠️

- [X] T004 [US1] `tests/posts-complete.test.ts` 작성 후 실패 확인. 공통 픽스처: `gs_leader`가 STUDY 개설, `gs_member`·`seoul_member` 참여, `end_date`를 2026-10-31 23:59:59.999 KST로 고정, `now` = 2026-10-20 KST. 케이스:
  - TC-COMPLETE-01: 1명 완주·1명 미완주 판정(`proofUrl` 없음) → 글 `status='COMPLETED'`, `proofUrl` null, `gs_member.completed_count` +1, `seoul_member.completed_count` 불변, 리더 `leader_count` +1·`completed_count` 불변, 참여자 상태 `COMPLETED`/`INCOMPLETE`, 리더 참여 행 `COMPLETED`. 응답 `{ id, status:'COMPLETED', completedCount:1, incompleteCount:1 }`.
  - TC-COMPLETE-01(증빙): `proofUrl: 'https://github.com/x'` 저장 확인.
  - TC-COMPLETE-02: 판정 후 `joinPost`→`CLOSED`, `cancelPost`→`BAD_REQUEST`, `updatePost`→`BAD_REQUEST`, `toggleStatus`→`BAD_REQUEST`, 재판정→`BAD_REQUEST`.
  - TC-LEADER-01: `gs_member`가 판정 → `FORBIDDEN`.
  - 판정 창: `now` = 2026-10-14 23:59:59 KST → `BAD_REQUEST`, 2026-10-15 00:00 KST → 성공, 2026-11-10 23:59:59 KST → 성공, 2026-11-11 00:00 KST → `BAD_REQUEST`.
  - 목록 불일치 → `BAD_REQUEST` 4종: 참여자 누락, 같은 userId 중복, 비참여자 포함, 리더 포함. 실패 후 카운트·상태 불변 확인.
  - 완주 0명(전원 미완주) → `BAD_REQUEST`.
  - `PARTY` 글 판정 → `BAD_REQUEST`. `CANCELLED` 글 판정 → `BAD_REQUEST`. 없는 글 → `NOT_FOUND`.
  - 동시 판정: `createRacePool`로 실제 커밋 픽스처 생성 → 같은 글에 판정 2건 `Promise.allSettled` → 정확히 1건 성공·1건 `BAD_REQUEST`, 리더 `leader_count`와 완주 멤버 `completed_count`가 각각 정확히 +1. 테스트 종료 시 생성한 글 delete 및 두 유저 카운트를 테스트 전 값으로 되돌린다(공용 DB).
- [X] T005 [P] [US1] `tests/api/posts-complete.test.ts` 작성 후 실패 확인: Route Handler 레벨에서 비로그인 → 403, Zod 실패(`evaluations` 빈 배열, `userId` 비 uuid, `proofUrl: 'http://x'`) → 400. (기존 `tests/api/mock-auth.test.ts`의 Request 생성 방식 답습)

### Implementation for User Story 1

- [X] T006 [P] [US1] `src/lib/validation.ts`에 `completePostSchema` 추가: `evaluations: z.array(z.object({ userId: z.string().uuid(), isCompleted: z.boolean() })).min(1)`, `proofUrl: referenceUrlSchema.optional()`(기존 `https://` 검증 재사용).
- [X] T007 [US1] `src/lib/posts.ts`에 `completePost(postId, leaderId, evaluations, proofUrl, database = defaultDb, now = new Date())` 구현. `database.transaction` 안에서 contracts/posts-complete.md "서버 처리" 1~8단계 순서 그대로: `.for('update')` 잠금 → `NOT_FOUND` → 비리더 `FORBIDDEN` → `type !== 'STUDY'` `BAD_REQUEST` → `status`가 `RECRUITING`/`CLOSED` 아님 `BAD_REQUEST` → `postmortemText` 있음 `BAD_REQUEST` → `computeVerdictWindow(post.endDate)` 밖 `BAD_REQUEST` → 리더 제외 `JOINED` 참여자 집합과 `evaluations` userId 집합 정확 일치(중복·누락·추가·리더 포함 거부)·완주 ≥1 확인 → 참여자 상태 갱신(리더 행 `COMPLETED`) → 완주 멤버 `completedCount + 1`(sql 증분) → 리더 `leaderCount + 1` → 글 `status:'COMPLETED'`, `proofUrl: proofUrl ?? null`, `updatedAt: now`. 반환 `{ id, status, completedCount, incompleteCount }`. (T003, T006 의존)
- [X] T008 [US1] `src/app/api/posts/[id]/complete/route.ts` POST: `getCurrentUser()`(null → `FORBIDDEN`) → body `completePostSchema` 파싱(실패 → `BAD_REQUEST`) → `completePost` → 200. 에러는 `toErrorResponse`. 기존 `src/app/api/posts/[id]/cancel/route.ts` 구조 답습. (T007 의존)

**Checkpoint**: T004·T005 Green. 완주 판정 MVP 완료.

---

## Phase 4: User Story 2 - Post-mortem 실패 회고 등록 (Priority: P2)

**Goal**: 리더가 정규 스터디에 실패 회고를 기록한다. 상태·카운트는 불변.

**Independent Test**: 판정 창 시작 후 `CLOSED` 정규 스터디에 회고 등록 → `postmortem_text` 저장, 상태 `CLOSED` 유지, 카운트 불변.

### Tests for User Story 2 (Red 먼저) ⚠️

- [X] T009 [US2] `tests/posts-postmortem.test.ts` 작성 후 실패 확인. US1과 같은 픽스처(`end_date` 2026-10-31 KST, `now` 2026-10-20 KST). 케이스:
  - FR-009: 회고 등록 → `postmortemText` 저장, `status` 기존값(`RECRUITING` 또는 `CLOSED`) 유지, 리더·멤버 `completed_count`/`leader_count` 불변.
  - 덮어쓰기: 두 번째 등록 → 새 내용으로 교체.
  - 배타성: 회고 후 `completePost` → `BAD_REQUEST`. `COMPLETED` 글에 회고 → `BAD_REQUEST`. `CANCELLED` 글에 회고 → `BAD_REQUEST`.
  - 창 시작 전(`now` = 2026-10-14 KST) → `BAD_REQUEST`. 창 종료 후(`now` = 2026-12-01 KST) → 성공(종료 기한 없음).
  - `PARTY` 글 → `BAD_REQUEST`. 비리더 → `FORBIDDEN`(TC-LEADER-01). 없는 글 → `NOT_FOUND`.
- [X] T010 [P] [US2] `tests/api/posts-postmortem.test.ts` 작성 후 실패 확인: 비로그인 → 403, Zod 실패(공백만 `'   '`, 1001자) → 400.

### Implementation for User Story 2

- [X] T011 [US2] `src/lib/validation.ts`에 `postmortemSchema` 추가: `text: z.string().trim().min(1).max(1000)` (공백 제외 1~1000자). (T006과 같은 파일 — T006 완료 후)
- [X] T012 [US2] `src/lib/posts.ts`에 `postmortemPost(postId, leaderId, text, database = defaultDb, now = new Date())` 구현. 트랜잭션 + `.for('update')` → `NOT_FOUND` → 비리더 `FORBIDDEN` → `type !== 'STUDY'` `BAD_REQUEST` → `status`가 `COMPLETED`/`CANCELLED` `BAD_REQUEST` → `now < computeVerdictWindow(post.endDate).opensAt` `BAD_REQUEST` → `postmortemText`·`updatedAt: now`만 갱신. 반환 `{ id, status, postmortemText }`. (T003, T007 의존 — 같은 파일)
- [X] T013 [US2] `src/app/api/posts/[id]/postmortem/route.ts` POST: 인증 → `postmortemSchema` 파싱 → `postmortemPost` → 200. (T012 의존)

**Checkpoint**: T009·T010 Green.

---

## Phase 5: User Story 3 - 템플릿 프리셋 특화 데이터 (Priority: P2)

**Goal**: 정규 스터디 개설 시 6종 템플릿과 특화 데이터를 받아 템플릿 규칙으로 검증·저장하고, 템플릿 목록을 조회한다.

**Independent Test**: `book` 템플릿 + `bookTitle`로 개설 → 저장. `bookTitle` 누락·미등록 ID → 400.

### Tests for User Story 3 (Red 먼저) ⚠️

- [X] T014 [P] [US3] `tests/templates.test.ts` 작성 후 실패 확인. 케이스:
  - 등록부: `templateRegistry`에 `coding-test`/`mogakco`/`book`/`duolingo`/`music`/`free` 6종 존재.
  - `resolveTemplate` 단위: 템플릿 없음+데이터 없음 → `{ templateId:null, templateData:null, proofType:null }`. `templateData`만 → `BAD_REQUEST`. `PARTY`+`templateId` → `BAD_REQUEST`. 미등록 ID → `BAD_REQUEST`. `free`+`{ a:1 }` → `BAD_REQUEST`. `free`+데이터 없음 → 통과(`proofType:'link'`).
  - 템플릿별 통과/위반 (data-model.md 표 그대로): `book` `bookTitle` 누락 → 400, `bookTitle` 61자 → 400, `{ bookTitle:'클린 코드', totalPages:584 }` 통과(`proofType:'notion'`). `duolingo` `language` 누락 → 400. `coding-test` `platform:'CODEFORCES'` → 400, `weeklyGoal:51` → 400. `mogakco` `weeklySessions:8` → 400. `music` `weeklyAlbums:0` → 400. 미정의 항목(`{ bookTitle:'x', foo:1 }`) → 400(strict).
  - `createPost` 통합(withRollback): `book` 템플릿 개설 → DB `templateId:'book'`, `templateData` 원본 그대로, `proofType:'notion'`. 템플릿 없는 기존 개설은 Phase 1과 동일.
  - `getPostDetail` 응답에 `templateData` 포함.

### Implementation for User Story 3

- [X] T015 [US3] `src/templates/registry.ts`에 6종 프리셋 등록. data-model.md "Template" 표 그대로: `id`·`title`·`defaultTags`·`defaultProofType`·`dataSchema`(전부 `z.object({...}).strict()`). 필드 제약 그대로:
  - `coding-test`: `platform?: z.enum(['BOJ','PROGRAMMERS','LEETCODE','OTHER'])`, `weeklyGoal?: int 1~50`, `defaultProofType:'github'`
  - `mogakco`: `weeklySessions?: int 1~7`, `timeSlot?: string ≤20`, `'github'`
  - `book`: `bookTitle: string 1~60`(필수), `totalPages?: int 1~5000`, `'notion'`
  - `duolingo`: `language: string 1~20`(필수), `dailyXp?: int 1~1000`, `'screenshot'`
  - `music`: `genre?: string ≤20`, `weeklyAlbums?: int 1~20`, `'notion'`
  - `free`: `dataSchema` 없음, `defaultTags: []`, `'link'`
  - 각 `description`은 한국어 1~2문장. 등록 순서 = 위 순서. 파일 상단 주석의 "Phase 1에서 등록한다"를 "Phase 2 A에서 등록"으로 정정.
- [X] T016 [US3] `src/lib/templates.ts` 신규: `resolveTemplate(type, templateId, templateData)` 구현(research R6 순서 1~5) → `{ templateId, templateData, proofType }` 반환, 위반 시 `AppError('BAD_REQUEST')`. `listTemplates()`는 `{ id, title, description, defaultTags }[]`만 반환(`dataSchema`·`CustomFormField` 제외). (T015 의존)
- [X] T017 [US3] `src/lib/validation.ts` `createPostSchema`에 `templateData: z.record(z.unknown()).optional()` 추가(형태만, 내용 검증은 T016). `src/lib/posts.ts` `NewPostInput`에 `templateData?: Record<string, unknown> | null` 추가, `createPost`가 insert 전에 `resolveTemplate` 호출해 `templateId`/`templateData`/`proofType` 저장. `getPostDetail` 응답에 `templateData` 추가. (T016, T012 의존 — 같은 파일)
- [X] T018 [US3] `src/app/api/templates/route.ts` GET: 인증(null → `FORBIDDEN`) → `listTemplates()` → 200. (T016 의존)

**Checkpoint**: T014 Green. Phase 1 `tests/posts-create.test.ts` 회귀 없음.

---

## Phase 6: User Story 4 - 명예의 전당 & 성실 멤버 랭킹 (Priority: P2)

**Goal**: 완주한 정규 스터디·회고 목록과 성실 멤버 TOP 5를 조회한다. 쓰기 없음.

**Independent Test**: 완주 1·회고 1·취소 1 글 → 명예의 전당엔 완주만, Post-mortem엔 회고만. 유저 6명 → 랭킹 규칙대로 5명.

### Tests for User Story 4 (Red 먼저) ⚠️

- [X] T019 [P] [US4] `tests/hall-of-fame.test.ts` 작성 후 실패 확인(withRollback, US1 픽스처 + `completePost`/`postmortemPost`/`cancelPost`로 상태 구성). 케이스:
  - `listHallOfFame('completed')`: 완주 STUDY만 포함, 회고 글·취소 글·`PARTY`·미판정 글 미포함. 항목에 `title`·`templateId`·`endDate`·`proofUrl`·`leader{intraId,campus}`·`completedMembers`(리더 제외, `COMPLETED` 멤버만)·`completedAt`. `chatUrl` 키 없음.
  - `listHallOfFame('postmortem')`: 회고 STUDY만, `postmortemText`·`writtenAt` 포함, `chatUrl` 키 없음.
  - 정렬 `updated_at DESC`: 나중에 판정한 글이 앞.
- [X] T020 [P] [US4] `tests/leaderboard.test.ts` 작성 후 실패 확인(withRollback, `users` 6명 직접 insert, `completed_count` 1,000,000 이상으로 상위 점유). 케이스:
  - 정렬: `completed_count DESC` → 동률이면 `leader_count DESC` → 동률이면 `intra_id ASC`.
  - 정확히 5명, `rank` 1~5 연속.
  - 두 값 모두 0인 유저 미포함(별도 쿼리로 해당 유저 미포함 확인).
  - 항목 필드 `{ rank, intraId, campus, completedCount, leaderCount }`만, `avatarUrl` 없음.
- [X] T021 [P] [US4] `tests/api/hall-of-fame.test.ts` 작성 후 실패 확인: `/api/hall-of-fame`·`/api/leaderboard` 비로그인 → 403, `?kind=foo` → 400.

### Implementation for User Story 4

- [X] T022 [US4] `src/lib/posts.ts`에 `listHallOfFame(kind: 'completed' | 'postmortem', database = defaultDb)` 구현(research R7): `completed` = `type='STUDY' AND status='COMPLETED'`, `postmortem` = `type='STUDY' AND postmortem_text IS NOT NULL AND status <> 'CANCELLED'`, `ORDER BY updated_at DESC`. 리더·완주 멤버는 기존 `publicUser` 헬퍼로 `{intraId,campus}`만. `chatUrl` 미포함. (T017 의존 — 같은 파일)
- [X] T023 [US4] `src/lib/posts.ts`에 `getLeaderboard(database = defaultDb)` 구현(research R8): `users` where `completed_count > 0 OR leader_count > 0`, `ORDER BY completed_count DESC, leader_count DESC, intra_id ASC LIMIT 5`, 결과에 `rank` 1~5 부여. (T022 의존 — 같은 파일)
- [X] T024 [P] [US4] `src/app/api/hall-of-fame/route.ts` GET: 인증 → `kind` 쿼리 `z.enum(['completed','postmortem']).default('completed')` 파싱(실패 → `BAD_REQUEST`) → `listHallOfFame` → 200. (T022 의존)
- [X] T025 [P] [US4] `src/app/api/leaderboard/route.ts` GET: 인증 → `getLeaderboard` → 200. (T023 의존)

**Checkpoint**: T019~T021 Green.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T026 [P] 커버리지 확인: `pnpm test -- --coverage`로 완주 판정·상태 머신·권한 로직 90% 이상(NFR-006), 미달 시 테스트 보강.
- [X] T027 [P] `pnpm lint && pnpm typecheck && pnpm drizzle-kit check` 통과 확인.
- [X] T028 `specs/003-completion-lifecycle/quickstart.md` 수동 검증(curl) 실행. 수동 검증 글은 마지막에 `/cancel`로 정리.

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup(T001) → Foundational(T002–T003) → US1 → US2 → US3 → US4 → Polish.
- `src/lib/posts.ts`를 US1(T007)·US2(T012)·US3(T017)·US4(T022·T023)가 공유하므로 이 태스크들은 순차.
- `src/lib/validation.ts`를 T006·T011·T017이 공유하므로 순차.

### User Story Dependencies
- **US1 (P1)**: Foundational 이후. 독립 MVP.
- **US2 (P2)**: Foundational 이후. 배타성 테스트에 `completePost`(US1)가 필요.
- **US3 (P2)**: 기능상 독립. 파일 공유로 US2 이후 순차.
- **US4 (P2)**: 테스트 픽스처에 `completePost`·`postmortemPost`(US1·US2) 필요.

### Parallel Opportunities
- 각 스토리의 Route Handler 레벨 테스트(T005, T010, T021)는 서비스 테스트와 다른 파일이라 병렬 작성 가능.
- US3 테스트(T014)·US4 테스트(T019, T020)는 서로 다른 파일이라 US1 완료 후 병렬 작성 가능.
- T024·T025는 서로 다른 Route 파일이라 병렬.

## Parallel Example: User Story 4

```bash
# 테스트 병렬 작성
Task: "T019 tests/hall-of-fame.test.ts"
Task: "T020 tests/leaderboard.test.ts"
Task: "T021 tests/api/hall-of-fame.test.ts"
# 서비스 구현 후 Route 병렬
Task: "T024 src/app/api/hall-of-fame/route.ts"
Task: "T025 src/app/api/leaderboard/route.ts"
```

## Implementation Strategy

### MVP First (User Story 1)
1. T001 → T002–T003 (판정 창).
2. T004–T008 (완주 판정). **STOP & VALIDATE**: TC-COMPLETE-01/02, 동시 판정 1회 가산.

### Incremental Delivery
- US1 → US2(회고) → US3(템플릿) → US4(조회). 각 체크포인트에서 `pnpm test` 전체 Green 유지(Phase 1 회귀 포함).
