# Quickstart & Validation Guide: 리더 기본 액션 상세 모달 결합 (007a)

**Feature**: `007a-leader-actions` | **Date**: 2026-10-18

## 1. 자동 검증 게이트 (필수)

PR 생성 전 아래 5개 명령이 모두 0 에러로 통과해야 한다:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm drizzle-kit check
```

## 2. 단위 테스트 검증 범위

- `tests/lib/leader-actions.test.ts`:
  - `leaderActionStateOf`: 비리더·게스트·LIVE 핑·`COMPLETED`·`CANCELLED` 시 `visible: false`.
  - `RECRUITING` 상태에서 `canEdit: true`, `canToggleStatus: true`, `nextToggleStatus: 'CLOSED'`.
  - `CLOSED` 상태(정원 여유 있음)에서 `canEdit: false`, `canToggleStatus: true`, `nextToggleStatus: 'RECRUITING'`.
  - `CLOSED` 상태(정원 도달 `currentMembers >= maxMembers`)에서 `canToggleStatus: false`.
  - 마감일 지난 `PARTY`에서 `canEdit: false`, `canToggleStatus: false`, `canCancel: true`.
  - `buildUpdatePatch`: 설명·장소 빈 문자열 입력 시 `null`로 직렬화, 온라인/병행 모집에서 `chatUrl` 빈 값 거절, 허용 외 도메인 거절.
- `tests/lib/validation.test.ts`:
  - `cancelSchema`: 공백만 있는 사유(`"   "`) 거부, 정상 사유 앞뒤 공백 trim 확인.

## 3. 브라우저 수동 검증 시나리오

1. **수동 마감 및 재모집 토글 (`FR-004`)**:
   - Mock Auth에서 `gs_leader` 선택 → 내가 개설한 모집 중 스터디의 `[상세보기 ↗]` 클릭.
   - 리더 전용 영역에서 `[마감하기]` 클릭 → 모달 상태가 마감으로 바뀌고 `[수정하기]`가 비활성화되며 버튼이 `[재모집하기]`로 바뀌는지 확인.
   - `[재모집하기]` 클릭 → 다시 모집 중으로 돌아오고 `[수정하기]`가 활성화되는지 확인.
2. **게시글 수정 및 빈 값 초기화 (`FR-006`)**:
   - `[수정하기]` 클릭 → 제목·장소 수정 후 저장 → 상세 모달에 즉시 반영되는지 확인.
   - 다시 `[수정하기]` 클릭 → 장소 입력란을 비우고 저장 → 상세 모달에서 장소 항목이 사라지는지(`null`) 확인.
3. **모집 취소 (`FR-005`)**:
   - `[모집 취소]` 클릭 → 사유 입력 후 `[취소 확정]` 클릭 → 상세 모달에 `취소 사유: ...`가 표시되고 리더 전용 영역이 사라지는지 확인.
