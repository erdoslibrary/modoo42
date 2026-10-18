# Implementation Plan: 유저 식별 스키마 전환 (Phase 3 선행)

**Branch**: `005-user-identity-schema` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-user-identity-schema/spec.md`

## Summary

`users`의 식별 체계를 42 Intra 단일 키에서 GitHub 2키(`github_id` 불변 매칭 키 + `login` 표시용)로 전환하고, 42 관련 3컬럼(`intra_id`·`campus`·`intra_verified_at`)을 "비어 있어도 되는" 상태로 내린다. `location_type`에 `OFFLINE_ETC`를 더해 캠퍼스 없는 작성자의 LIVE 핑을 받아낸다. 응답 계약 5건의 유저 투영을 `login` 기준으로 통일하고, 개발용 Mock 페르소나를 4종(캠퍼스 없는 1종 포함)으로 넓힌다.

기술 접근은 3갈래다. (1) 스키마·마이그레이션: Drizzle 생성 SQL을 "컬럼 추가 → 백필 → 제약 적용" 순으로 손 편집한다. (2) 도메인: 중복된 공개 유저 투영과 캠퍼스 파생 삼항식을 `src/lib/public-user.ts` 한 모듈로 모은다. (3) 계약: `publicUser` 한 곳을 고쳐 5개 응답이 동시에 `login`으로 바뀌게 한다.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 14 App Router (Node.js 런타임)

**Primary Dependencies**: Drizzle ORM + drizzle-kit, `postgres` 드라이버, Zod, Vitest

**Storage**: Supabase PostgreSQL **17.11** (실측). 접속은 `.env.local`의 `DATABASE_URL`

**Testing**: Vitest. 실제 Supabase에 붙어 트랜잭션 롤백으로 격리한다 (TRUNCATE 금지)

**Target Platform**: Vercel (Node 런타임), 로컬 개발 서버

**Project Type**: 웹 애플리케이션 단일 프로젝트 (Next.js App Router + Route Handlers)

**Performance Goals**: 이 전환은 성능 목표를 바꾸지 않는다. 참여 트랜잭션(NFR-001)과 Realtime 1초(NFR-004)는 기존 기준 유지

**Constraints**:
- 전환 대상 테이블에 기존 행이 있다 (실측 users 3 / posts 3 / participants 6). 필수 컬럼 추가는 백필 없이는 실패한다.
- `ALTER TYPE ... ADD VALUE`는 같은 트랜잭션 안에서 새 값을 **쓸 수 없다**. drizzle-orm 마이그레이터는 파일 단위로 트랜잭션을 건다.
- 열거형 값 추가는 전진 전용이다. 롤백 경로가 없다.
- `pnpm test`는 CI에 없다. PR 전 로컬 필수 게이트다 (NFR-006).

**Scale/Scope**: 변경 파일 약 15개(소스 8 + 테스트 6 + 마이그레이션 1), 문서 4개. 신규 모듈 2개(`public-user.ts`, `personas.ts`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| I. 사양 주도 · 테스트 우선 | PASS | spec.md 작성 완료. 이 plan 이후 tasks → implement 순서. 스키마 제약·파생 규칙·페르소나 해석은 TDD로 간다(Red 먼저). 테스트 제목에 `TC-IDENT-01~05`를 쓴다 |
| II. 문서 SSOT 우선 | PASS (조건부) | `trd.md` §3.2는 이미 목표 스키마다. 같은 PR에서 `requirement.md`(FR-000 페르소나 수, §3 TC-IDENT 신설), `trd.md` §2.1(페르소나 3종 → 4종), `next-steps.md`를 함께 고친다. 코드로 문서를 앞지르지 않는다 |
| III. 도메인 불변식 고정 | PASS | 입력 제약을 새로 만들지 않는다. 개설 입력의 장소 분류는 기존 4종 유지(FR-005a), `OFFLINE_ETC`는 서버 파생 전용. `avatar_url` 미수집 유지 |
| IV. 동시성 · 상태 머신 무결성 | PASS | 상태 머신과 트랜잭션 구조를 건드리지 않는다. LIVE 핑 생성 트랜잭션의 `.for('update')` 작성자 조회는 그대로 두고 파생식만 교체한다 |
| V. 보안 경계 · 링크 가시성 | PASS | `chat_url` 마스킹 로직 무변경. 응답에 `intra_id`·`intra_verified_at`을 싣지 않는다(FR-010). Mock 경로의 `NODE_ENV` 이중 차단 유지. 공개 엔드포인트(`/api/list`)의 노출 필드는 늘리지 않고 이름만 `login`으로 바꾼다 |

위반 없음. Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/005-user-identity-schema/
├── plan.md              # 이 파일
├── spec.md              # 완료
├── research.md          # Phase 0 산출물
├── data-model.md        # Phase 1 산출물
├── quickstart.md        # Phase 1 산출물
├── contracts/
│   ├── public-user.md       # 5개 응답의 유저 투영 델타
│   └── mock-auth-personas.md # 페르소나 4종 계약
├── checklists/requirements.md  # 완료
└── tasks.md             # Phase 2 (/speckit-tasks, 이 명령에서 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── db/
│   └── schema.ts              # users 식별 컬럼 전환, location_type 값 추가
├── lib/
│   ├── public-user.ts         # [신규] Campus 타입 · PublicUser 투영 · campusToLocationType
│   ├── personas.ts            # [신규] 페르소나 4종 정의 (DB 비의존, 클라이언트 안전)
│   ├── auth.ts                # PERSONAS를 personas.ts에서 읽고 github_id 기준 Upsert
│   ├── posts.ts               # publicUser 교체, LIVE 파생식 → campusToLocationType
│   ├── cli-format.ts          # leader 타입을 PublicUser로, 캠퍼스 없을 때 라벨 처리
│   └── validation.ts          # 개설 입력 장소 분류는 4종 유지 (변경 없음을 테스트로 고정)
├── components/
│   └── MockAuthModal.tsx      # 버튼 목록을 personas.ts에서 생성
└── app/api/
    ├── list/route.ts          # project()의 leader 필드 이름 교체
    ├── hall-of-fame/route.ts  # 변경 없음 (투영은 posts.ts가 소유)
    └── leaderboard/route.ts   # 변경 없음

drizzle/
└── 0002_*.sql                 # 손 편집: 컬럼 추가 → 백필 → NOT NULL·UNIQUE

tests/
├── identity-schema.test.ts    # [신규] TC-IDENT-01, TC-IDENT-03
├── lib/public-user.test.ts    # [신규] campusToLocationType 단위
├── posts-live.test.ts         # TC-IDENT-02 추가
├── lib/auth.test.ts           # TC-IDENT-05, 페르소나 4종
├── lib/cli-format.test.ts     # 캠퍼스 없는 작성자 라벨
├── api/cli-list.test.ts       # leader.login
├── leaderboard.test.ts        # login 타이브레이커
└── hall-of-fame.test.ts       # leader/completedMembers login
```

