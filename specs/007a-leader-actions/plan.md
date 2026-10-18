# Implementation Plan: 리더 기본 액션 상세 모달 결합 (007a)

**Branch**: `007a-leader-actions` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007a-leader-actions/spec.md`

## Summary

Phase 3의 `007` 작업을 진입 조건 기준으로 분할한 첫 번째 브랜치(`007a`)다 (`docs/next-steps.md` §3.3). 상세 모달(`PostDetailModal` / `LeaderActions`)에서 리더 본인이 수행하는 기본 액션 3종 — **수동 마감/재모집 토글(`FR-004`)**, **게시글 수정(`FR-006`)**, **모집 중도 취소(`FR-005`)** — 을 완성한다.

기술 접근:
1. **순수 파생·직렬화 분리 (`src/lib/leader-actions.ts`)**: 리더 액션 노출·활성 조건(`leaderActionStateOf`)과 수정 폼 패치 생성(`buildUpdatePatch`)을 순수 함수로 분리해 TDD로 먼저 검증한다 (research R1~R3, R5).
2. **서버 검증 보강 (`src/lib/validation.ts`)**: `cancelSchema`에 `.trim()`을 추가해 공백 사유를 서버 레벨에서도 차단한다 (research R4).
3. **UI 결합 (`src/components/detail/LeaderActions.tsx`, `PostDetailModal.tsx`)**: 수동 마감/재모집 토글 버튼(`POST /api/posts/:id/status`)을 추가하고, `CLOSED` 상태의 수정 비활성화·정원 도달 시 재모집 비활성화·설명/장소 `null` 초기화를 반영한다.
4. **SSOT 동기화 (`docs/requirement.md`)**: `FR-021`에 `007a`/`007b` 분할 명세를 반영한다.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 14.2.35 App Router (React 18)

**Primary Dependencies**: 기존 설치분만 사용 (Tailwind CSS, Zod, Vitest). **신규 의존성 0개.**

**Storage**: Supabase PostgreSQL. **스키마 변경 없음** — 마이그레이션 생성 안 함.

**Testing**: Vitest 단위/통합 테스트 (`tests/lib/leader-actions.test.ts`, `tests/lib/validation.test.ts` 및 기존 전체 테스트).

**Target Platform**: 웹 브라우저 (데스크톱 및 375px 이상 모바일 반응형).

**Project Type**: 단일 Next.js 웹 애플리케이션.

**Constraints**:
- 수정은 `status === 'RECRUITING'`일 때만 가능 (`FR-006`).
- `COMPLETED` / `CANCELLED`는 최종 상태이며 역전 불가 (`NFR-003`).
- 완주 판정 및 회고 등록 화면(`007b`) 입구는 본 브랜치에서 노출하지 않는다 (`FR-021`).

**Scale/Scope**: 신규 파일 2개 (`src/lib/leader-actions.ts`, `tests/lib/leader-actions.test.ts`), 수정 파일 5개 (`src/lib/validation.ts`, `tests/lib/validation.test.ts`, `src/components/detail/LeaderActions.tsx`, `src/components/detail/PostDetailModal.tsx`, `docs/requirement.md`), `specs/007a-leader-actions/` 산출물.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| I. 사양 주도 · 테스트 우선 | PASS | `spec.md` → `plan.md` → `tasks.md` → `implement` 순서 준수. `leader-actions.test.ts` 및 `validation.test.ts`를 먼저 Red로 작성한 뒤 구현(Green)한다 |
| II. 문서 SSOT 우선 | PASS | `docs/next-steps.md`의 007a/007b 분할 결정을 `docs/requirement.md` `FR-021`에 함께 반영해 SSOT를 일치시켰다 |
| III. 도메인 불변식 고정 | PASS | 제목 40자·설명 300자·`chat_url` 화이트리스트·온라인/병행 조건부 필수·`RECRUITING` 전용 수정 규칙을 그대로 따른다 |
| IV. 동시성 · 상태 머신 무결성 | PASS | 백엔드의 `FOR UPDATE` 행 락 기반 `toggleStatus`, `updatePost`, `cancelPost`를 그대로 호출하고, 프론트에서도 정원 도달·최종 상태·만료 파티의 무효 전이를 사전 차단한다 |
| V. 보안 경계 · 링크 가시성 | PASS | 리더 액션 UI는 `role === 'leader'`일 때만 렌더하고, 실제 권한 검증은 Route Handler의 `post.leaderId === user.id`가 수행한다 (`FR-017`) |

위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/007a-leader-actions/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── leader-actions.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── leader-actions.ts              # [신규] leaderActionStateOf, buildUpdatePatch
│   └── validation.ts                  # [수정] cancelSchema .trim() 추가
└── components/
    └── detail/
        ├── LeaderActions.tsx          # [수정] 마감/재모집 토글 결합, 상태별 활성 제어, 패치 직렬화 연결
        └── PostDetailModal.tsx        # [수정] LeaderActions에 role·now 전달

tests/
└── lib/
    ├── leader-actions.test.ts         # [신규] 리더 액션 상태 파생 및 수정 패치 직렬화 단위 테스트
    └── validation.test.ts             # [수정] cancelSchema 공백 사유 거부 테스트 추가
```

**Structure Decision**: 기존 `CLAUDE.md` §3 디렉터리 규약을 그대로 따른다. 신규 디렉터리 없음.

## Complexity Tracking

위반 없음.
