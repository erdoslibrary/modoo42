# Implementation Plan: 개발자 콘솔 — 시각 주입 및 샌드박스 격리 (010)

**Branch**: `010-dev-console` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-dev-console/spec.md`

## Summary

시각에 걸린 요구사항(`FR-008` 판정창, `FR-011` LIVE 만료·1일 1회, `FR-018` Grace Period, `FR-020` 파티 만료)을 달이 바뀌기를 기다리지 않고 검증하기 위한 개발 전용 하네스를 만든다. 범위는 네 덩어리다.

1. **시각 소유권 단일화** — `src/lib/clock.ts`가 `serverNow()`·`realNow()`를 소유한다. 도메인 함수에서 `now` 기본값을 걷어내고, 유일한 비주입 함수 `createPost`에 `now`를 신설한다. 레코드 타임스탬프도 유효 시각으로 명시 삽입한다.
2. **콘솔 패널** — 인증 · 시계 · 시나리오 3섹션. `MockAuthModal`을 흡수·삭제하고 게이트를 `DEV_CONSOLE_PASSWORD` 하나로 합친다.
3. **샌드박스 격리** — 같은 데이터베이스 안의 `dev_sandbox` 스키마. 콘솔 세션 쿠키가 있는 브라우저의 모든 읽기·쓰기가 그 스키마를 본다.
4. **재생·스냅샷 도구** — `pnpm sandbox:sync`가 스키마를 재생하고, 콘솔 진입이 비우기 + 스냅샷(`chat_url` 마스킹)을 수행한다.

기술 접근의 핵심은 **기본값 제거로 누락을 타입 오류로 바꾸는 것**이다. `now`뿐 아니라 `database` 기본값도 함께 걷어낸다 — 콘솔 세션에서 핸들을 빠뜨리면 운영 테이블에 쓰게 되고, 그것이 이 기능에서 가장 비싼 실패다 (`research.md` R1). 그 대가로 호출부 약 217곳을 손보지만 대부분은 이미 `tx`를 넘기는 테스트다.

새 자원은 0개다. 스키마 1개와 쿠키 2개, 라우트 2개가 늘고 `public` 스키마 마이그레이션은 0건이다.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Next.js 14.2.35 (App Router)

**Primary Dependencies**: Drizzle ORM + `postgres`(두 번째 인스턴스를 `search_path=dev_sandbox`로 만든다), `@supabase/ssr`·`@supabase/supabase-js`(구독 스키마만 분기), `zod`(콘솔 입력 검증), `dotenv`(재생 스크립트의 `.env.local` 로드). **새 의존성 0개** — `tsx`가 저장소에서 제거됐으므로 재생 스크립트는 `.mjs`로 쓴다 (`research.md` R7).

**Storage**: Supabase PostgreSQL 단일 인스턴스. 스키마 2개(`public` 운영, `dev_sandbox` 콘솔). `public` 대상 마이그레이션 0건. `dev_sandbox`는 `drizzle/`의 기존 SQL을 재생해 만들고 `drizzle-kit`이 관리하지 않는다.

**Testing**: Vitest (`environment: node`). 순수 함수 단위(프리셋 산출·오프셋 왕복·게이트 분기)와 실제 DB 통합(스냅샷 마스킹·스키마 단정·표식·운영 테이블 불변)을 나눈다. 환경변수 분기는 `vi.stubEnv` + `vi.resetModules`로 모듈을 다시 읽는다.

**Target Platform**: 브라우저 + Vercel Node 런타임. 콘솔은 Preview·Development 스코프에서만 열린다.

**Project Type**: Web application (Next.js 단일 앱)

**Performance Goals**: 콘솔 진입(비우기 + 스냅샷)은 단일 트랜잭션 1회로 끝난다. `NFR-004`의 1초 이내 실시간 반영은 샌드박스에서도 유지한다.

**Constraints**:
- `FR-005` — 도메인 레이어가 쿠키를 읽지 않는다. 쿠키를 읽는 모듈은 `clock.ts`·`dev/console-session.ts`·`dev/sandbox.ts` 3개뿐이다.
- `FR-009` — 상용 차단은 `clock.ts` 한 곳. 오프셋 반영 조건은 `DEV_CONSOLE_PASSWORD` 설정 **그리고** 유효한 `modoo42_dev_console` 서명 쿠키다.
- `FR-017` — 파괴적 문장은 항상 스키마를 수식하고 실행 전 상수와 대조해 단정한다.
- `FR-024` — `public` 스키마와 API 응답 계약 불변.
- 게이트가 닫힌 환경에서는 쿠키를 **아예 읽지 않는다** — 그래야 루트 레이아웃이 상용에서 정적으로 남는다 (`research.md` R10).

**Scale/Scope**: 신규 파일 12개, 삭제 1개(`MockAuthModal.tsx`), 수정 파일 약 25개. 도메인 호출부 약 217곳의 인자 보강(대부분 테스트). 요구사항 26개(`FR-001`~`FR-026`), 인수 테스트 12개(`TC-DEV-01`~`TC-DEV-12`).

## Constitution Check

*GATE: Phase 0 전에 통과해야 하고 Phase 1 설계 후 재확인한다.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| **I. 사양 주도 · 테스트 우선** | PASS | `spec.md` → 본 `plan.md` → `tasks.md` → `implement`. `TC-DEV-01`·`02`·`12`(프리셋·오프셋·타임스탬프)와 `TC-DEV-05`~`09`(샌드박스)는 TDD로 간다 — 특히 `TC-DEV-06`(대상 스키마 단정)은 파괴적 코드를 쓰기 **전에** 실패 테스트를 둔다. 테스트 제목에 `requirement.md` §3의 ID를 그대로 쓴다 |
| **II. 문서 SSOT 우선** | PASS | 설계 원본은 `trd.md` §2.4, 결정 근거는 `next-steps.md` §4.0이다. 이 계획은 그 둘을 가리키고 값을 복사하지 않는다. `speckit-specify`에서 추가된 결정 2건과 누락됐던 타임스탬프 승인은 같은 작업에서 `requirement.md`·`trd.md`·`prd.md`·`CLAUDE.md`에 기입했다 |
| **III. 도메인 불변식 고정** | PASS | 입력 제약·정책 규칙을 바꾸지 않는다. 새로 고정하는 불변식 2개(`serverNow()` 단일 소스, 샌드박스 쓰기 격리)는 이미 `CLAUDE.md` §7.2에 등재돼 있다 |
| **IV. 동시성 · 상태 머신 무결성** | PASS | 참여 트랜잭션의 `.for('update')`와 상태 머신을 건드리지 않는다. 샌드박스는 **스키마만 다른 같은 코드 경로**이므로 `NFR-001`이 그대로 성립한다 — 메모리 보관을 택하지 않은 이유다 (`trd.md` §2.4-4) |
| **V. 보안 경계 · 링크 가시성** | PASS | 스냅샷이 `chat_url`을 비우고(FR-016), 샌드박스 쪽에도 컬럼 단위 SELECT 권한을 복제한다(FR-018). 콘솔 자체가 인증·시각 우회 도구이므로 게이트를 **하나로** 합쳐 검증 경로를 줄였다(FR-008~FR-011). 게이트가 닫히면 라우트는 404, 패널은 미렌더, 오프셋은 미반영이다 |
| **기술 제약 · 디자인 규율** | PASS | 패널은 기존 `MockAuthModal`의 네오브루탈리즘 스타일을 잇고 새 시각 요소를 들이지 않는다. pnpm만 쓴다. 새 의존성 0개 |
| **개발 워크플로우** | PASS | `main` 직접 커밋 없음. `feat:`/`test:`/`docs:` Conventional Commits. 한국어 제목 |

**위반 없음.** Complexity Tracking은 비워 둔다.

### Phase 1 설계 후 재확인

| 원칙 | 재판정 | 비고 |
| :--- | :--- | :--- |
| I | PASS | `contracts/dev-console-api.md` C7이 12개 TC의 단정 방식을 고정했다 |
| II | PASS | Phase 1에서 생긴 새 값은 TTL 2시간(`data-model.md` §3)과 라우트 4개뿐이고, 둘 다 이 계획과 `contracts/`에만 둔다 |
| III | PASS | 변동 없음 |
| IV | PASS | `research.md` R11이 채널 수가 여전히 동시 1개임을 확인했다 |
| V | PASS | `contracts/sandbox-isolation.md` S4(마스킹)·S5(권한 복제)·S6(단정)이 세 방어선을 각각 계약으로 고정했다 |
| 디자인 규율 | PASS | 새 색·모션·글리프 0건 |

## Project Structure

### Documentation (this feature)

```text
specs/010-dev-console/
├── spec.md
├── plan.md                        # 이 파일
├── research.md                    # Phase 0 — 설계 결정 13건
├── data-model.md                  # Phase 1 — 쿠키 2종, 샌드박스 스키마, 표식 테이블, 프리셋
├── quickstart.md                  # Phase 1 — 수동 검증 절차
├── contracts/
│   ├── dev-console-api.md         # 라우트 4개 + 게이트 계약
│   └── sandbox-isolation.md       # 재생·스냅샷·권한·단정 계약
├── checklists/requirements.md
└── tasks.md                       # Phase 2 (speckit-tasks 산출물)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── clock.ts                   # 신규. serverNow() / realNow() / serverOffsetMs()
│   ├── dev/
│   │   ├── console-session.ts     # 신규. 게이트 판정 + HMAC 서명 쿠키 발급·검증
│   │   ├── sandbox.ts             # 신규. requestDatabase() + 샌드박스 drizzle 인스턴스
│   │   ├── snapshot.ts            # 신규. 비우기 + 스냅샷 + 표식 (파괴적 SQL 단정 포함)
│   │   └── presets.ts             # 신규. 시나리오 프리셋 순수 함수
│   ├── posts.ts                   # 수정. database·now 기본값 제거, createPost에 now 신설, 타임스탬프 명시 삽입
│   ├── leader-actions.ts          # 수정. now 기본값 제거 (2곳)
│   ├── session.ts                 # 수정. verifySessionToken의 now 기본값 제거 (호출부가 realNow() 주입)
│   └── auth.ts                    # 수정. DbLike 주입 경로 정리, 게이트를 콘솔 게이트로 교체
├── app/
│   ├── layout.tsx                 # 수정. MockAuthModal 마운트를 DevConsole + ClockProvider로 교체
│   ├── api/dev/console/route.ts   # 신규. POST 진입 / DELETE 종료
│   ├── api/dev/clock/route.ts     # 신규. POST 이동 / DELETE 복귀
│   ├── api/mock-auth/route.ts     # 수정. 게이트 교체
│   └── (dashboard|create|profile|api/**)  # 수정. requestDatabase() + serverNow() 주입
├── components/
│   ├── MockAuthModal.tsx          # 삭제
│   └── dev/
│       ├── DevConsole.tsx         # 신규. 패널 3섹션
│       ├── ClockProvider.tsx      # 신규. 클라이언트 오프셋 Context
│       └── ConsoleEntry.tsx       # 신규. /login의 개발 전용 입구
├── hooks/useRealtimePosts.ts      # 수정. 구독 스키마를 인자로 받는다
└── db/index.ts                    # 수정 없음 (샌드박스 인스턴스는 dev/sandbox.ts가 소유)

scripts/
└── sandbox-sync.mjs               # 신규. pnpm sandbox:sync — dev_sandbox 재생 + 권한 + publication

tests/
├── dev-clock.test.ts              # 신규. TC-DEV-01·02·03·04·10
├── dev-sandbox.test.ts            # 신규. TC-DEV-05·06·07·09·11
└── dev-timestamps.test.ts         # 신규. TC-DEV-08·12
```

**Structure Decision**: 기존 `src/lib` + `src/app/api` + `src/components` 구조를 그대로 쓰고, 개발 전용 코드만 `src/lib/dev/`와 `src/components/dev/` 두 디렉터리로 모은다. 상용에서 죽어야 하는 코드가 한자리에 모여 있으면 게이트 누락을 눈으로 확인할 수 있다. `src/lib/clock.ts`만 `dev/` 밖에 두는데, 상용에서도 `serverNow()`가 호출되는 정상 경로이기 때문이다.

## Complexity Tracking

> Constitution Check에 위반이 없으므로 비워 둔다.
