# Phase 0 Research: 개발자 콘솔 (010)

설계 원본은 `docs/trd.md` §2.4이고 확정된 결정 9건의 근거는 `docs/next-steps.md` §4.0이다. 이 문서는 그 위에서 **구현 방식**을 정한다. `spec.md`에 `[NEEDS CLARIFICATION]`은 없었으므로 미해결 질문을 옮겨 오지 않았고, 아래는 전부 Phase 1 설계를 막고 있던 항목이다.

---

## R1. 도메인 함수의 기본값 제거 방식

**Decision**: `src/lib/posts.ts`의 함수에서 **`database`와 `now` 기본값을 모두 제거**한다. 인자 순서(`…, database, now`)는 유지하고, `createPost`는 `now`를 마지막 인자로 신설한다. `src/lib/leader-actions.ts`의 두 순수 함수는 `now` 기본값만 제거한다. `listHallOfFame` 오버로드의 `database?`도 필수로 바꾼다.

**Rationale**: TypeScript는 필수 인자가 선택 인자 뒤에 올 수 없다(TS1016). 현재 시그니처가 `database: Database = defaultDb, now: Date = new Date()`이므로 `now`만 필수로 만들 수 없다. 둘 다 필수로 바꾸는 쪽이 FR-013과도 맞는다 — 콘솔 세션에서 핸들을 빠뜨리면 **운영 테이블에 쓴다.** 시각 누락보다 비싼 실패이고 조용히 통과하는 방식이 같다. 호출부 약 217곳 중 테스트 15개 파일이 이미 `tx`를 넘기므로 실제 추가 작업은 `now` 보강이 대부분이고, `src/` 쪽 14곳은 어차피 `requestDatabase()`로 바꿔야 한다.

**Alternatives considered**:
- `now`를 `database` 앞으로 이동 — TS1016은 피하지만 기존 `, tx` 호출 전부가 인자 위치를 바꿔야 하고, 읽는 사람이 순서를 외워야 한다. 비용은 같은데 혼동만 늘어 기각.
- 옵션 객체(`{ database, now }`)로 전환 — 호출부 217곳을 전부 재작성. 이 작업 범위를 넘고 FR-024(응답 계약 불변)와 무관한 리스크를 끌어온다. 기각.
- `database` 기본값 유지 + `now`만 선택으로 두고 런타임에 던지기 — 주입 누락이 **타입 검사에서** 잡히지 않는다. FR-002의 목적 자체를 버리는 선택이라 기각.

---

## R2. 쿠키를 읽는 모듈의 경계

**Decision**: 쿠키를 읽는 모듈은 `src/lib/clock.ts`(오프셋), `src/lib/dev/console-session.ts`(콘솔 세션), `src/lib/dev/sandbox.ts`(핸들 선택) 3개로 닫는다. 도메인(`posts.ts`·`leader-actions.ts`)과 스냅샷 로직은 인자만 받는다. `clock.ts`와 `sandbox.ts`는 둘 다 `console-session.ts`의 판정 함수를 호출한다.

**Rationale**: `cookies()`는 요청 스코프 밖에서 던진다. 도메인이 읽으면 Vitest와 `FR-018` Cron이 깨진다(FR-005, `trd.md` §2.4-1). 반대로 호출부가 매번 쿠키를 파싱하면 게이트 판정이 흩어진다. Next.js는 같은 요청 안의 `cookies()` 호출을 캐시하므로 모듈 3개가 각자 읽어도 비용이 중복되지 않는다.

**Alternatives considered**: 요청 컨텍스트 1개 객체를 만들어 라우트 입구에서 조립해 내려보내기 — 라우트 14곳의 시그니처가 전부 바뀌고, RSC에서는 전달 경로가 길어진다. 모듈 3개가 각자 `cookies()`를 읽는 쪽이 짧다.

---

## R3. "라우트 미등록"의 실제 구현

**Decision**: Next.js App Router는 파일이 있으면 라우트가 항상 번들에 들어가므로, 게이트는 **핸들러 첫 줄의 404 반환**으로 구현한다. `DEV_CONSOLE_PASSWORD`가 비어 있으면 `/api/dev/*`와 `/api/mock-auth`가 `{ error: 'NOT_FOUND' }` + 404를 반환하고, `ConsoleEntry`·`DevConsole`는 서버에서 `null`을 반환한다.

