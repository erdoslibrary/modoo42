# Research: 유저 식별 스키마 전환 (005)

실측 환경: PostgreSQL 17.11 (Supabase), 전환 대상 행 수 `users` 3 / `posts` 3 / `participants` 6.

---

## R1. 필수 컬럼 2개를 기존 행이 있는 테이블에 추가하는 방법

**Decision**: `drizzle-kit generate`로 뼈대를 만든 뒤 생성된 SQL을 손으로 3단으로 편집한다 — ① nullable 컬럼 추가 ② `UPDATE` 백필 ③ `SET NOT NULL` + 유일 인덱스. 스냅샷(`drizzle/meta/*.json`)은 생성물 그대로 두고 SQL 본문만 고친다.

**Rationale**: `github_id`·`login`은 `NOT NULL`이다. drizzle-kit이 생성하는 `ADD COLUMN ... NOT NULL`은 기존 3행 때문에 `column "github_id" of relation "users" contains null values`로 실패한다. `DEFAULT`를 붙여 회피하면 모든 기존 행이 같은 값을 갖게 되어 유일 제약에서 또 실패한다. 스냅샷은 "최종 스키마 상태"만 담으므로 SQL 본문 편집은 `drizzle-kit check`의 정합성 판정에 영향을 주지 않는다(검증 대상은 스키마 ↔ 스냅샷 일치).

**Alternatives considered**:
- 기존 행 삭제 후 제약 적용 → 기각. `posts.leader_id`가 `onDelete: 'restrict'`라 글·참여 기록을 먼저 지워야 하고, 마이그레이션 파일의 `DELETE`는 모든 환경에서 재실행되어 실데이터를 지운다.
- 컬럼을 nullable로 두고 애플리케이션에서만 필수 취급 → 기각. requirement.md FR-016이 `UNIQUE NOT NULL`을 명시했고, 불변 매칭 키가 비어 있을 수 있으면 Phase 4 Upsert 기준이 무너진다.
- 마이그레이션을 2개로 쪼개 백필을 중간에 수동 실행 → 기각. CI의 `drizzle-kit migrate`가 무인으로 돌아 중간 수동 단계를 끼울 수 없다.

## R2. `location_type`에 값 추가하기

**Decision**: `ALTER TYPE "public"."location_type" ADD VALUE 'OFFLINE_ETC';`를 마이그레이션에 넣되, **같은 마이그레이션에서 그 값을 쓰지 않는다**. 백필 `UPDATE`는 `users`만 건드리고 `posts.location_type`은 손대지 않는다.

**Rationale**: PostgreSQL은 PG12부터 트랜잭션 블록 안에서 `ADD VALUE`를 허용하지만, 같은 트랜잭션에서 새 값을 사용하면 `unsafe use of new value of enum type`으로 거부한다. drizzle-orm 마이그레이터는 마이그레이션 파일 단위로 트랜잭션을 건다. 값 추가만 하고 사용은 런타임(LIVE 핑 생성)으로 미루면 제약을 피한다.

**Alternatives considered**:
- `location_type`을 열거형에서 `text` + 체크 제약으로 전환 → 기각. 기존 4값을 쓰는 모든 쿼리·타입이 흔들리고, 열거형 1값 추가가 목적인데 타입을 바꾸는 건 과잉이다.
- 기존 `OFFLINE_GS`를 "캠퍼스 미상" 겸용으로 재사용 → 기각. 경산에 있지 않은 유저를 경산으로 기록하는 거짓 데이터다. requirement.md FR-016이 전용 값을 요구한다.

**Known limitation**: 열거형 값 추가는 전진 전용이다. 되돌리려면 값을 제거하는 대신 쓰지 않는 방법만 있다 (spec Edge Cases).

## R3. 백필 값 규칙

**Decision**: `github_id = 'mock:' || intra_id`, `login = intra_id`.

**Rationale**: 기존 3행은 Mock 페르소나(`gs_leader`·`gs_member`·`seoul_member`)다. `intra_id`가 유일하므로 파생값도 유일해 제약을 만족한다. `mock:` 접두사는 실제 GitHub 숫자 식별자(숫자 문자열)와 형태가 겹치지 않아, Phase 4 OAuth 로그인이 같은 행에 잘못 매칭되지 않는다. `login`은 화면 표기용이라 사람이 읽을 수 있는 `intra_id` 값을 그대로 쓴다.

