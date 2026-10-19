# Contract: 샌드박스 격리 — 재생 · 스냅샷 · 권한 · 단정 (010)

대상 스키마 이름은 코드 상수 **하나**에만 둔다: `export const DEV_SANDBOX_SCHEMA = 'dev_sandbox'`. 문자열 리터럴을 두 번째로 적지 않는다.

---

## S1. 재생 (`pnpm sandbox:sync` = `node scripts/sandbox-sync.mjs`)

순서를 바꾸지 않는다.

1. `DROP SCHEMA IF EXISTS dev_sandbox CASCADE`
2. `CREATE SCHEMA dev_sandbox`
3. `drizzle/0000_*.sql` → `0003_*.sql`을 번호 순서로, 각 파일을 `SET LOCAL search_path = dev_sandbox` 아래에서 실행한다. `--> statement-breakpoint`로 문장을 나눈다.
4. 표식 테이블 2개 생성 — `dev_sandbox.sandbox_session`, `dev_sandbox.sandbox_meta` (`data-model.md` §3)
5. `dev_sandbox.posts`에 S5의 컬럼 권한 적용
6. `supabase_realtime` publication에 `dev_sandbox.posts` 등록 — `pg_publication_tables`로 존재를 먼저 확인한다(`ADD TABLE`은 중복 시 에러)
7. `drizzle/meta/_journal.json`의 마지막 `tag`를 `sandbox_meta.journal_tag`에 기록

**스크립트는 `.mjs`다.** `tsx`가 저장소에 없고 새 의존성을 추가하지 않는다. `.env.local` 로드는 이미 있는 `dotenv`를 쓴다.

**`drizzle-kit`은 이 스키마를 보지 않는다.** `drizzle-kit check`·`migrate`의 대상은 `public`뿐이고, `dev_sandbox`는 `drizzle/`의 스냅샷에 등장하지 않는다.

---

## S2. 진입 판정

| 상태 | 동작 |
| :--- | :--- |
| `dev_sandbox` 없음, 또는 `sandbox_meta.journal_tag` ≠ 저장소 마지막 태그 | **진입 실패.** 409 `SANDBOX_STALE` + `pnpm sandbox:sync` 안내. 자동 DDL을 실행하지 않는다 |
| `sandbox_session.expires_at > realNow()` | **초기화 건너뜀 (합류).** 데이터를 그대로 쓴다 |
| 표식 없음 또는 TTL 경과 | S3 + S4를 단일 트랜잭션으로 수행하고 표식을 `started_at = realNow()`, `expires_at = realNow() + 2시간`으로 갱신 |

---

## S3. 비우기 (파괴적 — 순서와 수식을 바꾸지 않는다)

```sql
TRUNCATE dev_sandbox.participants, dev_sandbox.posts, dev_sandbox.users;
```

- **항상 스키마를 수식한다.** `search_path`에 의존하지 않는다.
- 순서는 `participants` → `posts` → `users` (`posts.leader_id`가 `onDelete: 'restrict'`).
- 한 문장으로 끝낸다 — 여러 문장으로 쪼개면 중간 실패 시 외래키 때문에 복구가 막힌다.

---

## S4. 스냅샷 (`public` → `dev_sandbox`)

삽입 순서는 `users` → `posts` → `participants`다. **컬럼을 전부 명시 열거하고 `SELECT *`를 쓰지 않는다** — `public`에 컬럼이 추가되면 큰 소리로 실패해야 한다.

### `chat_url` 마스킹은 `NULL`이 아니라 **플랫폼 보존 더미 값**이다

```sql
CASE
  WHEN chat_url IS NULL THEN NULL
  WHEN chat_url LIKE 'https://open.kakao.com/%' THEN 'https://open.kakao.com/o/dev-sandbox'
  ELSE 'https://discord.gg/dev-sandbox'
END
```

