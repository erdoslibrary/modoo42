# Quickstart & Validation Guide: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Feature**: `007b-completion-lifecycle` | **Date**: 2026-10-18

## 1. 자동 검증 게이트 (필수)

PR 생성 전 아래 5개 명령이 모두 0 에러로 통과해야 한다:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm drizzle-kit check
```

## 2. 단위/통합 테스트 검증 범위

- `tests/lib/leader-actions.test.ts`:
  - `completionActionStateOf`:
    - 비리더·게스트·`PARTY`·`LIVE`·`COMPLETED`·`CANCELLED` 시 `showEntry: false`.
    - 판정 창 오픈 전(`now < opensAt`) 시 `showEntry: true`, `canOpenModal: false`.
    - 판정 창 안(`opensAt <= now <= closesAt`) + 팀원 1명 이상 + 회고 미등록 시 `canOpenModal: true`, `canComplete: true`, `canPostmortem: true`, `defaultChoice: 'complete'`.
    - 판정 창 안이지만 팀원 0명(`verdictMembers: []`)일 때 `canComplete: false`, `canPostmortem: true`, `defaultChoice: 'postmortem'`.
    - 이미 `postmortemText`가 등록된 경우 `canComplete: false`, `canPostmortem: true`, `defaultChoice: 'postmortem'`, `entryLabel: 'Post-mortem 회고 수정'`.
    - 판정 기한 경과(`now > closesAt`) 시 `canComplete: false`, `canPostmortem: true`, `defaultChoice: 'postmortem'`.
  - `buildCompletePayload`:
    - 팀원 최소 1명 체크 + 증빙 URL 없음 → 성공 (`proofUrl` 키 생략).
    - 팀원 최소 1명 체크 + 유효한 `https://` 증빙 URL → 성공.
    - 전원 체크 해제(완주 0명) → 거절.
    - `http://` 등 비-HTTPS 증빙 URL → 거절.
  - `buildPostmortemPayload`:
    - 공백만 있는 문자열 또는 1001자 초과 → 거절.
    - 유효한 회고 문자열 → 앞뒤 공백 제거 후 성공.
- `tests/posts-detail.test.ts`:
  - 리더 본인 조회 시에만 `verdictMembers`가 포함되고, 비리더 조회 시에는 `verdictMembers` 키가 없으며 기존 `TC-IDENT-04`(`leader`·`participants`의 `{ login, campus }` 투영)가 그대로 유지됨을 확인.
  - 완주 및 회고 등록 후 상세 조회 시 `proofUrl`, `postmortemText` 반환 확인.

## 3. 브라우저 수동 검증 시나리오

1. **완주 벌크 판정 (`FR-008`, `complete.html`)**:
   - 판정 창 안(종료월 15일~익월 10일)의 정규 스터디에서 리더(`gs_leader`)로 상세 모달 오픈.
   - `[스터디 종료 및 결과 기록]` 클릭 → 마무리 모달이 열리고 `[🏆 완주했어요]`가 기본 선택되며 참여 팀원 체크박스가 모두 체크되어 있는지 확인.
   - 결과물 링크(선택) 입력 후 `[기록 남기기]` 클릭 → 상태가 `COMPLETED`로 전이되고 대시보드 `🏆명예의 전당` 탭과 성실 멤버 랭킹에 즉시 반영되는지 확인.
2. **Post-mortem 회고 등록 (`FR-009`, `complete_postmortem.html`)**:
   - 미종료 정규 스터디의 마무리 모달에서 `[🪦 Post-mortem 남기기]` 클릭.
   - 회고 내용을 입력하고 `[기록 남기기]` 클릭 → 상세 모달과 대시보드 `🪦Post-mortem` 탭에 회고가 표시되고, 다시 마무리 모달을 열면 완주 판정이 비활성화되어 회고 수정만 가능한지 확인.
