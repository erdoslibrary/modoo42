# Feature Specification: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Feature Branch**: `007b-completion-lifecycle`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "007b 완주 라이프사이클 화면 포팅 및 결합 — FR-008(완주 벌크 판정), FR-009(Post-mortem 실패 회고 등록), FR-021 후반부. docs/designs/complete.html 및 complete_postmortem.html을 Next.js React 컴포넌트로 포팅하고, 상세 모달(PostDetailModal / LeaderActions)에서 정규 스터디(STUDY) 리더 본인이 판정 창(종료월 15일~익월 10일)에 진입해 팀원 완주 벌크 판정(선택적 증빙 URL 포함) 또는 Post-mortem 회고 등록을 수행할 수 있도록 연결한다."

> **범위 확정 (`docs/next-steps.md` §3.3 & `docs/requirement.md` FR-008 · FR-009 · FR-021):**
> - **007a (선행 머지 완료)**: 상세 모달의 리더 기본 액션 3종 — 수동 마감/재모집 토글(`FR-004`), 중도 취소(`FR-005`), 게시글 수정(`FR-006`).
> - **007b (본 브랜치)**: 정규 스터디(`STUDY`) 전용 마무리 모달(`complete.html` + `complete_postmortem.html`) 포팅 및 상세 모달 진입 연결. 완주 벌크 판정(`POST /api/posts/:id/complete`, `FR-008`)과 Post-mortem 회고 등록(`POST /api/posts/:id/postmortem`, `FR-009`)을 단일 모달 내 2가지 경로로 제공한다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 리더가 판정 창이 열린 정규 스터디에서 팀원 완주를 벌크 판정하고 명예의 전당에 등록한다 (Priority: P1)

정규 스터디(`STUDY`)를 이끈 리더가 사이클 종료월 15일부터 익월 10일(Grace Period) 사이에 상세 모달의 `[스터디 종료 및 결과 기록]` 버튼을 눌러 마무리 모달을 연다. 기본 선택된 `[🏆 완주했어요]` 경로에서 참여 팀원 목록(기본 전원 체크) 중 중도 이탈자만 체크 해제하고, 선택적으로 결과물 증빙 링크(`https://`)를 입력한 뒤 `[기록 남기기]`를 누른다. 즉시 스터디가 `COMPLETED`로 전이되고 리더 횟수(`leader_count + 1`)와 완주 멤버들의 완주 횟수(`completed_count + 1`)가 가산되며 대시보드 `🏆명예의 전당` 탭에 등재된다.

**Why this priority**: 플랫폼의 핵심 가치인 "완주 기록 및 성실 멤버 랭킹·명예의 전당 반영"을 리더가 실제로 실행할 수 있는 유일한 화면이다 (`FR-008`, `FR-021`, `prd.md` F5).

**Independent Test**: 판정 창 안의 `STUDY` 글에서 리더 세션으로 상세 모달 → `[스터디 종료 및 결과 기록]`을 열고, 팀원 체크박스 선택 및 증빙 링크(유/무) 제출 시 `COMPLETED` 상태로 바뀌며 명예의 전당과 프로필 카운트에 즉시 반영되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 판정 창(사이클 종료월 15일 00:00 KST ~ 익월 10일 23:59:59 KST) 안의 미종료(`RECRUITING`/`CLOSED`) 정규 스터디(`STUDY`)와 참여 팀원 1명 이상, **When** 리더가 상세 모달에서 `[스터디 종료 및 결과 기록]`을 누른다, **Then** `complete.html` 디자인의 마무리 모달이 열리고 `[🏆 완주했어요]` 경로에 리더를 제외한 참여 팀원 체크박스 목록이 전원 체크(`true`) 상태로 표시된다. (`FR-008`, `FR-021`)
2. **Given** 마무리 모달의 `[🏆 완주했어요]` 경로에서 최소 1명 이상의 팀원이 체크된 상태, **When** 리더가 증빙 링크를 비워 두거나 `https://`로 시작하는 링크를 입력하고 `[기록 남기기]`를 누른다, **Then** 글이 `COMPLETED` 상태로 전이되고 모달과 대시보드가 갱신되며 명예의 전당에 등록된다. (`FR-008`, `TC-COMPLETE-01`)
3. **Given** 마무리 모달의 `[🏆 완주했어요]` 경로, **When** 리더가 모든 팀원의 체크를 해제(완주 0명)하거나 `https://`가 아닌 잘못된 증빙 링크를 입력하고 제출한다, **Then** 요청이 보내지기 전에 안내 문구로 차단된다. (`FR-008`)
4. **Given** 아직 판정 창이 열리기 전(`now < opensAt`)인 정규 스터디, **When** 리더가 상세 모달을 본다, **Then** 마무리 버튼은 비활성화되어 있고 언제부터 결과 기록이 가능한지(종료월 15일 오픈) 안내된다. (`FR-008`)
5. **Given** 단기 파티(`PARTY`) 또는 비리더 세션, **When** 상세 모달을 연다, **Then** 완주 판정 및 결과 기록 입구가 노출되지 않는다. (`FR-008`, `FR-017`, `FR-020`)

