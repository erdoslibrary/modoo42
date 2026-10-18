---
description: "Task list for LIVE 핑 & CLI 조회 (Phase 2 B)"
---

# Tasks: LIVE 핑 & CLI 조회 (Phase 2 B)

**Input**: Design documents from `/specs/004-live-ping-cli/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 포함(강제). 헌법 I(NON-NEGOTIABLE): 일일 제한·조기 완료 권한·LIVE 차단 가드·Lazy Filter는 TDD(Red→Green→Refactor)로 구현한다. `describe`/`it`에 requirement §3 Test Suite 4의 TC ID(`TC-LIVE-01`~`04`, `TC-CLI-01`)를 그대로 쓴다.

**Organization**: 유저 스토리별로 묶는다. 서비스 로직은 `src/lib/posts.ts` 한 파일을 공유하므로, 스토리가 달라도 이 파일을 고치는 태스크는 순차로 진행한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일이고 미완료 선행 태스크가 없어 병렬 가능
- **[Story]**: US1~US3 (spec.md 매핑)

## Path Conventions

Next.js 단일 앱. `src/`, `tests/`는 리포 루트에 있다. 구조는 plan.md를 따른다. 테스트 DB 헬퍼는 `tests/setup/db.ts`(`withRollback`, `createRacePool`), 페르소나 유저는 `resolvePersonaUser(persona, tx)`(`src/lib/auth.ts`)를 쓴다. Route 테스트는 `tests/api/posts-complete.test.ts`의 `vi.hoisted` + `vi.mock('@/lib/auth')`·`vi.mock('@/lib/posts')` 패턴을 따른다.

## 테스트 작성 공통 규칙

- **시각 주입**: `createLivePing`·`listPosts`·`listForCli`는 마지막 인자로 `now`를 받는다. 롤백 테스트는 `now`를 먼 미래(예: `2030-01-15T03:00:00Z`)로 둔다. 그래야 공용 DB에 오늘 이미 있는 페르소나 핑과 겹치지 않는다. 시스템 시계는 건드리지 않는다.
- **동시성 테스트**: `createRacePool`로 실제 커밋한다. 공용 DB이므로 `race_live_${Date.now()}` 고유 유저를 새로 만든다. `finally`에서 그 유저의 `posts`를 먼저 지우고(`leader_id`는 `onDelete: restrict`) 그다음 유저를 지운다. 마지막에 `pool.client.end()`를 호출한다.
- **목록 단언**: 공용 DB에 다른 글이 섞여 있다. 목록 테스트는 개수가 아니라 테스트가 만든 `id`의 포함·불포함으로 단언한다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 신규 의존성·마이그레이션 없음. 기존 자산만 점검한다.

- [ ] T001 기존 자산 점검: `src/db/schema.ts`의 `posts.expiresAt`, `posts_live_ping_idx`, nullable `maxMembers`/`chatUrl`, `postTypeEnum`의 `'LIVE'` 존재를 확인한다. `pnpm drizzle-kit check`가 통과하는지 확인한다(스키마 변경 없음). `pnpm test`가 현재 Green인지 확인해 회귀 기준선을 잡는다.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1·US3가 공유하는 KST 날짜 경계 계산과 Lazy Filter. 이후 모든 스토리의 선행 조건이다.

**⚠️ CRITICAL**: US1~US3 구현 전에 완료한다.

- [ ] T002 `tests/lib/end-date.test.ts`에 `kstDayRange` 테스트를 추가하고 실패를 확인한다(Red).
  - `now` = 2026-10-18T14:59:59.999Z(KST 23:59:59.999) → `start` = 2026-10-17T15:00:00.000Z, `end` = 2026-10-18T15:00:00.000Z
  - `now` = 2026-10-18T15:00:00.000Z(KST 다음날 00:00) → `start` = 2026-10-18T15:00:00.000Z
  - 연말 경계: `now` = 2026-12-31T15:30:00Z(KST 2027-01-01 00:30) → `start` = 2026-12-31T15:00:00Z
- [ ] T003 `src/lib/end-date.ts`에 `kstDayRange(now: Date): { start: Date; end: Date }`를 구현한다(Green, research R2). 기존 `KST_OFFSET_MS` 벽시계 환산 방식을 재사용한다. `start`는 해당 KST 날짜 00:00:00.000, `end`는 `start + 24h`(배타)다. (T002 의존)
- [ ] T004 `tests/posts-list.test.ts`(신규)에 Lazy Filter 테스트를 작성하고 실패를 확인한다(Red, TC-LIVE-04). 픽스처는 `withRollback` 안에서 `tx.insert(posts)`로 LIVE 행 3개를 직접 넣는다(`createLivePing`은 아직 없음). 행 구성: `type 'LIVE'`, `title`, `place`, `tags: []`, `locationType 'OFFLINE_GS'`, `maxMembers null`, `chatUrl null`.
  - (a) `RECRUITING` + `expiresAt = now + 10분` → `listPosts({}, tx, now)`·`listPosts({ type: 'LIVE' }, tx, now)` 결과에 포함되고, 항목의 `expiresAt`이 채워져 있다.
  - (b) `RECRUITING` + `expiresAt = now - 1분` → 제외된다. 행의 `status`는 여전히 `RECRUITING`이다.
  - (c) `CLOSED` + `expiresAt = now + 10분` → 제외된다. `listPosts({ status: 'CLOSED' }, tx, now)`에서도 제외된다.
  - 같은 트랜잭션에서 만든 `RECRUITING` STUDY 글은 `listPosts({}, tx, now)`에 여전히 포함되고, `expiresAt`이 `null`이다(회귀 방지).
- [ ] T005 `src/lib/posts.ts` `listPosts`를 수정한다(Green, research R8). 대상: `ListFilter.type`에 `'LIVE'` 추가, 시그니처 `listPosts(filter, database = defaultDb, now: Date = new Date())`. WHERE에 항상 `or(ne(posts.type, 'LIVE'), and(eq(posts.status, 'RECRUITING'), gt(posts.expiresAt, now)))`를 추가한다. select·응답 매핑에 `expiresAt`을 추가한다. `chatUrl`은 응답에 넣지 않는 기존 규칙을 유지한다. (T004 의존)
- [ ] T006 `src/lib/posts.ts` `getPostDetail` 응답 `base`에 `expiresAt: post.expiresAt`을 추가한다. `tests/posts-detail.test.ts`에 STUDY 상세의 `expiresAt === null` 단언을 한 줄 추가한다. (T005 의존, 같은 파일)

**Checkpoint**: T002·T004 Green, 기존 스위트 회귀 없음.

---

## Phase 3: User Story 1 - LIVE 핑 등록 (Priority: P1) 🎯 MVP

**Goal**: 로그인 유저가 내용·위치·유효시간으로 LIVE 핑을 올리고, KST 하루 1회로 제한된다. 핑은 활성 목록에 노출된다.

**Independent Test**: 생성 → `listPosts({ type: 'LIVE' })`에 포함. 같은 KST 날짜 두 번째 생성 → 400. 동시 생성 10건 → 1건만 성공.

### Tests for User Story 1 (Red 먼저) ⚠️

- [ ] T007 [US1] `tests/posts-live.test.ts`(신규)에 `describe('LIVE 핑 (Test Suite 4)')`를 만들고 생성 테스트를 작성한 뒤 실패를 확인한다. `now` 주입은 공통 규칙대로 한다.
  - `TC-LIVE-01` 정상: `createLivePing({ text: 'philosopher 데드락 헬프', place: '클러스터 2층', durationMinutes: 60 }, gsLeader.id, tx, now)`. 저장 행 기대값:
    - `type 'LIVE'`, `status 'RECRUITING'`, `title === text`
    - `expiresAt = now + 60분`, `createdAt = now`
    - `maxMembers null`, `chatUrl null`, `referenceUrl null`, `description null`, `templateId null`, `tags []`
    - `locationType`: `gs_leader`는 `'OFFLINE_GS'`, `seoul_member`는 `'OFFLINE_SEOUL'`(research R4)
    - 해당 글의 `participants` 행 0개(R5)
    - 반환값: `{ id, status: 'RECRUITING', expiresAt }`
  - `TC-LIVE-01` 유효시간: `durationMinutes` 30/60/120/180 각각 `expiresAt` 계산이 맞는지 `it.each`로 확인한다. 날짜가 겹치지 않도록 케이스마다 `now`를 하루씩 다르게 한다.
  - `TC-LIVE-02` 같은 날 2회: 같은 유저, 같은 KST 날짜의 `now`, `now + 1h`로 두 번 생성 → 두 번째가 `AppError` `BAD_REQUEST`를 던진다.
  - `TC-LIVE-02` 완료·만료도 카운트: 첫 핑을 `tx.update`로 `CLOSED`로 바꾸거나 `expiresAt`을 과거로 바꾼 뒤 같은 날 재생성 → `BAD_REQUEST`.
  - `TC-LIVE-02` KST 경계: `now` = KST 23:59에 생성 후 `now` = 다음날 KST 00:00에 생성 → 성공.
  - 스터디 생성은 세지 않음: 같은 날 `createPost`(STUDY)를 먼저 한 유저도 LIVE 1건은 성공한다.
- [ ] T008 [US1] `tests/posts-live.test.ts`에 `TC-LIVE-02` 동시 생성 테스트를 추가한다. `createRacePool(10)` + 신규 유저 1명(campus `'GS'`)으로 `Promise.allSettled`로 `createLivePing` 10건을 동시 호출한다. 기대: fulfilled 1건, rejected 9건 모두 `AppError` `BAD_REQUEST`, DB의 해당 유저 LIVE 행 1개. 정리는 공통 규칙대로 한다. (T007과 같은 파일, 순차)
- [ ] T009 [P] [US1] `tests/lib/validation.test.ts`(없으면 신규)에 `createPostRequestSchema` 테스트를 작성한다.
  - LIVE 통과: `{ type: 'LIVE', text: 'a'.repeat(50), place: 'x', durationMinutes: 30 }`
  - LIVE 실패:
    - `text` 51자, `text` 빈 문자열
    - `place` 누락, `place` 빈 문자열
    - `durationMinutes` 45, `durationMinutes` `'30'`(문자열)
    - LIVE에 `chatUrl`·`maxMembers`·`title` 같은 추가 키 포함(strict)
  - 회귀: 기존 STUDY 유효 입력은 여전히 통과하고, `type: 'LIVE'`에 STUDY 필드만 보내면 실패한다.
- [ ] T010 [P] [US1] `tests/api/posts-create-live.test.ts`(신규)에서 `POST /api/posts` 라우트를 테스트한다. `@/lib/auth`·`@/lib/posts`를 mock한다.
  - 비로그인 → 403, 서비스 미호출
  - LIVE 51자 → 400, `createLivePing` 미호출
  - 유효한 LIVE → `createLivePing(data, user.id)` 호출 + 201
  - 유효한 STUDY → `createPost` 호출 + `createLivePing` 미호출

### Implementation for User Story 1

- [ ] T011 [US1] `src/lib/validation.ts`를 수정한다(Green for T009).
  - 신규 `createLivePingSchema = z.object({ type: z.literal('LIVE'), text: z.string().min(1).max(50), place: z.string().min(1), durationMinutes: z.union([z.literal(30), z.literal(60), z.literal(120), z.literal(180)]) }).strict()`
  - `createPostRequestSchema = z.discriminatedUnion('type', [createPostSchema, createLivePingSchema])`
  - 기존 `createPostSchema`의 `type: z.enum(['STUDY','PARTY'])`는 유지한다(판별 유니온의 STUDY/PARTY 분기).
  - 타입 `CreateLivePingInput`을 export한다.
  - 주석에 "LIVE `text` 최대 50자, `duration` 30분/1시간/2시간/3시간 (CLAUDE.md §7.1)"을 남긴다.
- [ ] T012 [US1] `src/lib/posts.ts`에 `createLivePing(input: { text: string; place: string; durationMinutes: 30 | 60 | 120 | 180 }, userId: string, database = defaultDb, now: Date = new Date()): Promise<{ id: string; status: string; expiresAt: Date }>`를 구현한다(Green for T007·T008, research R1~R5).
  1. `database.transaction` 안에서 `tx.select({ id: users.id, campus: users.campus }).from(users).where(eq(users.id, userId)).for('update')`로 작성자 행을 잠근다.
  2. `kstDayRange(now)`로 `start`/`end`를 구한다. `count(*)`를 `posts where leaderId = userId AND type = 'LIVE' AND createdAt >= start AND createdAt < end` 조건으로 센다. 1 이상이면 `AppError('BAD_REQUEST', 'LIVE 핑은 하루에 한 번만 올릴 수 있습니다.')`를 던진다.
  3. `posts` insert: `{ leaderId: userId, type: 'LIVE', title: input.text, place: input.place, tags: [], locationType: campus === 'GS' ? 'OFFLINE_GS' : 'OFFLINE_SEOUL', maxMembers: null, chatUrl: null, expiresAt: new Date(now.getTime() + durationMinutes * 60_000), createdAt: now, updatedAt: now, status: 'RECRUITING' }`. `participants` insert는 하지 않는다.

  (T005·T006 이후, 같은 파일)
- [ ] T013 [US1] `src/app/api/posts/route.ts`를 수정한다(Green for T010).
  - POST는 `createPostRequestSchema.safeParse`를 쓴다. 결과가 `type === 'LIVE'`면 `createLivePing(parsed.data, user.id)`를 호출하고, 아니면 기존 `createPost`를 호출한다. 둘 다 201.
  - GET의 `type` 파싱에 `'LIVE'`를 허용한다.

**Checkpoint**: T007~T010 Green. US1 단독으로 시연 가능(생성 → 목록 → 같은 날 재생성 400).

---

## Phase 4: User Story 2 - LIVE 핑 조기 완료 (Priority: P2)

**Goal**: 작성자가 자기 핑을 `CLOSED`로 내린다. LIVE 핑에는 다른 쓰기 동작(참여·토글·수정·취소)이 막혀 재모집이 불가능하다.

**Independent Test**: 작성자 완료 → `CLOSED` + `listPosts`에서 제외. 타인 완료 → 403. `CLOSED` 핑 재모집 토글 → 400.

### Tests for User Story 2 (Red 먼저) ⚠️

- [ ] T014 [US2] `tests/posts-live.test.ts`에 조기 완료 테스트를 추가하고 실패를 확인한다. 픽스처는 `createLivePing`(US1)으로 만든다.
  - `TC-LIVE-03`: 작성자 `completeLivePing(id, leader.id, tx)` → `{ id, status: 'CLOSED' }` 반환. 행의 `status === 'CLOSED'`. `listPosts({ type: 'LIVE' }, tx, now)`에서 제외된다.
  - `TC-LIVE-03`: `gs_member`가 완료 시도 → `FORBIDDEN`. 행은 `RECRUITING` 그대로다.
  - 멱등: 이미 `CLOSED`인 핑을 작성자가 재호출 → 예외 없이 `{ status: 'CLOSED' }`.
  - 만료 후 완료: `expiresAt`을 과거로 바꾼 `RECRUITING` 핑 → `CLOSED` 전이.
  - STUDY 글에 `completeLivePing` 호출 → `BAD_REQUEST`. 리더 본인이 호출해도 같다.
  - 없는 uuid → `NOT_FOUND`.
- [ ] T015 [US2] `tests/posts-live.test.ts`에 LIVE 쓰기 차단 테스트를 추가한다(research R6). 활성 LIVE 핑에 대해:
  - `joinPost(id, gsMember.id, tx)` → `BAD_REQUEST`
  - 작성자 `updatePost(id, leader.id, { title: 'x' }, tx)` → `BAD_REQUEST`
  - 작성자 `cancelPost(id, leader.id, '사유', tx)` → `BAD_REQUEST`
  - 작성자 `toggleStatus(id, leader.id, 'CLOSED', tx)` → `BAD_REQUEST`
  - `CLOSED` 핑에 작성자 `toggleStatus(..., 'RECRUITING')` → `BAD_REQUEST`
  - 비작성자 `updatePost` → `BAD_REQUEST`(유형 검사가 권한 검사보다 먼저다)
  - 차단된 모든 호출 뒤 행의 `status`·`currentMembers`가 변하지 않았는지 확인한다.
- [ ] T016 [P] [US2] `tests/api/posts-complete-ping.test.ts`(신규)에서 `POST /api/posts/:id/complete-ping` 라우트를 테스트한다. `@/lib/auth`·`@/lib/posts`를 mock한다.
  - 비로그인 → 403, `completeLivePing` 미호출
  - 로그인 → `completeLivePing(params.id, user.id)` 호출 + 200, 본문 그대로 반환
  - 서비스가 `AppError('FORBIDDEN')`를 던지면 → 403

### Implementation for User Story 2

- [ ] T017 [US2] `src/lib/posts.ts`에 `completeLivePing(postId: string, userId: string, database = defaultDb): Promise<{ id: string; status: string }>`를 구현한다(research R7, contracts/posts-complete-ping.md 순서 그대로).
  1. 트랜잭션 + `posts` 행 `.for('update')`
  2. 행 없음 → `NOT_FOUND`
  3. `type !== 'LIVE'` → `BAD_REQUEST`('LIVE 핑만 완료할 수 있습니다.')
  4. `leaderId !== userId` → `FORBIDDEN`('작성자만 완료할 수 있습니다.')
  5. `status === 'CLOSED'` → `{ id, status }` 그대로 반환
  6. 아니면 `status: 'CLOSED', updatedAt: new Date()`로 갱신하고 반환

  (T012 이후, 같은 파일)
- [ ] T018 [US2] `src/lib/posts.ts`의 `joinPost`·`updatePost`·`cancelPost`·`toggleStatus`에 가드를 추가한다. 위치는 `NOT_FOUND` 검사 직후, 권한·상태 검사 전이다. 가드: `if (post.type === 'LIVE') throw new AppError('BAD_REQUEST', 'LIVE 핑에는 사용할 수 없는 동작입니다.')`. `completePost`·`postmortemPost`는 이미 `type !== 'STUDY'`로 막혀 있어 변경하지 않는다. (T017 이후, 같은 파일)
- [ ] T019 [P] [US2] `src/app/api/posts/[id]/complete-ping/route.ts`를 신규로 만든다. 처리: `getCurrentUser()` → 없으면 `AppError('FORBIDDEN', '로그인이 필요합니다.')` → `completeLivePing(params.id, user.id)` → `NextResponse.json(result)`. 에러는 `toErrorResponse`로 매핑한다. 파일 첫 줄 주석은 `// LIVE 핑 작성자의 조기 완료. contracts/posts-complete-ping.md.`로 쓴다. (T017 의존)