**Alternatives considered**:
- `github_id`를 `bigint`로 바꾸고 숫자 백필 → 기각. `trd.md` §3.2가 `text`로 정의했고, 숫자 타입이면 Mock 값 백필 자체가 불가능해 기존 행 삭제로 되돌아간다.
- `gen_random_uuid()` 같은 임의값 백필 → 기각. 사람이 읽을 수 없어 개발 중 디버깅이 어려워진다.

**Follow-up**: 백필로 남는 Mock 유저 3건과 글 3건은 상용 피드에 노출될 수 있다. 마이그레이션이 아니라 수동 정리 작업으로 `docs/next-steps.md`에 적는다.

## R4. 페르소나와 `intra_id`의 관계

**Decision**: 페르소나 정의에서 `intra_id`를 비운다(`null`). 페르소나는 `github_id`·`login`·`campus`만 갖는다. Upsert 충돌 기준을 `users.intraId`에서 `users.githubId`로 바꾼다.

**Rationale**: 페르소나 문자열은 42 계정이 아니다. `intra_id`에 남기면 "42 추가 인증을 마친 유저"처럼 보이고, §1.3 착수 때 진짜 Intra ID와 충돌한다. `github_id`가 불변 매칭 키이므로 충돌 기준으로도 이쪽이 맞다 (`trd.md` §2.2 "충돌 기준 컬럼은 `github_id`").

**Note**: 기존 3행의 `intra_id`는 백필 시점에 지우지 않는다(값이 있어야 백필 식이 성립한다). 페르소나 해석이 `github_id` 기준으로 바뀌므로 남은 `intra_id` 값은 더 이상 매칭에 쓰이지 않는다. `intra_verified_at`은 어느 경로에서도 채우지 않는다 (req FR-016).

**Alternatives considered**:
- 페르소나가 `intra_id`도 채우고 `intra_verified_at`까지 채워 "42 인증 완료 유저"를 모사 → 기각. requirement.md FR-016이 `intra_verified_at`을 "§1.3 착수 전까지 항상 `null`"로 고정했다. 문서가 이긴다.

## R5. 공개 유저 투영 통합

**Decision**: `src/lib/public-user.ts`를 신설해 `Campus` 타입, `PublicUser` 타입, `toPublicUser()`, `campusToLocationType()`을 모은다. `src/lib/posts.ts`와 `src/lib/cli-format.ts`가 이 모듈을 쓴다.

**Rationale**: 같은 모양(`{ 유저 표시 식별자, 캠퍼스 }`)이 `posts.ts:47`의 `publicUser()`와 `cli-format.ts:14`의 `CliItem.leader`에 각각 선언돼 있었다. 캠퍼스가 nullable이 되면 두 곳을 같이 고쳐야 하고, 다음에 또 어긋난다. 캠퍼스 → 장소 분류 파생은 FR-006 규칙이 사는 자리인데 `posts.ts:148`의 삼항식 안에 숨어 있었다. 3분기가 되면 중첩 삼항이 되므로 이름 있는 함수로 꺼낸다. 테스트도 이 함수를 직접 겨눌 수 있다.

**Rationale (모듈 위치)**: `cli-format.ts`는 "DB를 import하지 않는 순수 모듈"이다. `public-user.ts`는 `@/db/schema`에서 타입만 가져오므로(`import type`, 런타임 소거) 이 성질을 깨지 않는다.

**Alternatives considered**:
- `posts.ts`에서 타입을 export하고 `cli-format.ts`가 가져오기 → 기각. CLI 포매터가 DB를 아는 모듈에 의존하는 방향이 생긴다. 타입만이라도 의존 방향은 남는다.
- 통합하지 않고 두 곳을 각각 수정 → 기각. 이번엔 되지만 같은 수정이 세 번째로 돌아온다.

## R6. 페르소나 단일 정의

**Decision**: `src/lib/personas.ts`(DB 비의존)에 `Record<string, { label: string; githubId: string; login: string; campus: Campus }>` 형태로 4종을 정의한다. `src/lib/auth.ts`가 세션 해석에, `src/components/MockAuthModal.tsx`가 버튼 생성에 같은 정의를 읽는다. 키 존재 검사(`persona in PERSONAS`)를 쓰는 `/api/mock-auth`도 그대로 동작한다.

