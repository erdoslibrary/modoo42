# Implementation Plan: 코어 모집 & 참여 루프 (Phase 1)

**Branch**: `002-recruit-join-core` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-recruit-join-core/spec.md`

## Summary

스터디/단기 파티 개설(리더 자동 참여)·원클릭 참여(트랜잭션 + 행 락 동시성 방어)·정원 자동 마감·리더 수동 마감 토글·수정·취소로 이어지는 모집 핵심 루프를 구현한다. 도메인 로직을 Route Handler와 분리된 순수 서비스 함수(`src/lib/posts.ts`)로 두고, `chat_url` 화이트리스트·상태 머신·링크 가시성은 서버 Zod/서비스에서 최종 방어한다. DB 스키마는 Phase 0에서 완성되어 있어 마이그레이션은 없다. TDD로 Test Suite 1·2 + TC-LEADER-01/TC-CANCEL-01을 먼저 작성한다.

## Technical Context

**Language/Version**: TypeScript 5.x / Node (Next.js 14 App Router)

**Primary Dependencies**: Drizzle ORM, `postgres` 드라이버, Zod, Vitest. (전부 Phase 0에서 설치됨)

**Storage**: Supabase PostgreSQL. 스키마(`users`/`posts`/`participants`)는 Phase 0 완성. **Phase 1 추가는 `posts.cancel_reason text` 1개(FR-005 취소 사유 저장, data-model 참고) → `schema.ts` + trd §3.2 동반 수정 + 마이그레이션 1건.** 그 외 컬럼 변경 없음.

**Testing**: Vitest. `.env.local`의 `DATABASE_URL`로 실제 Supabase에 접속, 트랜잭션 롤백으로 격리(TRUNCATE 금지).

**Target Platform**: Vercel (Next.js Route Handlers)

**Project Type**: Web (Next.js 단일 앱). Phase 1은 서버(API + 도메인)만. UI는 Phase 3.

**Performance Goals**: 정원 1자리 10개 병렬 Join 시 초과 0건(NFR-001).

**Constraints**: 서버 Zod가 최종 방어선. `chat_url` 비참여자 마스킹. 상태 머신 역전 불가.

**Scale/Scope**: Phase 1 FR-001~013, SC-001~006. 엔드포인트 6종.

## Constitution Check

*GATE: Phase 0 research 전 통과 필수. Phase 1 design 후 재검증.*

| 원칙 | 준수 방법 | 상태 |
| :--- | :--- | :--- |
| I. 사양 주도·테스트 우선 (NON-NEGOTIABLE) | 본 plan은 specify 산출물 위에 작성. 도메인 로직(Join/상태머신/권한)은 TDD, `describe`/`it`에 TC ID(`TC-JOIN-02`, `TC-RACE-01` 등) 사용. 커버리지 90%+. | ✅ |
| II. 문서 SSOT 우선 | 스키마 `cancel_reason` 추가는 `schema.ts`+trd §3.2 동반 수정. FR-004 토글 엔드포인트가 trd §4 표에 없다 → 같은 PR에서 trd §4에 행 추가(research R5). | ⚠️ trd §3.2·§4 보강 필요 |
| III. 도메인 불변식 고정 | `title`≤40, `description`≤300, `tags`≤3, `max_members` 2~10/기본10, `chat_url` 화이트리스트, `end_date` 자동 산출을 CLAUDE.md §7 값 그대로 Zod에 고정. `LEFT`/`REMOVED` 미구현. | ✅ |
| IV. 동시성·상태 머신 무결성 | Join은 `db.transaction()` + `.for('update')`, trd §4.1 순서 그대로. `RECRUITING↔CLOSED`, `→CANCELLED`(최종). `COMPLETED` 전이는 Phase 2. | ✅ |
| V. 보안 경계·링크 가시성 | 비참여자 상세 응답에서 `chat_url` 필드 제외. 리더 전용 액션은 Route Handler `session.user.id === post.leaderId` 검증. RLS는 Phase 4. | ✅ |

**Gate 판정**: 통과. ⚠️ 1건은 doc 보강 작업으로 tasks에 명시(코드 설계 차단 아님).

## Project Structure

### Documentation (this feature)

```text
specs/002-recruit-join-core/
├── plan.md              # 이 파일
├── research.md          # Phase 0 결정 기록
├── data-model.md        # 엔티티·검증·상태 전이
├── quickstart.md        # 검증 실행 가이드
├── contracts/           # API 계약 (엔드포인트별)
│   ├── posts-create.md
│   ├── posts-get.md
│   ├── posts-list.md
│   ├── posts-update.md
│   ├── posts-join.md
│   ├── posts-cancel.md
│   └── posts-status.md
└── tasks.md             # /speckit-tasks 산출 (아직 없음)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schema.ts          # (변경 없음)
│   └── index.ts           # (변경 없음)
├── lib/
│   ├── auth.ts            # getCurrentUser() 재사용
│   ├── errors.ts          # AppError 재사용
│   ├── validation.ts      # [신규] Zod 스키마 (chat_url 화이트리스트, 개설/수정 입력)
│   ├── end-date.ts        # [신규] 정규 스터디 end_date 자동 산출
│   └── posts.ts           # [신규] 도메인 서비스 (create/join/update/cancel/toggleStatus/getDetail/list)
└── app/api/posts/
    ├── route.ts                 # [신규] GET(list) + POST(create)
    └── [id]/
        ├── route.ts             # [신규] GET(detail) + PUT(update)
        ├── join/route.ts        # [신규] POST
        ├── cancel/route.ts      # [신규] POST
        └── status/route.ts      # [신규] POST (수동 마감/재모집 토글)

tests/
├── posts-create.test.ts   # TC-POST-01~04
├── posts-join.test.ts     # TC-JOIN-01~03, TC-RACE-01
├── posts-leader.test.ts   # TC-LEADER-01, TC-CANCEL-01, 상태머신 차단
└── helpers/
    └── db.ts              # 트랜잭션 롤백 격리 헬퍼
```

**Structure Decision**: Next.js 단일 앱. Route Handler는 얇게(인증·입력 파싱·에러 매핑), 도메인 로직은 `src/lib/posts.ts` 순수 함수에 두고 `tx`/`db` 주입 가능하게 해 Vitest에서 트랜잭션 롤백으로 테스트한다(`auth.ts`의 `DbLike` 주입 패턴 답습). route.ts의 공통 에러 매핑은 `toErrorResponse()` 재사용.

## Complexity Tracking

> 위반 없음. 비워 둠.
