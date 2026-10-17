# Implementation Plan: Phase 0 — 기반 인프라 & Mock 인증

**Branch**: `001-foundation-mock-auth` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-foundation-mock-auth/spec.md`

## Summary

Phase 0은 이후 모든 Phase의 토대를 놓는다. 세 가지를 제공한다: (1) 개발 환경 전용 Mock
인증(페르소나 쿠키 세팅 + `getCurrentUser()` + 플로팅 모달), (2) `users`/`posts`/
`participants` Drizzle 스키마와 마이그레이션, (3) 개발 도구(Vitest, zod, drizzle.config,
vitest.config, `DATABASE_URL`). 기술 접근은 `docs/trd.md` §2.1·§3.2와 CLAUDE.md §6.1을
그대로 따른다. Mock 인증의 상용 차단(`NODE_ENV === 'development'` 가드, 서버+클라이언트
양쪽)이 이 Phase의 핵심 보안 불변식이다.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 14.2.35 (App Router), React 18

**Primary Dependencies**: 설치 완료 — `drizzle-orm` 0.45, `drizzle-kit` 0.31, `postgres`
3.4, `@supabase/ssr`, `@supabase/supabase-js`. 추가 설치 필요 — `zod`(입력 검증),
`vitest`(테스트 러너). (pnpm 전용. `npm`/`npx` 금지.)

**Storage**: Supabase PostgreSQL. Drizzle ORM으로 접근. 접속 문자열은 `DATABASE_URL`.

**Testing**: Vitest. Docker 없이 `.env.local`의 `DATABASE_URL`로 실제 Supabase에 붙는다.
테스트 간 격리는 트랜잭션 롤백(공용 인스턴스이므로 TRUNCATE 금지).

**Target Platform**: Vercel (Linux). API Route Handler는 Node 런타임.

**Project Type**: Web application — Next.js 풀스택 단일 프로젝트.

**Performance Goals**: Phase 0은 성능 임계 로직이 없다. Mock 페르소나 전환은 1회 클릭 후
즉시 페이지 갱신.

**Constraints**: Mock 인증 엔드포인트와 모달은 `NODE_ENV === 'development'`에서만 동작
(서버+클라이언트 양쪽 차단). `getCurrentUser()`는 쿠키 없거나 손상 시 `guest`로 간주하고
예외를 던지지 않는다.

**Scale/Scope**: 42 카뎃 대상 소규모 커뮤니티. Phase 0 산출물은 토대이며 사용자 트래픽
임계값이 없다.

## Constitution Check

*GATE: Phase 0 research 전 통과 필수. Phase 1 design 후 재확인.*

| 원칙 | 적용 | 판정 |
| :--- | :--- | :--- |
| I. 사양 주도·테스트 우선 | 로직 있는 부분(`getCurrentUser()` 쿠키 파싱, dev-only 가드, 알 수 없는 페르소나 거부)은 Vitest 단위 테스트를 먼저 쓴다. 스키마 정의는 로직이 없어 TDD 비대상. | PASS |
| II. 문서 SSOT 우선 | 스키마는 `trd.md` §3.2, Mock 아키텍처는 `trd.md` §2.1, 불변식은 CLAUDE.md §7에서 가져온다. `schema.ts`와 `trd.md` §3.2는 같은 PR에서 일치. | PASS |
| III. 도메인 불변식 고정 | enum·컬럼을 trd §3.2 값 그대로 정의. `participant_status`의 `LEFT`/`REMOVED`는 스키마에만 두고 로직 미구현. | PASS |
| IV. 동시성·상태 머신 무결성 | 참여 트랜잭션·상태 머신은 Phase 1 범위. Phase 0은 `FOR UPDATE`가 가능한 DB 토대만 놓는다. | PASS (해당 로직 없음) |
| V. 보안 경계·링크 가시성 | Mock dev-only 가드가 Phase 0 핵심 보안 항목(US2/FR-004). `chat_url` 마스킹은 Phase 1. | PASS |

위반 없음 → Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/001-foundation-mock-auth/
├── plan.md              # 이 파일
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── mock-auth.md     # /api/mock-auth 계약
├── checklists/
│   └── requirements.md  # /speckit-specify 산출물
└── tasks.md             # /speckit-tasks 산출물 (이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schema.ts            # Drizzle 스키마 (원본: trd.md §3.2)
│   └── index.ts             # postgres 클라이언트 + drizzle 인스턴스
├── lib/
│   ├── auth.ts              # getCurrentUser() 세션 추상화 + dev-only 가드
│   └── errors.ts            # AppError 및 HTTP 매핑 (토대)
├── app/
│   └── api/
│       └── mock-auth/
│           └── route.ts     # 페르소나 쿠키 세팅/삭제 (dev-only)
└── components/
    └── MockAuthModal.tsx    # 플로팅 모달 (dev-only 렌더)

drizzle/                     # drizzle-kit generate 마이그레이션 산출물
drizzle.config.ts            # drizzle-kit 설정
vitest.config.ts             # Vitest 설정 (DATABASE_URL 로드)
tests/
├── setup/
│   └── db.ts                # 트랜잭션 롤백 격리 헬퍼
├── lib/
│   └── auth.test.ts         # getCurrentUser 파싱 + guest 폴백 + dev 가드
└── api/
    └── mock-auth.test.ts    # 페르소나 세팅, 알 수 없는 값 거부, 상용 차단
```

**Structure Decision**: Next.js App Router 단일 프로젝트. CLAUDE.md §3 디렉터리 규약을
그대로 따른다. 프론트(컴포넌트)와 백엔드(Route Handler)가 한 트리에 공존하므로 별도
backend/frontend 분리를 두지 않는다.

## Complexity Tracking

위반 없음.