**Checkpoint**: T014~T016 Green, 기존 `posts-join`/`posts-update`/`posts-cancel`/`posts-status` 스위트 회귀 없음.

---

## Phase 5: User Story 3 - 터미널 CLI 조회 (Priority: P3)

**Goal**: 비로그인 `curl /api/list`로 모집 중 스터디·파티와 활성 LIVE 핑을 ANSI/평문/JSON으로 본다. `chat_url`은 절대 포함하지 않는다.

**Independent Test**: 쿠키 없이 `GET /api/list` → 200 텍스트에 섹션 3개가 있다. `?format=json`이면 같은 항목이 JSON으로 나온다. 본문에 `open.kakao.com`/`discord`가 0건이다.

### Tests for User Story 3 (Red 먼저) ⚠️

- [ ] T020 [P] [US3] `tests/lib/cli-format.test.ts`(신규)에 `renderCliText` 순수 함수 테스트를 작성한다. 입력은 고정 `CliData` 객체, `now` = `2026-10-18T05:00:00Z`(KST 14:00).
  - 헤더: `모두의 42 — 2026-10-18 14:00 KST`
  - 섹션 순서와 개수: `[LIVE 핑] n` → `[단기 파티] n` → `[정규 스터디] n`
  - 남은 시간:
    - `expiresAt = now + 28분` → `28분 남음`
    - `now + 72분` → `1시간 12분 남음`
    - `now + 30초` → `1분 남음`(올림)
  - D-Day: 파티 `endDate` = KST 10/21 → `D-3`, 당일 → `D-Day`
  - 항목 줄에 `title`, `@ place`, `(intraId·campus)`, 파티·스터디는 `n/m명`, `#tag`가 포함된다. `place`가 `null`이면 `@` 부분을 생략한다.
  - 빈 섹션은 `  (없음)`. 세 섹션이 모두 비면 `모집 중인 글이 없습니다.`
  - `color: false`면 출력에 `\x1b`가 0개다. `color: true`면 `\x1b[`가 존재하고 마지막이 `\x1b[0m`으로 끝난다.
  - 제어 문자 제거(research R11): `title`에 `'a\x1b]0;pwn\x07b\nc\x7f\x9bd'` → 출력에 `\x1b]`·`\x07`·`\x7f`·`\x9b`가 없고, 해당 항목이 한 줄로 유지된다(`abcd` 형태로 이어짐, 순서 보존). `place`·`intraId`·`tags`에도 적용한다.