**Rationale**: 기존 `/api/mock-auth`가 이미 같은 방식(`isMockAuthEnabled()` → 404)이므로 패턴이 맞고(`src/app/api/mock-auth/route.ts:7`), 조건식만 교체하면 된다. 404는 라우트 존재 자체를 숨긴다.

**Alternatives considered**: `middleware.ts`에서 경로 차단 — 게이트가 두 곳(미들웨어 + 핸들러)으로 늘어난다. FR-009의 "한 곳에서만"에 어긋나므로 기각.

---

## R4. 콘솔 세션 쿠키의 서명 키

**Decision**: `modoo42_dev_console`의 HMAC-SHA256 서명 키로 **`DEV_CONSOLE_PASSWORD` 자체**를 쓴다. 쿠키 포맷과 비교 방식(`timingSafeEqual`)은 `src/lib/session.ts`의 기존 서명 포맷을 재사용한다.

**Rationale**: 키를 하나 더 만들면 환경변수가 늘고 미설정 조합이 생긴다. 비밀번호를 바꾸면 발급된 콘솔 세션이 전부 무효가 되는데, 그것이 원하는 성질이다.

**Alternatives considered**: `GITHUB_CLIENT_SECRET` 재사용 — 로그인 세션과 콘솔 세션의 신뢰 경계가 섞인다. 콘솔 비밀번호를 교체해도 콘솔 세션이 살아남는 것도 틀린 성질이라 기각.

---

## R5. 시계 오프셋 쿠키는 서명하지 않는다

**Decision**: `modoo42_dev_clock`은 평문 정수 1개(`offsetMs`)로 둔다. 서명하지 않는다. 값 형식은 `^-?\d{1,15}$`이고, 파싱 실패·범위 초과는 **0으로 간주**하고 요청을 실패시키지 않는다.

**Rationale**: 오프셋은 유효한 콘솔 세션이 있을 때만 반영된다(FR-009). 콘솔 세션 보유자는 어차피 원하는 시각을 자유롭게 설정할 수 있으므로 위조해서 얻을 것이 없다. 게이트가 닫힌 환경에서는 쿠키를 읽지 않으므로 서명이 방어하는 대상이 존재하지 않는다.

**Alternatives considered**: 오프셋도 서명 — 코드가 늘지만 막는 것이 없다. 기각. 손상값에 400 응답 — 쿠키 하나 때문에 화면 전체가 죽는다. 기각.

---

## R6. 타임스탬프를 유효 시각으로 쓰는 지점

**Decision**: 아래 자리에 유효 시각(`now` 인자)을 명시 삽입한다. 컬럼 기본값(`defaultNow()`)은 그대로 두므로 **마이그레이션이 0건**이다.

| 대상 | 지점 |
| :--- | :--- |
| `posts.created_at` | `posts.ts:70`(createPost), `posts.ts:145`(createLivePing) |
| `participants.joined_at` | `posts.ts:92`(리더 자동 참여), `posts.ts:242`(참여) |
| `participants.joined_at` 갱신 | `posts.ts:239`(재참여) |
| 도메인 `posts.updated_at` | `posts.ts:187`·`444`·`478`·`507` |

실제 시각을 유지하는 자리는 `src/lib/session.ts`의 만료 검증과 `src/lib/auth.ts:44`·`75`(유저 생성)·`70`·`77`(로그인 시 갱신)뿐이다.

**Rationale**: 과거 사이클 스터디를 만들 수 없으면 아카이브·명예의 전당·`FR-018`을 검증할 수 없다(2026-10-19 승인). 도메인 `updated_at`을 같이 옮기는 이유는 판정이 유효 시각에 일어났으면 그 기록도 같은 시각이어야 읽는 사람이 헷갈리지 않기 때문이다. 인증 레코드를 제외하는 이유는 FR-006과 같다 — 미래 점프가 로그인 상태를 망가뜨리면 안 된다.

**Alternatives considered**: 전부 실제 시각 유지 — 가장 단순하지만 과거 아카이브를 만들 수 없어 이 기능의 목적 절반이 사라진다. 컬럼 기본값 제거 — 마이그레이션이 필요하고 시드·수동 INSERT가 깨진다. 둘 다 기각.

---

## R7. `dev_sandbox` 스키마 재생 방식