---

### User Story 2 - 리더가 목표 미달성 스터디의 Post-mortem 회고를 등록하거나 보강한다 (Priority: P1)

목표를 끝까지 달성하지 못했거나 리더 혼자만 남은 정규 스터디의 리더가 마무리 모달에서 `[🪦 Post-mortem 남기기]` 경로를 선택하고, 중단 이유와 배운 점(1~1000자)을 작성해 `[기록 남기기]`를 누른다. 글 상태(`RECRUITING`/`CLOSED`)와 카운트는 그대로 유지된 채 회고가 저장되어 대시보드 `🪦Post-mortem` 탭에 노출된다. 이미 회고를 남긴 글이나 판정 기한(익월 10일)이 지난 글에서도 리더는 회고를 새로 등록하거나 덮어써서 보강할 수 있다.

**Why this priority**: "실패도 자산으로 기록한다"는 제품 철학의 핵심 경로이며, 완주 판정과 같은 마무리 모달의 두 번째 선택지로 동작한다 (`FR-009`, `FR-021`, `prd.md` F5).

**Independent Test**: 판정 창이 열린 정규 스터디에서 리더가 `[🪦 Post-mortem 남기기]`를 골라 회고 본문을 저장하면 대시보드 `🪦Post-mortem` 탭과 상세 모달에 회고가 표시되고, 이후 해당 글에서는 완주 판정이 차단되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 판정 창 시작 시각(`opensAt`, 종료월 15일 00:00 KST) 이후의 미종료(`RECRUITING`/`CLOSED`) 정규 스터디, **When** 리더가 마무리 모달에서 `[🪦 Post-mortem 남기기]`를 선택한다, **Then** `complete_postmortem.html` 디자인의 회고 입력 영역이 표시된다. (`FR-009`, `FR-021`)
2. **Given** `[🪦 Post-mortem 남기기]` 경로, **When** 리더가 공백 제외 1~1000자의 회고를 입력하고 `[기록 남기기]`를 누른다, **Then** 회고가 저장되고 상세 모달 및 대시보드 `🪦Post-mortem` 탭에 반영되며 리더·팀원 카운트는 변하지 않는다. (`FR-009`)
3. **Given** 이미 Post-mortem 회고가 등록된 글, 또는 판정 마감일(`closesAt`, 익월 10일)이 지난 글, 또는 리더 외 참여 팀원이 0명인 글, **When** 리더가 마무리 모달을 연다, **Then** 완주 판정 경로는 비활성화(사유 안내)되고 자동으로 `[🪦 Post-mortem 남기기]` 경로가 선택되어 회고 작성·수정이 가능하다. (`FR-008`, `FR-009`)
4. **Given** 회고 입력란이 비어 있거나 공백뿐이거나 1000자를 초과한 상태, **When** `[기록 남기기]`를 누른다, **Then** 제출이 차단되고 글자수 안내가 표시된다. (`FR-009`)

---

