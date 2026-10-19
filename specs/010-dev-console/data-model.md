# Phase 1 Data Model: 개발자 콘솔 (010)

`public` 스키마는 바뀌지 않는다 (`spec.md` FR-024). 아래는 **쿠키 2종**, **`dev_sandbox` 스키마**, **표식 테이블 2개**, **프리셋 열거**의 구조다. 값과 결정 근거는 `research.md`와 `docs/trd.md` §2.4에 있고 여기서 중복하지 않는다.

---

## 1. 쿠키

| 쿠키 | 내용 | 속성 | 생명주기 |
| :--- | :--- | :--- | :--- |
| `modoo42_dev_console` | 콘솔 admin 세션. `<payload>.<HMAC-SHA256>` 형태이고 payload에 발급 시각이 든다. 서명 키는 `DEV_CONSOLE_PASSWORD`(R4) | `HttpOnly`, `SameSite=Lax`, `Secure`(상용 스코프), `path=/` | 비밀번호 검증 성공 시 발급. `DELETE /api/dev/console`로 삭제. 비밀번호가 바뀌면 서명 검증이 실패해 자동 무효 |
| `modoo42_dev_clock` | 시계 오프셋. 정수 1개(`offsetMs`), 형식 `^-?\d{1,15}$`. 서명하지 않는다(R5) | `SameSite=Lax`, `path=/` | `POST /api/dev/clock`에서 설정, `DELETE`에서 삭제. 손상값·형식 위반은 `0`으로 간주 |

**유효 시각 = 실제 시각 + `offsetMs`.** 오프셋이 반영되는 조건은 `DEV_CONSOLE_PASSWORD` 설정 **그리고** 유효한 `modoo42_dev_console`이다. 하나라도 없으면 `modoo42_dev_clock`을 읽지 않는다 (FR-009).

기존 쿠키 3종(`modoo42_session`·`modoo42_oauth_state`·`modoo42_mock_user`)의 의미는 바뀌지 않는다.

---

## 2. `dev_sandbox` 스키마

`public`의 **구조를 그대로 복제**한다. 열거형 5종(`campus_type`·`post_type`·`post_status`·`location_type`·`participant_status`)도 스키마 스코프라 함께 생성된다. 테이블 3개(`users`·`posts`·`participants`)와 인덱스·유일 제약·외래키가 `drizzle/`의 SQL 그대로다.

| 성질 | `public` | `dev_sandbox` |
| :--- | :--- | :--- |
| 관리 주체 | `drizzle-kit` (`drizzle/*.sql` + `meta/`) | `pnpm sandbox:sync` 재생 (R7) |
| `posts.chat_url` | 실제 초대 링크 | **항상 `NULL`** (스냅샷이 마스킹, FR-016) |
| `anon`/`authenticated` SELECT | 8컬럼만 (`drizzle/0003`) | 같은 8컬럼 (재생 스크립트가 복제, FR-018) |
| `supabase_realtime` publication | `posts` 등록됨 | `dev_sandbox.posts` 등록 |
| 수명 | 영속 | 재생 시 `DROP … CASCADE`로 날아간다 |

**TRUNCATE 순서는 `participants` → `posts` → `users`다** (`posts.leader_id`가 `onDelete: 'restrict'`). 스냅샷 INSERT 순서는 그 역순이다.

**행 식별자(`id`)는 보존해 복사한다.** `public`에서 발급된 `modoo42_session`이 샌드박스 안에서도 같은 유저로 해석되어야 한다 (`spec.md` Assumptions).

---

## 3. 표식 테이블 (`dev_sandbox` 전용, drizzle 스키마에 없다)

### `dev_sandbox.sandbox_session` — 살아 있는 세션 표식 (FR-019)

| 컬럼 | 타입 | 의미 |
| :--- | :--- | :--- |
| `id` | `integer` PK, 항상 `1` | 단일 행 강제. 동시 샌드박스는 1개다 |
| `started_at` | `timestamptz NOT NULL` | 초기화 + 스냅샷을 수행한 실제 시각 |
| `expires_at` | `timestamptz NOT NULL` | `started_at + 2시간` (R9) |

진입 판정: `expires_at > realNow()`이면 초기화를 **건너뛰고 합류**, 아니면 비우기 + 스냅샷 후 행을 갱신한다. 비교에 `realNow()`를 쓰는 이유는 미래로 점프한 순간 자기 샌드박스를 지우지 않기 위함이다.

### `dev_sandbox.sandbox_meta` — 스키마 버전 표식 (R7)

| 컬럼 | 타입 | 의미 |
| :--- | :--- | :--- |
| `id` | `integer` PK, 항상 `1` | 단일 행 |
| `journal_tag` | `text NOT NULL` | 재생 시점의 `drizzle/meta/_journal.json` 마지막 태그 |
| `synced_at` | `timestamptz NOT NULL` | 재생 실제 시각 |

진입이 이 값을 저장소의 마지막 태그와 대조한다. 다르면 **진입 실패**하고 `pnpm sandbox:sync` 안내를 반환한다. 조용히 낡은 스키마로 동작하지 않는다.

---

## 4. 시나리오 프리셋 (`ScenarioPreset`)

`presetTime(preset, ctx)`의 반환은 **절대 시각**이고, 라우트가 `입력 − 실제 now`로 오프셋을 환산한다. `ctx = { now, post? }`.

| 키 | 산출 | `ctx.post` 필요 |
| :--- | :--- | :--- |
| `recruit_open` | 당월 15일 00:05 KST | 아니오 |
| `recruit_closed` | 당월 3일 00:05 KST | 아니오 |
| `verdict_open` | `post.endDate` 월의 15일 00:05 KST | 예 (없으면 당월 기준) |
| `grace_expired` | `post.endDate` 월 기준 익월 11일 00:01 KST | 예 (없으면 당월 기준) |
| `party_ended` | `post.endDate` + 1분 | **예** |
| `live_before_expiry` | `post.expiresAt` − 1분 | **예** |
| `live_after_expiry` | `post.expiresAt` + 1분 | **예** |
| `next_kst_midnight` | 다음 KST 자정 + 1분 | 아니오 |

`ctx.post`가 필수인 3종은 패널의 시나리오 섹션에서 비활성이고, 상세 모달의 "이 글 기준으로 이동"(FR-021)에서만 활성된다. 날짜 경계 계산은 `src/lib/end-date.ts`의 기존 함수를 재사용한다 (R12).

---

## 5. 세션 해석 소스 (`SessionSource`)

패널 인증 섹션이 표시하는 값 (FR-012). 저장하지 않고 요청마다 파생한다.

| 값 | 조건 |
| :--- | :--- |
| `session` | `modoo42_session`이 유효하다. 페르소나 버튼은 효과가 없다 |
| `persona` | `modoo42_session`이 없고 `modoo42_mock_user`가 유효한 페르소나다 |
| `비로그인` | 둘 다 없다 |

`getCurrentUser()`의 우선순위(`modoo42_session` → `modoo42_mock_user`)를 바꾸지 않는다. 표시만 추가한다.