- [ ] T021 [US3] `tests/posts-live.test.ts`에 `listForCli(tx, now)` 테스트를 추가한다(TC-CLI-01).
  - 픽스처: 활성 핑 2개(만료 시각이 다름), 만료 핑 1개, `CLOSED` 핑 1개, `RECRUITING` 파티 2개(`endDate`가 다름), `CLOSED` 파티 1개, `RECRUITING` 스터디 1개, `CANCELLED` 스터디 1개.
  - 단언(공용 DB이므로 테스트가 만든 `id` 기준):
    - `pings`에 활성 2개만 있고 `expiresAt` 오름차순이다.
    - `parties`에 `RECRUITING` 2개만 있고 `endDate` 오름차순이다.
    - `studies`에 `RECRUITING` 1개만 있다.
    - 어떤 항목에도 `chatUrl`·`description`·`referenceUrl`·`templateData` 키가 없다.
    - 각 항목에 `leader.intraId`·`place`가 있다.
- [ ] T022 [P] [US3] `tests/api/cli-list.test.ts`(신규)에서 `GET /api/list` 라우트를 테스트한다. `@/lib/posts`의 `listForCli`를 mock해 고정 데이터를 반환하게 하고, `@/lib/auth`도 mock한다.
  - 쿠키 없이 → 200. `getCurrentUser`가 호출되지 않아야 한다.
  - 기본(쿼리 없음) → `content-type`이 `text/plain; charset=utf-8`, 본문에 `\x1b[` 포함
  - `?format=plain` → 본문에 `\x1b` 없음
  - `?format=json` → `application/json`, `{ generatedAt, pings, parties, studies }`
  - `?format=xml` → 400
  - 모든 응답에 `cache-control: no-store`
  - mock 데이터에 일부러 `chatUrl`을 넣어도 응답에 `chatUrl`·`open.kakao.com`이 0건이다(라우트가 투영을 다시 거르는지 확인하는 방어 테스트)