### User Story 3 - 상세 모달에서 완주 증빙 링크와 등록된 Post-mortem 회고를 열람한다 (Priority: P2)

유저가 상세 모달을 열었을 때, 완주(`COMPLETED`)된 스터디에 증빙 링크(`proofUrl`)가 있다면 바로 열어볼 수 있고, Post-mortem 회고(`postmortemText`)가 등록된 스터디라면 상세 모달에서도 회고 전문을 읽을 수 있다.

**Why this priority**: 리더가 기록한 완주 증빙과 실패 회고를 상세 모달에서도 일관되게 확인할 수 있어야 기록의 맥락이 끊기지 않는다.

**Independent Test**: 완주 처리(증빙 URL 포함)된 글과 Post-mortem이 등록된 글의 상세 모달을 열어 각각 증빙 외부 링크와 회고 본문이 표시되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 증빙 링크(`proofUrl`)가 저장된 완주(`COMPLETED`) 스터디, **When** 상세 모달을 연다, **Then** 결과물 증빙 링크가 외부 이동 링크(`target="_blank"`)로 표시된다.
2. **Given** `postmortemText`가 등록된 스터디, **When** 상세 모달을 연다, **Then** 등록된 Post-mortem 회고 본문이 표시된다.

---

### Edge Cases

- **리더 혼자만 있는 스터디 (참여 팀원 0명)**: 백엔드 `completePost`는 리더 제외 `JOINED` 참여자가 최소 1명 이상 완주해야 통과한다(`completedIds.length === 0` 거절). 따라서 팀원이 0명인 경우 `[🏆 완주했어요]` 선택지를 비활성화하고 사유("참여한 팀원이 없어 완주 판정을 할 수 없습니다. Post-mortem 회고를 남겨 주세요.")를 안내하며 `[🪦 Post-mortem 남기기]`로 유도한다.
- **회고 등록 후 완주 판정 불가 (배타성)**: `postmortemText`가 이미 있는 글은 실패 회고 사이클로 확정되어 백엔드가 완주 판정을 거절한다(`research R9`). UI에서도 이미 회고가 있는 글은 완주 판정 탭을 비활성화하고 회고 수정(덮어쓰기)만 허용한다.
- **Grace Period(익월 10일) 경과 후 진입**: `now > closesAt`이면 완주 판정은 마감되었으나 수동 Post-mortem 등록은 허용된다(`postmortemPost`). 이 경우 마무리 모달 진입은 열어 두되 `[🏆 완주했어요]`만 비활성화하고 `[🪦 Post-mortem 남기기]`로 안내한다.
- **비참여자/타인의 식별자 노출 방지 (`TC-IDENT-04`)**: 일반 상세 조회 응답의 `leader`와 `participants`는 기존과 동일하게 `{ login, campus }`(`PublicUser`)만 유지한다. 완주 판정 체크박스에 필요한 팀원 `userId` 목록(`verdictMembers`)은 조회자가 해당 글의 리더 본인(`viewerId === post.leaderId`)일 때만 서버에서 내려준다.
- **중복 제출 방어**: 완주 판정 또는 회고 저장 요청 처리 중(`pending`)에는 모달 내 탭 전환과 제출 버튼을 비활성화한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 상세 모달(`LeaderActions`)은 로그인 유저가 해당 글의 리더 본인(`role === 'leader'`)이고, 글 유형이 정규 스터디(`post.type === 'STUDY'`)이며, 상태가 `RECRUITING` 또는 `CLOSED`일 때만 마무리 액션 버튼을 표시해야 한다. 단기 파티(`PARTY`)와 LIVE 핑(`LIVE`), 최종 상태(`COMPLETED`·`CANCELLED`)에서는 표시하지 않는다. (`req FR-008`, `FR-021`)
- **FR-002**: 정규 스터디의 판정 창(`computeVerdictWindow(endDate)`: 종료월 15일 00:00 KST ~ 익월 10일 23:59:59.999 KST)이 열리기 전(`now < opensAt`)에는 마무리 액션 버튼을 비활성화하고 오픈 시점 안내 문구를 표시해야 한다. `now >= opensAt`이면 마무리 모달을 열 수 있어야 한다. (`req FR-008`, `FR-009`)
- **FR-003**: 마무리 모달(`CompletionModal`)은 `docs/designs/complete.html` 및 `docs/designs/complete_postmortem.html`의 디자인 시스템(네오브루탈리즘 테두리·하드 섀도우·Galmuri11/Pretendard)을 따르며, `[🏆 완주했어요]`와 `[🪦 Post-mortem 남기기]` 두 경로 선택 카드를 제공해야 한다. (`req FR-021`)
- **FR-004**: 완주 판정(`[🏆 완주했어요]`) 경로는 `opensAt <= now <= closesAt`이고, 기존 `postmortemText`가 없으며, 리더를 제외한 `JOINED` 참여 팀원(`verdictMembers`)이 1명 이상일 때만 활성화해야 한다. 조건을 충족하지 못하면 완주 경로를 비활성화(사유 표기)하고 기본 선택을 `[🪦 Post-mortem 남기기]`로 두어야 한다. (`req FR-008`, `FR-009`)
- **FR-005**: 완주 판정 경로에서는 리더를 제외한 모든 `JOINED` 참여 팀원을 체크박스 목록(기본값 전원 체크 `true`)으로 표시하고, 리더가 개별 팀원의 완주 여부를 토글할 수 있어야 한다. 최소 1명 이상이 체크되어야 제출할 수 있다. (`req FR-008`, `prd F5`)
- **FR-006**: 완주 판정 경로의 결과물 증빙 링크(`proofUrl`)는 선택 입력이며, 비어 있으면 생략하고 입력된 경우 `https://`로 시작하는지 검증해야 한다. 확정 시 `POST /api/posts/:id/complete`를 호출한다. (`req FR-008`)
- **FR-007**: Post-mortem(`[🪦 Post-mortem 남기기]`) 경로는 회고 본문(앞뒤 공백 제거 후 1~1000자)을 입력받아 `POST /api/posts/:id/postmortem`을 호출해야 한다. 기존 `postmortemText`가 있으면 초기값으로 채워 덮어쓰기(보강)를 지원한다. (`req FR-009`)
- **FR-008**: `getPostDetail`은 상세 모달 표출을 위해 `proofUrl`과 `postmortemText`를 포함하고, 조회자가 리더 본인(`viewerId === post.leaderId`)일 때만 리더 제외 `JOINED` 팀원의 판정용 목록(`verdictMembers: { userId, login, campus }[]`)을 포함해야 한다. 기존 `leader`·`participants`(`PublicUser[]`) 투영 계약(`TC-IDENT-04`)은 그대로 유지한다. (`req FR-016`, `FR-021`)
- **FR-009**: 완주 판정 또는 Post-mortem 등록 성공 시 모달이 닫히고 상세 모달·대시보드가 즉시 최신 상태로 갱신되어야 하며, 실패 시 서버 에러 코드에 대응하는 한국어 문구를 표시해야 한다. (`CLAUDE.md` §8)

