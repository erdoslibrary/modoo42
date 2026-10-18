# Contract: 상세 모달 리더 기본 액션 결합 (007a)

**Feature**: `007a-leader-actions` | **Date**: 2026-10-18
**대응 요구사항**: `FR-004`(마감/재모집 토글), `FR-005`(중도 취소), `FR-006`(게시글 수정), `FR-017`(인가), `FR-021`(007a 범위)

## 1. 호출하는 기존 HTTP 엔드포인트

신규 Route Handler를 추가하지 않고 Phase 1에서 구축된 3개 엔드포인트를 그대로 호출한다.

| 액션 | Method & Path | 요청 본문 | 성공 응답 | 주요 에러 코드 |
| :--- | :--- | :--- | :--- | :--- |
| 마감 / 재모집 토글 | `POST /api/posts/:id/status` | `{ status: 'CLOSED' \| 'RECRUITING' }` | `200 { id, status }` | `BAD_REQUEST`(400), `FORBIDDEN`(403), `NOT_FOUND`(404) |
| 게시글 수정 | `PUT /api/posts/:id` | `{ title?, description?: string \| null, place?: string \| null, chatUrl?: string }` | `200 { id, updatedAt }` | `BAD_REQUEST`(400), `FORBIDDEN`(403), `NOT_FOUND`(404) |
| 모집 중도 취소 | `POST /api/posts/:id/cancel` | `{ reason: string }` (trim 후 1~300자) | `200 { id, status: 'CANCELLED' }` | `BAD_REQUEST`(400), `FORBIDDEN`(403), `NOT_FOUND`(404) |

## 2. UI 결합 규칙 (`LeaderActions.tsx`)

1. **노출 가드**: `leaderActionStateOf(post, role, now).visible === true`일 때만 렌더한다.
2. **액션 버튼 3종**:
   - **상태 토글 버튼 (`[마감하기]` / `[재모집하기]`)**:
     - 클릭 시 별도 다이얼로그 없이 즉시 `POST /api/posts/${post.id}/status`에 `{ status: state.nextToggleStatus }` 전송.
     - `state.canToggleStatus === false`이면 `disabled` 처리.
   - **수정 버튼 (`[수정하기]`)**:
     - `state.canEdit === true`(`RECRUITING` & 미만료)일 때만 활성화. `CLOSED` 상태에서는 `disabled` 처리하고 모집 중인 글만 수정 가능함을 안내.
     - 클릭 시 수정 `<dialog>` 오픈. 제출 시 `buildUpdatePatch`로 검증·직렬화한 뒤 `PUT /api/posts/${post.id}` 호출.
   - **취소 버튼 (`[모집 취소]`)**:
     - `state.canCancel === true`(`RECRUITING` | `CLOSED`)일 때 활성화.
     - 클릭 시 취소 사유 `<dialog>` 오픈. 사유(trim 1~300자) 입력 후 `POST /api/posts/${post.id}/cancel` 호출.
3. **성공 후 동기화**: 요청이 `200 OK`로 끝나면 열려 있는 서브 다이얼로그를 닫고 `router.refresh()`를 호출해 상세 모달과 대시보드 배경 카드를 최신 서버 상태로 갱신한다.
4. **완주·회고 미노출**: 완주 판정 및 Post-mortem 회고 등록 입구는 `007b` 브랜치 범위이므로 본 컴포넌트에 포함하지 않는다.
