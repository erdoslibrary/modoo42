# Contract: 완주 판정 및 회고 등록 UI 결합 (007b)

**Feature**: `007b-completion-lifecycle` | **Date**: 2026-10-18
**대응 요구사항**: `FR-008`(완주 벌크 판정), `FR-009`(Post-mortem 회고 등록), `FR-017`(인가), `FR-021`(007b 범위)

## 1. 호출하는 기존 HTTP 엔드포인트

신규 Route Handler를 추가하지 않고 Phase 2(`003-completion-lifecycle`)에서 구축된 2개 엔드포인트를 그대로 호출한다.

| 액션 | Method & Path | 요청 본문 | 성공 응답 | 주요 에러 코드 |
| :--- | :--- | :--- | :--- | :--- |
| 완주 벌크 판정 | `POST /api/posts/:id/complete` | `{ evaluations: [{ userId: uuid, isCompleted: boolean }], proofUrl?: string }` | `200 { id, status: 'COMPLETED', completedCount, incompleteCount }` | `BAD_REQUEST`(400), `FORBIDDEN`(403), `NOT_FOUND`(404) |
| Post-mortem 회고 등록 | `POST /api/posts/:id/postmortem` | `{ text: string }` (trim 후 1~1000자) | `200 { id, status, postmortemText }` | `BAD_REQUEST`(400), `FORBIDDEN`(403), `NOT_FOUND`(404) |

## 2. UI 결합 규칙 (`LeaderActions.tsx` & `CompletionModal.tsx` & `PostDetailModal.tsx`)

1. **상세 모달 마무리 입구 (`LeaderActions.tsx`)**:
   - `completionActionStateOf(post, role, now).showEntry === true`일 때만 마무리 액션 버튼(`[스터디 종료 및 결과 기록]` 또는 `[Post-mortem 회고 수정]`)을 노출한다.
   - `canOpenModal === false`(`now < opensAt`)이면 버튼을 `disabled` 처리하고 `entryHint`(`사이클 종료월 15일부터 결과를 기록할 수 있습니다.`)를 표시한다.
   - `canOpenModal === true`이면 클릭 시 `CompletionModal` `<dialog>`를 연다.

2. **마무리 모달 (`CompletionModal.tsx`)**:
   - 디자인 원본 `docs/designs/complete.html` 및 `docs/designs/complete_postmortem.html`의 레이아웃·타이포·색상 토큰을 따른다.
   - 상단 헤더: `스터디를 마무리할게요` 타이틀, 첫 번째 태그 뱃지 + 스터디 제목, 닫기 버튼(`✕`).
   - 경로 선택 카드 2종:
     - `[🏆 완주했어요]`: `canComplete === false`이면 비활성화하고 `completeDisabledReason`을 안내한다.
     - `[🪦 Post-mortem 남기기]`: `canPostmortem === true`일 때 선택 가능.
   - **완주 판정 폼 (`choice === 'complete'`)**:
     - `post.verdictMembers` 전원(리더 제외 `JOINED` 팀원)을 체크박스 리스트로 표시하며 초기값은 전원 체크(`true`)다.
     - 결과물 링크(`proofUrl`) 선택 입력란(`https://...`).
     - `[기록 남기기]` 제출 시 `buildCompletePayload`로 검증 후 `POST /api/posts/${post.id}/complete` 호출.
   - **Post-mortem 폼 (`choice === 'postmortem'`)**:
     - 회고 `<textarea>` (`defaultValue={post.postmortemText ?? ''}`, 최대 1000자).
     - `[기록 남기기]` 제출 시 `buildPostmortemPayload`로 검증 후 `POST /api/posts/${post.id}/postmortem` 호출.
   - 성공 시 모달을 닫고 `router.refresh()`를 호출한다.

3. **상세 모달 결과 표출 (`PostDetailModal.tsx`)**:
   - `post.proofUrl`이 존재하면 `완주 결과물 링크 ↗` 외부 링크를 노출한다.
   - `post.postmortemText`가 존재하면 상세 모달 내에 Post-mortem 회고 본문 박스를 노출한다.