### Key Entities

- **판정 대상 팀원 (`VerdictMember`)**: 리더를 제외한 `JOINED` 상태 참여자의 판정용 투영 (`{ userId: string; login: string; campus: 'GS' | 'SEOUL' | null }`). 리더 본인 조회 시에만 `PostDetail.verdictMembers`로 전달된다.
- **완주/회고 가능 상태 (`CompletionActionState`)**: 정규 스터디의 `type`, `status`, `endDate`, `postmortemText`, `verdictMembers.length`, `now`로부터 파생되는 UI 제어 모델.
  - `showEntry`: 마무리 입구 버튼 렌더 여부 (`role === 'leader'` & `type === 'STUDY'` & `status === 'RECRUITING' | 'CLOSED'`)
  - `canOpenModal`: 마무리 모달 오픈 가능 여부 (`now >= opensAt`)
  - `entryLabel` / `entryHint`: 버튼 라벨(`'스터디 종료 및 결과 기록'` 또는 `'Post-mortem 회고 수정'`) 및 비활성 안내 문구
  - `canComplete`: 완주 판정 탭 선택·제출 가능 여부 (`opensAt <= now <= closesAt` & `postmortemText === null` & `verdictMembers.length >= 1`)
  - `completeDisabledReason`: 완주 판정 불가 시 사유 문구
  - `canPostmortem`: Post-mortem 탭 선택·제출 가능 여부 (`now >= opensAt`)
  - `defaultChoice`: 모달 초기 탭 (`canComplete ? 'complete' : 'postmortem'`)