### Implementation for User Story 3

- [ ] T023 [P] [US3] `src/lib/cli-format.ts`를 신규로 만든다(Green for T020, contracts/cli-list.md 형식 그대로).
  - export 목록: `type CliItem`, `type CliData = { pings: CliItem[]; parties: CliItem[]; studies: CliItem[] }`, `stripControl(s: string): string`, `renderCliText(data: CliData, opts: { color: boolean; now: Date }): string`
  - `stripControl` 정규식: `/[\u0000-\u001F\u007F-\u009F]/g`를 빈 문자열로 치환한다.
  - ANSI는 섹션 제목에 굵게(`\x1b[1m`), 남은 시간·D-Day에 녹색(`\x1b[32m`, 액센트 1색)만 쓰고, 출력 끝에 `\x1b[0m`을 붙인다.
  - KST 표기는 `src/lib/end-date.ts`의 KST 환산을 재사용한다. 필요하면 그 파일에 `toKstWall(date)` 헬퍼를 export로 추가한다.
  - DB import 금지(순수 모듈).
- [ ] T024 [US3] `src/lib/posts.ts`에 `listForCli(database = defaultDb, now: Date = new Date()): Promise<CliData>`를 구현한다(research R10).
  - 데이터: `listPosts({ type: 'LIVE' }, database, now)`, `listPosts({ type: 'PARTY', status: 'RECRUITING', sort: 'deadline' }, database, now)`, `listPosts({ type: 'STUDY', status: 'RECRUITING', sort: 'latest' }, database, now)`
  - 정렬: 핑은 결과를 `expiresAt` 오름차순으로 정렬한다.
  - 투영: 각 항목을 `CliItem` 필드(`id`, `title`, `place`, `tags`, `currentMembers`, `maxMembers`, `endDate`, `expiresAt`, `leader`)만 남기도록 투영한다.

  (T018 이후, 같은 파일. T023의 타입 의존)