**Structure Decision**: 기존 단일 프로젝트 구조(CLAUDE.md §3)를 그대로 쓴다. 새 디렉터리를 만들지 않고 `src/lib/`에 모듈 2개를 더한다. 신설 근거는 "중복 제거"와 "클라이언트 안전성"이다 — 공개 유저 투영이 `posts.ts`와 `cli-format.ts`에 각각 있었고, 페르소나 목록이 `auth.ts`와 `MockAuthModal.tsx`에 각각 있었다. 후자는 `auth.ts`가 `@/db`를 import하므로 클라이언트 컴포넌트가 직접 읽을 수 없다는 제약 때문에 분리가 필수다.

## Phase 0: Research

산출물: [research.md](./research.md). 결정 9건(R1~R9)을 기록했다. 요지:

- R1 마이그레이션 3단 편집(추가 → 백필 → 제약)
- R2 열거형 값 추가와 사용을 같은 마이그레이션에 섞지 않는다
- R3 백필 값 규칙(`github_id = 'mock:' || intra_id`, `login = intra_id`)
- R4 `intra_id`는 유지하되 페르소나는 비운다
- R5 `src/lib/public-user.ts`로 투영·파생 통합
- R6 `src/lib/personas.ts`로 페르소나 단일 정의
- R7 개설 입력 enum은 4종 유지
- R8 응답 필드는 `login` 단방향 교체, 과거 계약 문서는 이 브랜치 contracts가 델타 SSOT
- R9 `login` 유일 제약은 유지하고 Phase 4 핸들 선점 충돌을 범위 밖 위험으로 명시

## Phase 1: Design & Contracts

산출물:

- [data-model.md](./data-model.md) — `users` 컬럼 전환표, `location_type` 값 추가, 백필 규칙, 제약 적용 순서, 영향 받는 쿼리 지점
- [contracts/public-user.md](./contracts/public-user.md) — 5개 응답(`posts-list`·`posts-get`·`cli-list`·`hall-of-fame`·`leaderboard`)의 유저 투영 델타와 CLI 텍스트 라벨 규칙
- [contracts/mock-auth-personas.md](./contracts/mock-auth-personas.md) — 페르소나 4종 키·라벨·식별자, Upsert 충돌 기준, 상용 차단
- [quickstart.md](./quickstart.md) — 마이그레이션 적용·검증 절차와 수동 확인 시나리오

### Constitution Re-check (post-design)

| 원칙 | 판정 | 설계 후 확인 |
| :--- | :--- | :--- |
| I | PASS | TC-IDENT-01~05가 테스트 파일에 1:1로 배치됐다. 신규 모듈 2개 모두 테스트 대상이다 |
| II | PASS | 설계가 `trd.md` §3.2와 동일한 스키마를 가리킨다. 문서 수정 4건을 tasks에 넣는다 |
| III | PASS | 입력 제약 불변. `OFFLINE_ETC`가 입력 enum에 새지 않도록 `validation.ts` 테스트로 고정한다 |
| IV | PASS | 트랜잭션·락·상태 전이 코드 경로 무변경 |
| V | PASS | 응답 노출 필드 수가 늘지 않는다(이름만 교체). `intra_id`는 어떤 투영에도 없다 |

## Complexity Tracking

위반 없음.