- **완주 판정 페이로드 (`BuiltCompletePayload`)**: 팀원 체크 상태와 증빙 URL 입력값을 검증·직렬화한 `{ evaluations: { userId: string; isCompleted: boolean }[]; proofUrl?: string }`.
- **회고 등록 페이로드 (`BuiltPostmortemPayload`)**: 회고 입력값을 `.trim()` 및 1~1000자 검증한 `{ text: string }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 판정 창 안의 정규 스터디 리더가 상세 모달에서 마무리 모달을 열어 팀원 완주 판정(증빙 URL 유/무 모두)을 제출하면 글 상태가 `COMPLETED`로 전이되고 리더 `leader_count + 1` 및 완주 팀원 `completed_count + 1`이 100% 반영된다.
- **SC-002**: 리더가 마무리 모달에서 Post-mortem 회고를 등록·수정하면 글 상태와 카운트 변화 없이 `postmortem_text`가 저장되고 상세 모달과 대시보드 `🪦Post-mortem` 탭에 즉시 표출된다.
- **SC-003**: 판정 창 이전(`now < opensAt`), 기한 경과(`now > closesAt`), 팀원 0명, 회고 기등록 상태에서 허용되지 않는 경로가 UI에서 사전 차단되고 명확한 한국어 사유가 안내된다.
- **SC-004**: 비리더·게스트 및 단기 파티(`PARTY`)·LIVE 핑(`LIVE`)에서는 마무리 모달 입구와 `verdictMembers` 노출이 0건이며, 기존 `TC-IDENT-04` 유저 투영 테스트가 그대로 통과한다.
- **SC-005**: 신규 단위/통합 테스트 및 로컬 필수 게이트 5종(`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm drizzle-kit check`)이 100% 통과한다.

## Assumptions

- 백엔드 Route Handler 2종(`POST /api/posts/:id/complete`, `POST /api/posts/:id/postmortem`)과 도메인 서비스(`completePost`, `postmortemPost`)는 Phase 2(`003-completion-lifecycle`)에서 이미 구현·검증되어 있다.
- 디자인 원본 `complete.html`에는 정적 렌더 특성상 참여자 체크박스 영역이 생략되고 복수 링크 입력칸(`GH`, `N`, `+ 링크 추가`)이 그려져 있으나, 문서 우선순위(`requirement.md` > `trd.md` > `prd.md` > 디자인 HTML, `CLAUDE.md` §1)에 따라 **팀원 완주 체크박스(기본 전원 체크)**를 필수로 포함하고 **증빙 URL(`proof_url`)은 단일 선택 입력(`https://`)**으로 구현한다.
- 마무리 화면은 `006` R7·R12 및 `007a`의 모달 패턴과 일관되게 상세 모달(`LeaderActions`) 내부에서 열리는 네이티브 `<dialog>` 컴포넌트(`CompletionModal.tsx`)로 구현하여 별도 라우트 추가 없이 대시보드 맥락을 유지한다.

## Dependencies

- `docs/requirement.md` (`FR-008`, `FR-009`, `FR-010`, `FR-016`, `FR-017`, `FR-021`, `NFR-003`)
- `docs/trd.md` §4 (`POST /api/posts/:id/complete`, `POST /api/posts/:id/postmortem`)
- `docs/prd.md` F4, F5
- `docs/designs/complete.html`, `docs/designs/complete_postmortem.html`
- `007a-leader-actions`에서 구현된 `src/lib/leader-actions.ts`, `src/components/detail/LeaderActions.tsx`, `src/components/detail/PostDetailModal.tsx`
