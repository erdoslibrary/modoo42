# Implementation Plan: LIVE 핑 & CLI 조회 (Phase 2 B)

**Branch**: `004-live-ping-cli` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-live-ping-cli/spec.md`

## Summary

LIVE 핑 생성(1일 1회, KST 자정 기준), 작성자 조기 완료, 목록 Lazy Filter, 비인증 CLI 조회(`GET /api/list`, ANSI/평문/JSON)를 구현한다. LIVE 핑은 기존 `posts` 컬럼에 매핑해 마이그레이션이 없다. 일일 제한 경합은 작성자 `users` 행 `FOR UPDATE`로 직렬화한다. Lazy Filter는 `listPosts` 한 곳에 두고 웹 목록과 CLI가 공유한다. 기존 쓰기 동작(참여·수정·취소·토글)에는 LIVE 차단 가드를 추가한다.

## Technical Context

**Language/Version**: TypeScript 5.x / Node (Next.js 14 App Router)

**Primary Dependencies**: Drizzle ORM, `postgres` 드라이버, Zod, Vitest. 신규 의존성 없음 (ANSI 출력은 SGR 코드 직접 작성).

**Storage**: Supabase PostgreSQL. `posts.expires_at`, `posts_live_ping_idx (type, status, expires_at)`, nullable `max_members`/`chat_url` 모두 기존. **마이그레이션 없음.**

**Testing**: Vitest. 실제 Supabase + 트랜잭션 롤백 격리(`withRollback`). 동시 생성 테스트는 기존 `createRacePool` 재사용.

**Target Platform**: Vercel (Next.js Route Handlers)

**Project Type**: Web (Next.js 단일 앱). 서버(API + 도메인)만. 전광판 UI는 Phase 3.

**Performance Goals**: 같은 유저 동시 생성 10건 → 정확히 1건 생성 (SC-002).

**Constraints**: 서버 Zod가 최종 방어선. LIVE `CLOSED`는 최종. CLI 응답에 `chat_url` 0건. 만료용 cron 없음.

**Scale/Scope**: spec FR-001~010, SC-001~005. 신규 엔드포인트 2종(`complete-ping`, `list`) + 기존 2종 확장(`POST`/`GET /api/posts`) + 기존 쓰기 4종 가드.

## Constitution Check

*GATE: Phase 0 research 전 통과 필수. Phase 1 design 후 재검증.*

| 원칙 | 준수 방법 | 상태 |
| :--- | :--- | :--- |
| I. 사양 주도·테스트 우선 | specify 산출물 위에 작성. 일일 제한·조기 완료 권한·LIVE 차단 가드·Lazy Filter는 TDD. `describe`/`it`에 TC-LIVE-01~04, TC-CLI-01 사용(이번 브랜치에서 `requirement.md` §3 Test Suite 4로 신설). | ✅ |
| II. 문서 SSOT 우선 | spec 단계에서 PRD의 "최근 24시간" 표현을 requirement 기준(KST 자정)으로 정정하고 TC ID를 추가했다. plan 단계에서 trd §4 표의 `complete-ping`(멱등)·`/api/list`(형식·노출 필드) 행을 보강했다. 스키마 변경 없음. | ✅ |
| III. 도메인 불변식 고정 | LIVE `text` 50자, 유효시간 4종, KST 자정 1일 1회, `max_members`·`chat_url` null을 CLAUDE.md §7 값 그대로 사용. 캠퍼스는 `location_type` 표기에만 쓰고 필터하지 않는다. | ✅ |
| IV. 동시성·상태 머신 무결성 | 일일 제한은 `users` 행 잠금 트랜잭션(R1). 조기 완료는 `posts` 행 잠금(R7). `RECRUITING → CLOSED`(최종), 재모집 차단(R6). 만료는 Lazy Filter, cron 없음(R8). | ✅ |
| V. 보안 경계·링크 가시성 | 목록·CLI는 `chat_url` 필드 자체 미포함(`listPosts` 기존 투영 재사용). `complete-ping`은 작성자 검증(403). 공개 CLI의 intra ID·위치 노출은 사용자 결정(R12). 터미널 제어 문자 제거(R11). | ✅ |

**Gate 판정**: 통과.

**Post-design 재검증**: 계약 4종·data-model 작성 후 재확인. 원칙 I~V 모두 ✅, 위반 없음. 잔여 위험: 비인증 `/api/list`는 Phase 4 Rate Limit 전까지 무제한 호출이 가능하다(R12).

## Project Structure

### Documentation (this feature)

```text
specs/004-live-ping-cli/
├── plan.md               # 이 파일
├── research.md           # Phase 0 결정 기록 (R1~R12)
├── data-model.md         # LIVE 핑 매핑·불변식·CLI 투영
├── quickstart.md         # 검증 실행 가이드
├── contracts/
│   ├── posts-create-live.md    # POST /api/posts (type: LIVE)
│   ├── posts-complete-ping.md  # POST /api/posts/:id/complete-ping
│   ├── posts-list-live.md      # GET /api/posts 증분 (Lazy Filter, expiresAt, LIVE 쓰기 차단)
│   └── cli-list.md             # GET /api/list
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks 산출 (아직 없음)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── end-date.ts        # [수정] kstDayRange(now) 추가 (R2)
│   ├── validation.ts      # [수정] createLivePingSchema(strict), createPostRequestSchema = STUDY/PARTY | LIVE 판별 유니온
│   ├── posts.ts           # [수정] createLivePing, completeLivePing, listForCli 추가
│   │                      #        listPosts: Lazy Filter·type LIVE·expiresAt·now 주입
│   │                      #        getPostDetail: expiresAt 추가
│   │                      #        joinPost/updatePost/cancelPost/toggleStatus: LIVE 가드
│   └── cli-format.ts      # [신규] renderCliText(data, { color, now }), 제어 문자 제거 (순수 함수)
└── app/api/
    ├── posts/route.ts                      # [수정] POST: type LIVE 분기 / GET: type=LIVE 허용
    ├── posts/[id]/complete-ping/route.ts   # [신규] POST 조기 완료
    └── list/route.ts                       # [신규] GET CLI 조회 (비인증)

tests/
├── posts-live.test.ts               # TC-LIVE-01~04, KST 경계, 동시 생성, LIVE 쓰기 차단
├── lib/end-date.test.ts             # [수정] kstDayRange 경계
├── lib/cli-format.test.ts           # 렌더링·남은 시간·D-Day·제어 문자 제거·0건
├── api/posts-complete-ping.test.ts  # 비로그인 403, 라우트 매핑
└── api/cli-list.test.ts             # TC-CLI-01: 비로그인 200, 형식 3종, chat_url 부재, format 400
```

**Structure Decision**: Phase 1·2 A와 같은 "얇은 Route Handler + `src/lib/posts.ts` 도메인 서비스" 패턴을 유지한다. LIVE 생성은 스터디·파티와 입력·불변식이 달라 `createPost`를 분기시키지 않고 별도 함수 `createLivePing`으로 둔다. Route는 `POST /api/posts` 하나를 유지하고 판별 유니온으로 나눈다(trd §4). CLI 텍스트 렌더링은 DB와 무관한 표현 책임이라 `src/lib/cli-format.ts` 순수 모듈로 분리한다.

## Complexity Tracking

> 위반 없음. 비워 둠.