- [ ] T025 [US3] `src/app/api/list/route.ts`를 신규로 만든다(Green for T022). 인증 코드는 없다.
  1. `format`을 `z.enum(['ansi','plain','json']).default('ansi')`로 파싱한다. 실패 → `AppError('BAD_REQUEST')`.
  2. `listForCli()`를 호출한 뒤, 각 항목을 다시 `CliItem` 필드로만 구성해 응답한다(방어적 투영).
  3. `json`은 `NextResponse.json({ generatedAt: now.toISOString(), ...data })`.
  4. `ansi`/`plain`은 `new Response(renderCliText(data, { color: format === 'ansi', now }), { headers: { 'content-type': 'text/plain; charset=utf-8' } })`.
  5. 모든 응답(에러 포함)에 `cache-control: no-store`를 붙인다.
  6. 파일 첫 줄 주석은 `// 터미널 CLI 조회 (비인증). contracts/cli-list.md.`로 쓴다.

  (T023·T024 의존)

**Checkpoint**: T020~T022 Green. `curl localhost:3000/api/list`로 수동 확인한다.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T026 [P] 커버리지 확인: `pnpm test -- --coverage`로 `createLivePing`·`completeLivePing`·LIVE 가드·`listPosts` Lazy Filter·`cli-format.ts`가 90% 이상인지 본다(NFR-006). 미달이면 테스트를 보강한다.
- [ ] T027 [P] `pnpm lint && pnpm typecheck && pnpm drizzle-kit check` 통과를 확인한다.
- [ ] T028 `specs/004-live-ping-cli/quickstart.md`의 수동 검증(curl)을 실행한다. 수동으로 만든 LIVE 핑은 마지막에 `complete-ping`으로 닫는다. 그래도 공용 DB에 행이 남으므로 확인 후 직접 삭제한다.
- [ ] T029 문서 정합성을 점검한다. `docs/trd.md` §4 표 `POST /api/posts` 행에 LIVE 요청 형식(`text`, `place`, `durationMinutes`) 한 줄을 보강한다. CLAUDE.md §7.1의 LIVE `duration` 표기와 Zod 값(`30|60|120|180`분)이 일치하는지 확인한다.

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup(T001) → Foundational(T002–T006) → US1(T007–T013) → US2(T014–T019) → US3(T020–T025) → Polish(T026–T029).
- `src/lib/posts.ts`는 T005·T006·T012·T017·T018·T024가 공유하므로 이 순서대로 순차 진행한다.
- `tests/posts-live.test.ts`는 T007·T008·T014·T015·T021이 공유하므로 순차 진행한다.

