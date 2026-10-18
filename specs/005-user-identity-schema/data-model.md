# Data Model: 유저 식별 스키마 전환 (005)

정의 원본은 `docs/trd.md` §3.2다. 이 문서는 전환 전/후 차이와 적용 순서만 담는다.

---

## 1. `users` 컬럼 전환표

| 컬럼 | 전환 전 | 전환 후 | 비고 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` PK | 변경 없음 | |
| `github_id` | 없음 | `text` **UNIQUE NOT NULL** | 불변 매칭 키. Phase 4 Upsert 충돌 기준 |
| `login` | 없음 | `text` **UNIQUE NOT NULL** | 표시용 GitHub 핸들. 유저가 변경할 수 있다 (R9 위험 참조) |
| `intra_id` | `text` UNIQUE **NOT NULL** | `text` UNIQUE **nullable** | 42 추가 인증용. §1.3 착수 전까지 비어 있다. 어떤 응답에도 싣지 않는다 |
| `campus` | `campus_type` **NOT NULL** | `campus_type` **nullable** | 값 종류(`GS`/`SEOUL`)는 보존 |
| `intra_verified_at` | 없음 | `timestamptz` nullable | §1.3 착수 전까지 어느 경로에서도 채우지 않는다 |
| `completed_count` | `integer` default 0 NOT NULL | 변경 없음 | |
| `leader_count` | `integer` default 0 NOT NULL | 변경 없음 | |
| `created_at` / `updated_at` | `timestamptz` NOT NULL | 변경 없음 | |

Drizzle 선언 (목표 상태, `trd.md` §3.2와 동일):

```typescript
githubId: text('github_id').unique().notNull(),
login: text('login').unique().notNull(),
intraId: text('intra_id').unique(),
campus: campusEnum('campus'),
intraVerifiedAt: timestamp('intra_verified_at', { withTimezone: true }),
```

## 2. `location_type` 열거형

| | 값 |
| :--- | :--- |
| 전환 전 | `ONLINE`, `OFFLINE_GS`, `OFFLINE_SEOUL`, `HYBRID` |
| 전환 후 | `ONLINE`, `OFFLINE_GS`, `OFFLINE_SEOUL`, **`OFFLINE_ETC`**, `HYBRID` |

- 저장 가능 값 5종, **유저 입력 가능 값 4종**. `OFFLINE_ETC`는 LIVE 핑 서버 파생 전용이다 (FR-005a, research R7).
- 값 추가는 전진 전용이다. 제거 경로가 없다.
- 기존 4값의 의미·저장값은 바뀌지 않는다.

## 3. 캠퍼스 → 장소 분류 파생 규칙 (FR-006)

LIVE 핑 생성에만 적용한다. 정규 스터디·단기 파티는 유저가 고른 값을 그대로 쓴다.

| 작성자 `campus` | 기록되는 `location_type` |
| :--- | :--- |
| `'GS'` | `OFFLINE_GS` |
| `'SEOUL'` | `OFFLINE_SEOUL` |
| `null` | `OFFLINE_ETC` |

구현 위치: `src/lib/public-user.ts`의 `campusToLocationType(campus)`. 호출 지점은 `src/lib/posts.ts`의 LIVE 핑 생성 트랜잭션 1곳(현재 `author.campus === 'GS' ? 'OFFLINE_GS' : 'OFFLINE_SEOUL'`)이다.

캠퍼스가 비어 있다는 이유로 생성을 거부하지 않는다. 이미 생성된 핑의 `location_type`은 나중에 작성자가 42 인증을 마쳐도 소급 변경하지 않는다(핑은 최대 3시간 휘발 정보다).

## 4. 마이그레이션 적용 순서 (단일 파일, 단일 트랜잭션)

순서를 바꾸면 적용이 실패한다. 반드시 아래 순서로 둔다.

1. `ALTER TYPE "public"."location_type" ADD VALUE 'OFFLINE_ETC';`
   — 값 추가만 한다. **이 마이그레이션 안에서 이 값을 쓰지 않는다** (research R2).
2. `ALTER TABLE "users" ADD COLUMN "github_id" text;`
   `ALTER TABLE "users" ADD COLUMN "login" text;`
   `ALTER TABLE "users" ADD COLUMN "intra_verified_at" timestamp with time zone;`
   — 필수 제약 없이 추가한다.
3. 백필:
   ```sql
   UPDATE "users" SET "github_id" = 'mock:' || "intra_id", "login" = "intra_id"
   WHERE "github_id" IS NULL;
   ```
4. 제약 적용:
   ```sql
   ALTER TABLE "users" ALTER COLUMN "github_id" SET NOT NULL;
   ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL;
   ALTER TABLE "users" ADD CONSTRAINT "users_github_id_unique" UNIQUE("github_id");
   ALTER TABLE "users" ADD CONSTRAINT "users_login_unique" UNIQUE("login");
   ```
5. 기존 제약 완화:
   ```sql
   ALTER TABLE "users" ALTER COLUMN "intra_id" DROP NOT NULL;
   ALTER TABLE "users" ALTER COLUMN "campus" DROP NOT NULL;
   ```

제약 이름은 `drizzle-kit generate` 생성물 그대로 따른다. 손 편집 대상은 SQL 본문뿐이며 `drizzle/meta/*` 스냅샷은 생성물을 유지한다.

**적용 후 검증**: `github_id`·`login`이 `null`인 행 0건, `users` 3건 / `posts` 3건 / `participants` 6건 유지 (SC-004, TC-IDENT-03).

## 5. 공개 유저 투영 (`PublicUser`)

```typescript
// src/lib/public-user.ts
export type Campus = (typeof users.$inferSelect)['campus']; // 'GS' | 'SEOUL' | null
export type PublicUser = { login: string; campus: Campus };
```

- 응답에 나가는 유저 정보는 이 2필드뿐이다. `id`·`intra_id`·`intra_verified_at`·`github_id`는 싣지 않는다 (FR-010).
- `avatar_url`은 수집·저장하지 않는다. 화면은 `login` 앞 2자리 이니셜을 쓴다 (CLAUDE.md §7.2).
- 전환 전 `{ intraId: string; campus: 'GS' | 'SEOUL' }` 모양이 `src/lib/posts.ts`와 `src/lib/cli-format.ts`에 중복 선언돼 있었다. 이 타입으로 합친다 (research R5).

## 6. Mock 페르소나 (개발 환경 전용)

| 키 | 라벨 | `github_id` | `login` | `campus` | `intra_id` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `gs_leader` | GS 리더 | `mock:gs_leader` | `gs_leader` | `GS` | `null` |
| `gs_member` | GS 멤버 | `mock:gs_member` | `gs_member` | `GS` | `null` |
| `seoul_member` | SEOUL 멤버 | `mock:seoul_member` | `seoul_member` | `SEOUL` | `null` |
| `github_only` | GitHub 전용 (캠퍼스 없음) | `mock:github_only` | `github_only` | `null` | `null` |

- `guest`는 페르소나가 아니다(쿠키 삭제 = 비로그인).
- Upsert 충돌 기준은 `github_id`다 (research R4). 같은 페르소나를 여러 번 골라도 같은 행을 재사용한다(멱등).
- 백필된 기존 3행의 `github_id`가 위 표의 값과 일치하므로, 전환 후 첫 페르소나 해석이 새 행을 만들지 않고 기존 행에 붙는다.
- `intra_verified_at`은 페르소나에서도 채우지 않는다. 캠퍼스는 개발 시드가 직접 채운다 (spec Key Entities).

## 7. 영향 받는 쿼리·투영 지점

| 파일 | 지점 | 변경 |
| :--- | :--- | :--- |
| `src/lib/posts.ts:47` | `publicUser()` | `toPublicUser()`로 교체, `login` 반환 |
| `src/lib/posts.ts:148` | LIVE 파생 삼항식 | `campusToLocationType(author.campus)` |
| `src/lib/posts.ts:253,259` | `getPostDetail` 참여자·리더 select | `users.login` |
| `src/lib/posts.ts:327,350` | `listPosts` leader select·투영 | `users.login` |
| `src/lib/posts.ts:657,670,681,685` | `listHallOfFame` leader·완주 멤버, 정렬 | `users.login`, `orderBy(asc(users.login))` |
| `src/lib/posts.ts:712,719` | `getLeaderboard` select·타이브레이커 | `users.login`, `asc(users.login)` (FR-009) |
| `src/lib/cli-format.ts:14,72` | `CliItem.leader` 타입·`leaderLabel()` | `PublicUser`, 캠퍼스 `null` 분기 |
| `src/app/api/list/route.ts:23` | `project()`의 leader | `{ login, campus }` |
| `src/lib/auth.ts:11,15,42,46,47,49` | `PERSONAS`·Upsert | `personas.ts` 참조, `github_id` 충돌 기준 |
| `src/components/MockAuthModal.tsx:7` | `PERSONA_BUTTONS` | `personas.ts`에서 생성 |
| `src/lib/validation.ts:32` | 입력 열거형 | **변경 없음** (4종 유지, 테스트로 고정) |
