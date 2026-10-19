# Contract: 개발자 콘솔 API 및 게이트 (010)

라우트 2개 파일 · 4개 동작. 모든 응답은 기존 `AppError` → HTTP 매핑(`CLAUDE.md` §8)을 따른다. 게이트가 닫힌 환경에서는 **아래 전부가 404**다.

---

## C1. 게이트 (FR-008 · FR-009 · FR-011)

**열림 조건은 하나다: `process.env.DEV_CONSOLE_PASSWORD`가 비어 있지 않다.**

| 대상 | 게이트가 닫혔을 때 |
| :--- | :--- |
| `POST`·`DELETE /api/dev/console` | 404 `{ "error": "NOT_FOUND" }` |
| `POST`·`DELETE /api/dev/clock` | 404 `{ "error": "NOT_FOUND" }` |
| `POST /api/mock-auth` | 404 `{ "error": "NOT_FOUND" }` (기존 `NODE_ENV` 조건을 교체) |
| `ConsoleEntry`(`/login` 입구) | 렌더하지 않는다 (서버에서 `null`) |
| `DevConsole`(패널) | 렌더하지 않는다 (서버에서 `null`) |
| `serverNow()` | `modoo42_dev_clock`을 **읽지 않고** 실제 시각을 반환한다 |
| `requestDatabase()` | `modoo42_dev_console`을 **읽지 않고** `public` 핸들을 반환한다 |

`NODE_ENV`는 이 판정에 쓰지 않는다. 게이트를 둘로 두지 않는 것이 2026-10-19 결정이다.

---

## C2. `POST /api/dev/console` — 진입

**Request**: `{ "password": string }`

**동작 순서** (이 순서를 바꾸지 않는다):

1. 게이트 확인 → 닫혔으면 404.
2. `timingSafeEqual`로 비밀번호 비교 → 불일치 401 `{ "error": "UNAUTHORIZED" }`. 길이가 달라도 비교 시간이 값에 의존하지 않도록 먼저 해시 길이를 맞춘다.
3. `dev_sandbox.sandbox_meta.journal_tag`를 저장소의 마지막 `drizzle/meta/_journal.json` 태그와 대조 → 불일치 409 `{ "error": "SANDBOX_STALE", "hint": "pnpm sandbox:sync" }`. 스키마가 없을 때도 같은 응답이다.
4. `dev_sandbox.sandbox_session`을 읽는다. `expires_at > realNow()`이면 **초기화를 건너뛴다**(합류). 아니면 `sandbox-isolation.md` S2~S4의 비우기 + 스냅샷을 단일 트랜잭션으로 수행하고 표식을 갱신한다.
5. `modoo42_dev_console` 서명 쿠키를 발급한다.

**Response 200**: `{ "joined": boolean, "snapshotRows": { "users": number, "posts": number, "participants": number } }`

`joined: true`는 기존 샌드박스에 합류했다는 뜻이고 그때 `snapshotRows`는 현재 행 수다.

---

## C3. `DELETE /api/dev/console` — 종료

쿠키 `modoo42_dev_console`과 `modoo42_dev_clock`을 **함께** 삭제한다. 샌드박스 데이터는 지우지 않는다 — 정리 보장은 진입 쪽에 있다 (FR-015).

**Response 200**: `{ "ended": true }`

---

## C4. `POST /api/dev/clock` — 시각 이동

**Request** (둘 중 하나, `superRefine`으로 배타 검증):

```json
{ "at": "2026-11-15T00:05:00+09:00" }
{ "preset": "verdict_open", "postId": "<uuid>" }
```

- `at`: 절대 시각(ISO 8601, 오프셋 포함). 범위 제한 없음.
- `preset`: `data-model.md` §4의 키. `ctx.post`가 필수인 3종은 `postId`가 없으면 400 `BAD_REQUEST`.
- `postId`가 있으면 **현재 요청의 핸들**(샌드박스 세션이면 `dev_sandbox`)에서 글을 읽는다. 없으면 404.

**동작**: 목표 절대 시각을 구하고 `offsetMs = 목표 − realNow()`를 정수로 환산해 `modoo42_dev_clock`에 담는다. 유효한 콘솔 세션이 없으면 **403** `{ "error": "FORBIDDEN" }` — 쿠키만 심어서 시각을 바꿀 수 없다 (`TC-DEV-10`).