### User Story Dependencies

- **US1 (P1)**: Foundational 이후. 독립 MVP.
- **US2 (P2)**: 테스트 픽스처에 `createLivePing`(US1)이 필요하다.
- **US3 (P3)**: `listPosts` Lazy Filter(Foundational)에 의존한다. 픽스처는 직접 insert로 만들 수 있어 기능상 US1·US2와 독립이지만, `posts.ts` 공유 때문에 순차로 진행한다.

### Parallel Opportunities

- T009(validation 테스트)·T010(라우트 테스트)은 T007과 다른 파일이라 병렬로 작성할 수 있다.
- T016·T019는 서로 다른 라우트 파일이라 서비스 테스트와 병렬로 진행할 수 있다.
- T020·T023(`cli-format` 순수 모듈)은 DB와 무관해 Foundational 직후 언제든 병렬로 진행할 수 있다.
- T022는 `listForCli`를 mock하므로 T024보다 먼저 작성할 수 있다.

## Parallel Example: User Story 3

```bash
# 순수 렌더러는 DB 작업과 병렬
Task: "T020 tests/lib/cli-format.test.ts"
Task: "T022 tests/api/cli-list.test.ts"
Task: "T023 src/lib/cli-format.ts"
# 이후 순차
Task: "T021 → T024 (posts.ts) → T025 (route)"
```

## Implementation Strategy

### MVP First (User Story 1)

1. T001 → T002–T006 (KST 경계, Lazy Filter).
2. T007–T013 (LIVE 생성). **STOP & VALIDATE**: TC-LIVE-01, TC-LIVE-02(동시 포함), TC-LIVE-04.

### Incremental Delivery

- US1 → US2(조기 완료 + 쓰기 차단) → US3(CLI). 각 체크포인트에서 `pnpm test` 전체 Green을 유지한다(Phase 0~2 A 회귀 포함).