**Rationale**: 목록이 `auth.ts:15`(`PERSONAS`)와 `MockAuthModal.tsx:7`(`PERSONA_BUTTONS`)에 각각 하드코딩돼 있어 4종으로 늘리면 두 곳을 고쳐야 한다. `auth.ts`는 `@/db`를 런타임 import하므로 클라이언트 컴포넌트가 직접 읽을 수 없다 — 분리가 선택이 아니라 제약이다. `Record`를 유지하면 라우트의 키 검사 코드를 바꾸지 않아도 된다.

**Alternatives considered**:
- 배열로 정의 → 기각. `/api/mock-auth`의 `persona in PERSONAS` 검사를 `find`로 바꿔야 해서 변경 범위가 넓어진다.
- 페르소나 라벨을 모달에 남기고 데이터만 공유 → 기각. 페르소나를 더할 때 여전히 두 곳을 고친다.

## R7. 개설 입력의 장소 분류 범위

**Decision**: `src/lib/validation.ts`의 입력 열거형은 `['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']`로 유지한다. DB 열거형만 5값이 된다. `OFFLINE_ETC`를 보낸 개설 요청은 기존 Zod 검증이 그대로 400으로 거부한다.

**Rationale**: `OFFLINE_ETC`는 "작성자 캠퍼스가 비어 있어 서버가 파생한 값"이라는 의미를 갖는다. 유저가 직접 고를 수 있으면 그 의미가 사라지고, 캠퍼스가 있는 유저도 `OFFLINE_ETC` 글을 만들 수 있게 된다. `docs/designs/create_study.html`에는 장소 분류 선택 UI 자체가 없다(확인함) — 입력 범위를 넓힐 UX 근거도 없다.

**Guard**: "입력 enum은 4종" 자체를 테스트로 고정한다. 열거형 추가 작업 중 양쪽을 함께 늘리는 실수를 막는다.

**Alternatives considered**:
- 입력 enum도 5값으로 통일 → 기각. 위 이유. "DB 열거형 = 입력 열거형"이라는 습관이 만드는 사고다.

## R8. 응답 필드 이름 전환 방식

**Decision**: 투영 필드 `intraId`를 `login`으로 **단방향 교체**한다. 두 필드를 병행 노출하지 않는다. 과거 스펙의 계약 문서(`specs/002-*/contracts/posts-get.md` 등 5건)는 그 Phase의 스냅샷으로 남기고, 이 전환의 델타는 `contracts/public-user.md`가 갖는다. API 명세의 최종 권위는 `docs/trd.md` §4다(CLAUDE.md §1).

**Rationale**: 이 응답을 읽는 클라이언트가 아직 없다 — 화면은 Phase 3(`006-dashboard-realtime`)에서 처음 포팅되고, 유일한 소비자인 CLI 포매터는 같은 PR에서 함께 고친다. 과도기 비용이 0이므로 병행 노출은 "같은 값을 가리키는 이름 2개"를 계약에 영구히 남기는 손해만 남는다.

**Alternatives considered**:
- `intraId`를 deprecated로 남기고 `login` 추가 → 기각. 제거 시점을 정할 주체가 없어 영구화된다.
- 과거 계약 문서 5건을 직접 수정 → 기각. 완료된 Phase의 산출물을 소급 수정하면 그 Phase에서 무엇을 합의했는지 추적할 수 없다.

## R9. `login` 유일 제약의 장기 위험

**Decision**: `UNIQUE NOT NULL`을 그대로 적용한다(req FR-016). 다만 Phase 4의 "GitHub 핸들 선점 충돌"을 알려진 위험으로 기록한다.

**Rationale**: 시나리오 — 유저 A가 GitHub 핸들을 `foo`에서 `bar`로 바꾸고 재로그인하지 않은 상태에서, 다른 유저 B가 GitHub에서 `foo`를 차지해 로그인한다. B의 Upsert는 `login = 'foo'`를 쓰려 하지만 A의 행이 아직 `foo`를 들고 있어 유일 제약을 위반한다. 이 전환 시점에는 OAuth 경로가 없어 발현하지 않는다. 되돌리는 비용은 유일 인덱스 1개 제거(전진 마이그레이션, 데이터 손실 없음)로 작다.

**Deferred to**: Phase 4 `FR-015` 스펙. 해결 후보는 ① 충돌 시 기존 행의 `login`을 GitHub에서 재조회해 갱신 ② `login`의 유일 제약 해제 후 표시 충돌을 UI에서 처리. 이 브랜치에서 결정하지 않는다.