**Response 200**: `{ "offsetMs": number, "effectiveAt": string }`

## C5. `DELETE /api/dev/clock` — 실제 시각 복귀

`modoo42_dev_clock`을 삭제한다. **Response 200**: `{ "offsetMs": 0 }`

---

## C6. 시각·핸들 주입 계약 (FR-001 ~ FR-007 · FR-013 · FR-014)

| 규칙 | 내용 |
| :--- | :--- |
| 단일 소스 | 서버의 유효 시각은 `serverNow()`만이 만든다. RSC·Route Handler에서 `new Date()`를 직접 쓰지 않는다 |
| 기본값 금지 | `src/lib/posts.ts`·`leader-actions.ts`의 `now`와 `database`에 기본값을 두지 않는다. 누락은 타입 오류로 잡힌다 (R1) |
| 쿠키 경계 | 쿠키를 읽는 모듈은 `clock.ts`·`dev/console-session.ts`·`dev/sandbox.ts` 3개뿐이다. 도메인은 인자만 받는다 (R2) |
| 세션 예외 | `src/lib/session.ts`의 만료 검증은 `realNow()`를 받는다. 인증 레코드 타임스탬프도 실제 시각이다 (R6) |
| 도메인 타임스탬프 | `posts.created_at`·`participants.joined_at`·도메인 `posts.updated_at`은 유효 시각을 명시 삽입한다. 컬럼 기본값은 유지한다 (R6) |
| 클라이언트 | `offsetMs`는 `ClockProvider` Context로 내려간다. 게이트가 닫히면 서버가 쿠키를 읽지 않고 `0`을 넘긴다 (R10) |
| 실시간 | `useRealtimePosts(initial, schema)`가 구독 스키마를 받고 채널 이름에 스키마를 붙인다. 동시 채널 수는 1개다 (R11) |

---

## C7. 인수 테스트 단정 방식 (`requirement.md` §3 Test Suite 10)

| TC | 단정 방식 |
| :--- | :--- |
| `TC-DEV-01` | `presetTime()` 순수 함수 단위. KST 경계 기대값과 비교. DB 없음 |
| `TC-DEV-02` | 절대 시각 → `offsetMs` → 유효 시각 왕복. 음수 오프셋 포함. DB 없음 |
| `TC-DEV-03` | `vi.stubEnv('DEV_CONSOLE_PASSWORD', '')` + `vi.resetModules()` 후 `serverNow()`가 쿠키를 무시함을 단정. 라우트는 404 |
| `TC-DEV-04` | `verifySessionToken(token, realNow())`가 dev 시계 +31일에서도 유효 판정 |
| `TC-DEV-05` | 스냅샷 후 `dev_sandbox.posts`에 운영 `chat_url` 값이 0건이고 전부 `dev-sandbox` 더미 또는 `NULL`임을 단정. 파생 `chat_platform`이 원본과 같고 `reference_url`이 복사됨을 단정 |
| `TC-DEV-06` | 대상 스키마를 `'public'`으로 넘기면 **SQL 실행 전에** 던짐을 단정. 호출 수 0을 확인 |
| `TC-DEV-07` | 표식 유효 → 초기화 건너뜀(행 수 유지), TTL 경과 → 초기화 수행 |
| `TC-DEV-08` | 과거 `now`로 `createPost` → `end_date`가 그 시점 기준. `now` 생략은 타입 오류(컴파일 단정) |
| `TC-DEV-09` | 샌드박스 핸들로 생성·참여·판정 후 `public` 3테이블 행 수 불변 |
| `TC-DEV-10` | 콘솔 세션 없이 오프셋 쿠키만 → 유효 시각 불변, `POST /api/dev/clock` 403 |
| `TC-DEV-11` | 같은 조회 함수를 두 핸들로 호출해 서로 다른 행 집합을 반환함을 단정 |
| `TC-DEV-12` | 과거 `now`로 만든 글의 `created_at`과 참여 행 `joined_at`이 그 과거 시각 |

DB가 필요한 TC(`05`·`06`·`07`·`09`·`11`·`12`)는 트랜잭션 롤백으로 격리한다. `TRUNCATE`도 트랜잭션 안에서 롤백되므로 공용 인스턴스에서 안전하다. 실행 전제는 `pnpm sandbox:sync`가 한 번 돌아 `dev_sandbox`가 존재하는 것이다.
