# Implementation Plan: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Branch**: `007b-completion-lifecycle` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007b-completion-lifecycle/spec.md`

## Summary

Phase 3의 마지막 UI 브랜치(`007b`)로, `docs/designs/complete.html`(완주 벌크 판정 `FR-008`)과 `docs/designs/complete_postmortem.html`(Post-mortem 회고 등록 `FR-009`)을 Next.js React 컴포넌트로 포팅하고 상세 모달(`PostDetailModal` / `LeaderActions`)에 진입을 연결한다 (`FR-021`).

기술 접근:
1. **상세 조회 확장 및 보안 경계 유지 (`src/lib/view-types.ts`, `src/lib/posts.ts`)**: `PostDetail`에 `proofUrl`·`postmortemText`를 추가하고, 조회자가 리더 본인(`viewerId === post.leaderId`)일 때만 리더 제외 `JOINED` 참여자 목록(`verdictMembers: { userId, login, campus }[]`)을 내려준다. 일반 `participants` 배열(`PublicUser[]`)은 건드리지 않아 `TC-IDENT-04`를 100% 보존한다 (research R3).
2. **순수 상태 파생 및 페이로드 빌더 (`src/lib/leader-actions.ts`)**: 정규 스터디 판정 창(`computeVerdictWindow`), 팀원 수, 회고 기등록 여부에 따른 진입·탭 활성 상태(`completionActionStateOf`)와 제출 페이로드 검증(`buildCompletePayload`, `buildPostmortemPayload`)을 순수 함수로 분리해 TDD로 검증한다 (research R4).
3. **마무리 모달 포팅 및 상세 모달 결합 (`src/components/detail/CompletionModal.tsx`, `LeaderActions.tsx`, `PostDetailModal.tsx`)**: `complete.html`과 `complete_postmortem.html`을 네이티브 `<dialog>` 모달로 포팅해 팀원 완주 체크박스(기본 전원 체크) + 선택적 증빙 URL 제출(`POST /api/posts/:id/complete`)과 Post-mortem 회고 등록(`POST /api/posts/:id/postmortem`)을 연결하고, 상세 모달에서도 `proofUrl`과 `postmortemText`를 표출한다 (research R1, R2).
4. **진행 현황 동기화 (`docs/next-steps.md`)**: Phase 3의 4개 브랜치(`005`, `006`, `007a`, `007b`) 완료 상태를 반영한다.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 14.2.35 App Router (React 18)

**Primary Dependencies**: 기존 설치분만 사용 (Tailwind CSS, Drizzle ORM, Zod, Vitest). **신규 의존성 0개.**

**Storage**: Supabase PostgreSQL. **스키마 변경 없음** — 마이그레이션 생성 안 함.

**Testing**: Vitest 단위/통합 테스트 (`tests/lib/leader-actions.test.ts`, `tests/posts-detail.test.ts` 및 기존 전체 테스트).

**Target Platform**: 웹 브라우저 (데스크톱 및 375px 이상 모바일 반응형).

**Project Type**: 단일 Next.js 웹 애플리케이션.

**Constraints**:
- 완주 판정 및 Post-mortem은 정규 스터디(`STUDY`) 전용이며 단기 파티(`PARTY`)·LIVE 핑(`LIVE`)은 대상이 아니다 (`FR-008`, `FR-020`).
- 완주 판정은 판정 창(종료월 15일 00:00 KST ~ 익월 10일 23:59:59.999 KST) 안이고, 회고가 없으며, 완주 팀원이 1명 이상일 때만 가능하다 (`FR-008`).
- Post-mortem은 판정 창 오픈(`opensAt`) 이후 기한 없이 등록·덮어쓰기가 가능하며 상태 전이나 카운트 가산을 일으키지 않는다 (`FR-009`).
- `detail.leader`·`detail.participants`의 `PublicUser` 투영(`TC-IDENT-04`)을 깨뜨리지 않는다.

**Scale/Scope**: 신규 컴포넌트 1개 (`src/components/detail/CompletionModal.tsx`), 수정 파일 7개 (`src/lib/view-types.ts`, `src/lib/posts.ts`, `src/lib/leader-actions.ts`, `src/components/detail/LeaderActions.tsx`, `src/components/detail/PostDetailModal.tsx`, `tests/lib/leader-actions.test.ts`, `tests/posts-detail.test.ts`, `docs/next-steps.md`), `specs/007b-completion-lifecycle/` 산출물.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| I. 사양 주도 · 테스트 우선 | PASS | `spec.md` → `plan.md` → `tasks.md` → `implement` 순서 준수. `leader-actions.test.ts`와 `posts-detail.test.ts`를 먼저 Red로 작성한 뒤 구현(Green)한다 |
| II. 문서 SSOT 우선 | PASS | `requirement.md` `FR-008`·`FR-009`·`FR-021`과 `prd.md` F5의 팀원 체크박스 필수·단일 선택 `proofUrl` 규칙을 디자인 HTML 정적 렌더보다 우선 적용했다 (research R2) |
| III. 도메인 불변식 고정 | PASS | 정규 스터디 전용, 판정 창(`computeVerdictWindow`), 증빙 URL 선택(`https://`), 회고 1~1000자, 이니셜 뱃지 사용 규칙을 그대로 따른다 |
| IV. 동시성 · 상태 머신 무결성 | PASS | 백엔드의 `FOR UPDATE` 행 락 기반 `completePost`·`postmortemPost`를 호출하고, `COMPLETED` 전이 후 모든 변경 액션을 차단하며, 회고 등록 시 상태를 유지한다 |
| V. 보안 경계 · 링크 가시성 | PASS | `verdictMembers`는 `viewerId === post.leaderId`일 때만 응답에 포함하고, 비참여자 `chatUrl` 마스킹과 `PublicUser` 투영(`TC-IDENT-04`)을 유지한다 |

위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/007b-completion-lifecycle/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── completion-ui.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── view-types.ts                  # [수정] VerdictMember 타입 및 PostDetail.proofUrl, postmortemText, verdictMembers 추가
│   ├── posts.ts                       # [수정] getPostDetail에 proofUrl, postmortemText 및 리더 전용 verdictMembers 추가
│   └── leader-actions.ts              # [수정] completionActionStateOf, buildCompletePayload, buildPostmortemPayload 추가
└── components/
    └── detail/
        ├── CompletionModal.tsx        # [신규] complete.html + complete_postmortem.html 포팅 모달
        ├── LeaderActions.tsx          # [수정] 마무리 모달 진입 버튼 및 CompletionModal 연결
        └── PostDetailModal.tsx        # [수정] proofUrl 링크 및 postmortemText 회고 박스 표출

tests/
├── posts-detail.test.ts               # [수정] 리더 전용 verdictMembers 및 proofUrl/postmortemText 반환 검증
└── lib/
    └── leader-actions.test.ts         # [수정] completionActionStateOf, buildCompletePayload, buildPostmortemPayload 단위 테스트
```

**Structure Decision**: 기존 `CLAUDE.md` §3 디렉터리 규약을 그대로 따른다. 신규 디렉터리 없음.

## Complexity Tracking

위반 없음.