**Decision**: `pnpm sandbox:sync`(= `node scripts/sandbox-sync.mjs`)가 재생을 담당한다. 순서는 ① `DROP SCHEMA dev_sandbox CASCADE` ② `CREATE SCHEMA dev_sandbox` ③ `drizzle/00*.sql`을 번호 순서로 `search_path = dev_sandbox` 아래에서 실행 ④ 표식 테이블 2개(`sandbox_session`·`sandbox_meta`) 생성 ⑤ `dev_sandbox.posts`에 `0003`과 같은 8컬럼 SELECT 권한 적용 ⑥ `supabase_realtime` publication에 `dev_sandbox.posts` 등록(이미 있으면 건너뛴다) ⑦ `drizzle/meta/_journal.json`의 마지막 태그를 `sandbox_meta`에 기록.

콘솔 진입은 `sandbox_meta`의 태그를 저장소의 마지막 태그와 대조하고, 다르면 **진입을 실패시키고 `pnpm sandbox:sync`를 실행하라고 안내**한다.

**Rationale**: `tsx`가 저장소에서 제거됐으므로 `.ts` 스크립트를 직접 실행할 수 없다. `.mjs` + `dotenv`는 이미 있는 의존성만 쓴다. 진입 시 자동 DDL은 기각했다 — 실패하면 반쯤 만들어진 스키마가 남고, 그 상태가 조용히 다음 진입까지 이어진다. `spec.md` 엣지 케이스가 "진입이 실패해야 하고 조용히 낡은 스키마로 동작하지 않아야 한다"를 요구한다. `drizzle-kit`은 `public`만 보므로 `drizzle-kit check`에 영향이 없다.

**Alternatives considered**:
- `dev_sandbox`를 일반 마이그레이션으로 만들기 — `drizzle-kit`의 스냅샷에 들어가고 `public` 마이그레이션과 수명이 묶인다. `CLAUDE.md`가 "`drizzle-kit`은 `public`만 관리한다"를 고정했으므로 기각.
- 진입 시 자동 재생 — 위 사유로 기각.

---

## R8. 비우기 + 스냅샷의 SQL 형태

**Decision**: 단일 트랜잭션에서 `TRUNCATE dev_sandbox.participants, dev_sandbox.posts, dev_sandbox.users` → `INSERT INTO dev_sandbox.users (…열거…) SELECT …` → `posts`(단, `chat_url`은 `NULL`) → `participants` 순으로 실행한다. 컬럼은 **전부 명시 열거**하고 `SELECT *`를 쓰지 않는다. 행 수 상한은 두지 않는다.

**Rationale**: `SELECT *`로 복사하면 `public`에 컬럼이 추가될 때 조용히 어긋나거나 `chat_url`이 다시 새어 들어온다. 명시 열거는 스키마 변동 시 큰 소리로 실패한다. 단일 트랜잭션이라 중간 실패 시 빈 샌드박스가 남지 않는다. 현재 데이터가 수백 행 규모이므로 상한·페이지네이션은 불필요하다.

**Alternatives considered**: `DELETE` 대신 `TRUNCATE`를 쓰는 이유는 순서 제약(`posts.leader_id`가 `onDelete: 'restrict'`)을 한 문장으로 끝내고 시퀀스를 초기화하기 때문이다. `pg_dump`/`COPY` 경유는 외부 프로세스가 늘어 기각.

---

## R9. 세션 표식과 TTL

**Decision**: `dev_sandbox.sandbox_session`에 단일 행(`id = 1`)을 두고 `started_at`·`expires_at`을 기록한다. **TTL은 2시간**이다. 진입 시 `expires_at > realNow()`이면 초기화를 건너뛰고 합류하며, 지났으면 비우기 + 스냅샷을 수행한다. 비교에 쓰는 시각은 `realNow()`다.

**Rationale**: 표식 비교에 dev 시계를 쓰면 미래로 점프한 순간 표식이 만료돼 자기 샌드박스를 지운다. 2시간은 2창 실시간 검증과 시연 1회를 덮고, 그보다 오래 방치된 샌드박스는 다음 진입에서 초기화되는 쪽이 안전하다(누적 방지가 FR-015의 목적).

**Alternatives considered**: 표식 없이 매 진입 초기화 — `NFR-004` 2창 검증이 깨진다(FR-019). 세션별 샌드박스 분리 — 모든 쿼리에 필터가 붙는다(`trd.md` §2.4-5에서 이미 기각).

---

## R10. 클라이언트 오프셋 전달 방식