**근거:** `chatPlatform`은 컬럼이 아니라 `chat_url`에서 읽을 때 파생된다(`src/lib/posts.ts:297`·`382`, `deriveChatPlatform`). 전건 `NULL`로 만들면 상세 모달의 플랫폼 배지가 사라지고, `JoinConfirmDialog`가 모든 글을 "오프라인 전용"으로 보고 확인 카피에서 오픈채팅방 문구를 뺀다(`CLAUDE.md` §7.1). 그러면 콘솔이 검증해야 할 참여 플로우가 운영과 달라진다. 더미 값은 **실제 초대 링크를 노출하지 않으면서**(FR-016의 목적) 플랫폼 구분과 "채팅방 있음/없음" 분기를 보존하고, `NFR-002`의 화이트리스트 정규식도 통과한다. 더미 링크 자체는 존재하지 않는 방이므로 새 탭이 열려도 아무 데도 닿지 않는다.

`reference_url`·`place`·`description`은 그대로 복사한다. 행 식별자(`id`)와 `created_at`·`joined_at`도 보존 복사한다 — 세션 해석(`modoo42_session` → `users.id`)이 샌드박스에서도 성립해야 한다.

---

## S5. 컬럼 단위 SELECT 권한 복제 (FR-018)

`drizzle/0003_revoke_anon_chat_url.sql`과 **같은 8컬럼**을 `dev_sandbox.posts`에 적용한다.

```sql
REVOKE SELECT ON TABLE dev_sandbox.posts FROM anon, authenticated;
GRANT SELECT (id, type, max_members, current_members, expires_at, status, created_at, updated_at)
  ON TABLE dev_sandbox.posts TO anon, authenticated;
```

**publication 등록만으로는 막히지 않는다.** Realtime은 복제 슬롯을 `wal2json`으로 읽어 publication의 컬럼 목록을 적용하지 않는다(`docs/trd.md` §5, 2026-10-18 실측). 권한을 복제하지 않으면 샌드박스 쪽 구독자에게 `chat_url`(더미 값이라도)이 흘러간다. 두 조치는 한 묶음이다.

공개 컬럼 목록이 `0003`과 어긋나면 안 된다 — 재생 스크립트가 `0003`을 파싱하지 않고 목록을 하드코딩하므로, `0003`을 바꿀 때 스크립트도 같은 PR에서 고친다.

---

## S6. 파괴적 실행 전 단정 (FR-017 · `TC-DEV-06`)

파괴적 SQL을 실행하는 함수는 **스키마 이름을 인자로 받고**, 실행 전에 아래를 모두 통과해야 한다.

1. `schema === DEV_SANDBOX_SCHEMA` — 아니면 던진다. `'public'`은 당연히 거부된다.
2. 문장 문자열에 `public.`이 등장하지 않는다 (스냅샷의 `SELECT … FROM public.*`는 **읽기 전용 문장**이라 파괴 경로와 분리해 둔다).
3. 단정 실패 시 **SQL을 한 줄도 실행하지 않는다.** 테스트는 실행 호출 수 0을 단정한다.

복구 수단이 없는 유일한 동작이므로 단정을 테스트로 고정한다. 구현보다 테스트를 먼저 쓴다.

---

## S7. 요청 핸들 선택 (FR-013 · FR-014)

```text
requestDatabase():
  게이트 닫힘            -> public 핸들
  콘솔 세션 쿠키 무효     -> public 핸들
  콘솔 세션 쿠키 유효     -> dev_sandbox 핸들
```

- 샌드박스 핸들은 `postgres(connectionString, { connection: { search_path: 'dev_sandbox' } })`로 만든 **두 번째 drizzle 인스턴스**이고 모듈 수준에서 1개만 만든다(연결 풀 중복 방지).
- 도메인 함수의 `database` 인자로 주입한다. 함수 시그니처의 역할은 바뀌지 않는다 — 기본값만 사라진다(R1).
- `src/lib/auth.ts`의 유저 조회도 같은 핸들을 쓴다. 쓰지 않으면 콘솔 세션에서 `leader_id` 외래키가 샌드박스 안에서 풀리지 않는다.
- 쿠키 삭제가 운영 복귀 경로다. 별도 "복귀" 동작을 만들지 않는다.