**Decision**: `src/components/dev/ClockProvider.tsx`(클라이언트 Context)를 쓰고, 서버가 `offsetMs`를 prop으로 넘긴다. `useDevClock()`이 `now()`를 돌려주고 `LivePingBoard`·`LeaderActions`·패널 시계가 그것을 쓴다. **게이트가 닫힌 환경에서는 서버가 쿠키를 읽지 않고 `offsetMs = 0`을 넘긴다.**

**Rationale**: `LeaderActions`는 상세 모달 깊이에 있어 prop 드릴링이 길다. 게이트가 닫힐 때 쿠키를 읽지 않는 것이 중요한 이유는, 루트 레이아웃에서 `cookies()`를 호출하면 상용에서도 모든 페이지가 동적 렌더로 바뀌기 때문이다.

**Alternatives considered**: prop 드릴링 — 경유 컴포넌트 전부의 시그니처가 바뀐다. 클라이언트에서 직접 쿠키 읽기 — `HttpOnly`가 아닌 쿠키를 늘리고 서버·클라이언트 판정이 갈릴 수 있다. 둘 다 기각.

---

## R11. 실시간 구독의 스키마 분기

**Decision**: 서버가 `realtimeSchema`(`'public' | 'dev_sandbox'`)를 피드 컴포넌트에 내리고, `useRealtimePosts(initial, schema)`가 `postgres_changes` 구독에 그대로 넘긴다. 채널 이름에도 스키마를 붙인다(`posts-channel:dev_sandbox`).

**Rationale**: 구독은 여전히 **동시 1개**다 — 스키마가 바뀌면 채널 이름이 바뀌어 기존 채널이 정리되고 새 채널이 열린다. 이름을 고정하면 캐시된 채널이 이전 스키마를 계속 본다. 권한은 재생 스크립트가 `dev_sandbox.posts`에 복제하므로(R7-⑤) 샌드박스에서도 `chat_url`이 페이로드에 들어가지 않는다.

**Alternatives considered**: 두 스키마를 동시에 구독 — 채널 수 1개 불변(`CLAUDE.md` §6.6)을 깬다. 기각.

---

## R12. 프리셋 산출 함수의 형태

**Decision**: `src/lib/dev/presets.ts`에 순수 함수 `presetTime(preset, ctx)`를 둔다. `ctx = { now: Date; post?: { endDate: Date | null; expiresAt: Date | null } }`이고 쿠키·DB에 접근하지 않는다. KST 경계 계산은 기존 `src/lib/end-date.ts`의 `kstDayRange()`·`toKstWall()`·`computeVerdictWindow()`를 재사용한다 — 새 날짜 유틸을 만들지 않는다. 값은 `next-steps.md` §4.0의 확정 프리셋을 따른다(모집창 시작 당월 15일 00:05 · 모집창 밖 당월 3일 · 판정창 열림 `end_date` 월 15일 · Grace 만료 익월 11일 00:01 · 파티 종료 직후 `end_date`+1분 · LIVE 만료 직전/직후 ∓1분 · 다음 KST 자정 +1일 00:01).

**Rationale**: 순수 함수라 `TC-DEV-01`이 DB 없이 돈다. 글 기준 점프(FR-021)는 같은 함수에 `ctx.post`를 넘기는 것으로 끝나므로 경로가 하나다.

**Alternatives considered**: 서버에서 프리셋별 오프셋을 미리 계산해 내려보내기 — 글 기준 점프에서 글마다 다시 계산해야 하고, 패널이 열린 동안 시각이 흘러 값이 낡는다. 기각.

---

## R13. 콘솔 라우트 구성

**Decision**: 라우트는 2개 파일 4개 동작이다 — `POST /api/dev/console`(비밀번호 검증 → 세션 쿠키 + 샌드박스 진입), `DELETE /api/dev/console`(세션 종료 + 쿠키 삭제), `POST /api/dev/clock`(절대 시각 또는 프리셋 → 오프셋 쿠키), `DELETE /api/dev/clock`(실제 시각 복귀). 페르소나 전환은 **기존 `/api/mock-auth`를 유지**하고 게이트만 교체한다.

**Rationale**: 페르소나 엔드포인트를 옮기면 `src/lib/personas.ts`를 읽는 경로와 계약을 다시 만들어야 한다. 게이트 조건식 한 줄 교체가 FR-011을 만족한다. 시계는 쿠키 1개만 다루므로 라우트 1개로 충분하다.

**Alternatives considered**: `/api/dev/persona` 신설 후 `/api/mock-auth` 삭제 — 이름은 깔끔하지만 계약 변경과 테스트 수정이 늘고 얻는 것이 없다. 기각.
