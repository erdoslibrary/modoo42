# Feature Specification: 리더 기본 액션 상세 모달 결합 (007a)

**Feature Branch**: `007a-leader-actions`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "007a 리더 기본 액션 상세 모달 결합 — FR-004(수동 마감/재모집 토글), FR-005(모집 중도 취소), FR-006(리더 게시글 수정), FR-021 전반부. 상세 모달(PostDetailModal / LeaderActions)에서 리더 본인이 모집/마감 상태를 토글하고, 모집 중인 글을 수정하며, 시작 전 모집을 취소할 수 있도록 결합한다. 완주 판정 및 회고 등록 화면(007b)은 후속 브랜치로 분리한다."

> **범위 확정 (`docs/next-steps.md` §3.3 & `docs/requirement.md` FR-021):**
> - **007a (본 브랜치)**: 리더 기본 액션 3종 — 수동 마감/재모집 토글(`FR-004`), 중도 취소(`FR-005`), 게시글 수정(`FR-006`)을 상세 모달에 결합하고 상태별 노출·활성 규칙 및 입력 직렬화를 완결한다.
> - **007b (후속 브랜치)**: 완주 판정(`FR-008`, `complete.html`)과 Post-mortem 회고 등록(`FR-009`, `complete_postmortem.html`) 화면 포팅 및 판정 창 진입 연결. 본 브랜치에서는 완주·회고 진입 버튼을 노출하지 않는다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 리더가 모집 상태를 수동으로 마감하거나 재모집으로 되돌린다 (Priority: P1)

스터디나 단기 파티를 개설한 리더가 정원이 다 차기 전이라도 준비가 끝났다면 상세 모달에서 즉시 모집을 마감할 수 있다. 반대로 마감된 상태에서 추가 인원을 더 받고 싶다면(정원이 남아 있는 한) 다시 모집 중으로 열어 둘 수 있다.

**Why this priority**: 백엔드에는 수동 마감/재모집 전환 기능이 준비되어 있으나 상세 모달 화면에 버튼이 빠져 있어 리더가 정원 미달 상태에서 모집을 닫거나 다시 열 수 없다 (`FR-004`).

**Independent Test**: 리더 세션으로 자신이 개설한 `RECRUITING` 상태 글의 상세 모달을 열어 `[마감하기]`를 누르면 상태가 `CLOSED`로 바뀌고 비참여자의 참여 버튼이 막히며, 다시 `[재모집하기]`를 누르면 `RECRUITING`으로 돌아오는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 리더 본인이 개설한 모집 중(`RECRUITING`) 정규 스터디 또는 단기 파티, **When** 상세 모달을 연다, **Then** 리더 전용 영역에 `[마감하기]` 액션이 보이고 클릭 시 즉시 모집 마감(`CLOSED`) 상태로 전환된다. (`FR-004`)
2. **Given** 리더 본인이 개설한 마감(`CLOSED`) 상태의 글(정원 여유 있음), **When** 상세 모달에서 `[재모집하기]`를 누른다, **Then** 모집 중(`RECRUITING`) 상태로 돌아오고 비참여자가 다시 참여할 수 있다. (`FR-004`)
3. **Given** 정원이 가득 찬(`currentMembers >= maxMembers`) 마감 상태의 글, **When** 리더가 상세 모달을 본다, **Then** 정원 초과로 실제 신규 참여가 불가능하므로 재모집 전환 버튼은 비활성화(또는 정원 도달 안내)되어 혼선을 막는다.
4. **Given** 마감일이 이미 지난 단기 파티(`PARTY`), **When** 리더가 상세 모달을 본다, **Then** 기간 만료로 모집 피드와 신규 참여가 이미 닫혀 있으므로 상태 토글을 비활성화한다. (`FR-020`)
5. **Given** 리더가 아닌 일반 참여자 또는 비참여자, **When** 상세 모달을 연다, **Then** 마감/재모집 전환을 포함한 어떤 리더 전용 액션도 보이지 않는다. (`FR-017`)

---

### User Story 2 - 리더가 모집 중인 게시글의 정보를 수정한다 (Priority: P1)

리더가 모집 중(`RECRUITING`)인 글에서 제목 오타를 고치거나, 설명·장소를 보강하거나, 바뀐 오픈채팅/디스코드 링크를 반영한다. 선택 입력인 설명이나 장소를 비워서 지울 수도 있다. 반면 이미 마감(`CLOSED`)된 글에서는 수정이 허용되지 않음이 명확히 표시된다.

**Why this priority**: `FR-006`과 백엔드 규칙은 `RECRUITING` 상태에서만 수정을 허용하는데, 기존 화면은 `CLOSED`에서도 수정 버튼을 열어 두어 제출 시점에야 에러가 나고, 설명·장소를 빈칸으로 지우면 변경사항이 누락되는 문제가 있다.

**Independent Test**: 리더 세션으로 `RECRUITING` 글의 제목·설명·장소·초대 링크를 수정하고, 설명과 장소를 비워 `null`로 초기화되는지 확인한 뒤, `CLOSED` 상태에서는 수정이 비활성화되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 모집 중(`RECRUITING`)인 내 글, **When** 리더가 `[수정하기]`를 눌러 제목·설명·장소·초대 링크를 고치고 저장한다, **Then** 변경된 내용이 상세 모달과 대시보드 카드에 즉시 반영된다. (`FR-006`)
2. **Given** 기존에 설명이나 장소가 입력되어 있던 모집 중인 내 글, **When** 리더가 수정 폼에서 설명 또는 장소를 모두 지우고 저장한다, **Then** 해당 항목이 비워진(`null`) 상태로 저장되고 기존 값이 남지 않는다.
3. **Given** 온라인 또는 온/오프라인 병행(`ONLINE`·`HYBRID`) 모집 글, **When** 리더가 수정 폼에서 초대 링크를 비우거나 화이트리스트 밖 URL을 입력한다, **Then** 저장이 거절되고 사유가 표시된다. (`FR-001`, `NFR-002`)
4. **Given** 마감(`CLOSED`) 상태인 내 글, **When** 리더가 상세 모달을 본다, **Then** `[수정하기]` 버튼은 비활성화되어 모집 중인 글만 수정할 수 있음을 사전에 알 수 있다. (`FR-006`)

---

### User Story 3 - 리더가 스터디 시작 전에 모집을 취소한다 (Priority: P2)

부득이한 사정이나 인원 미달로 모임을 진행할 수 없을 때, 리더가 취소 사유를 적어 모집을 취소(`CANCELLED`)한다. 취소된 후에는 참여자에게 취소 사유가 보이고 모든 추가 변경이나 참여가 차단된다.

**Why this priority**: 잘못 개설되거나 무산된 모임을 정리하고 참여자에게 이유를 알리는 필수 수명주기 동작이다 (`FR-005`, `NFR-003`).

**Independent Test**: 리더가 모집 중 또는 마감 상태의 글에서 취소 사유를 입력해 확정하면 상태가 `CANCELLED`로 바뀌고, 상세 모달에 취소 사유가 표시되며 리더 전용 액션 영역이 사라지는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 모집 중(`RECRUITING`) 또는 마감(`CLOSED`) 상태인 내 글, **When** 리더가 `[모집 취소]`를 눌러 취소 사유(1~300자)를 입력하고 확정한다, **Then** 글이 `CANCELLED` 상태로 전이되고 상세 모달에 취소 사유가 노출된다. (`FR-005`)
2. **Given** 취소 사유를 비우거나 공백만 입력한 상태, **When** 취소 확정을 시도한다, **Then** 요청이 거절되고 사유 입력이 필요함을 안내한다.
3. **Given** 이미 취소(`CANCELLED`)되거나 완주(`COMPLETED`)된 글, **When** 리더가 상세 모달을 연다, **Then** 수정·마감 토글·취소 등 리더 액션 버튼이 일절 노출되지 않는다. (`NFR-003`)

---

### Edge Cases

- **마감(`CLOSED`) 상태에서 수정 시도**: 서버는 `RECRUITING` 상태에서만 수정을 허용한다(`FR-006`). 화면에서도 `CLOSED` 상태일 때 `[수정하기]`를 비활성화하고, 만약 수정하려면 먼저 `[재모집하기]`로 전환해야 함을 명확히 한다.
- **정원이 꽉 찬(`currentMembers >= maxMembers`) 글의 재모집 토글**: 정원이 찬 상태에서 `RECRUITING`으로 열어도 아무도 참여할 수 없고 즉시 정원 마감 조건과 충돌한다. 화면에서 정원이 가득 찬 `CLOSED` 글은 `[재모집하기]`를 비활성화한다.
- **설명(`description`)·장소(`place`) 비우기 vs 초대 링크(`chatUrl`) 유지**: 수정 시 설명과 장소를 빈 문자열로 제출하면 `null`로 반영되어 기존 텍스트를 지울 수 있어야 한다. 반면 `chatUrl`은 온라인/병행 모집에서 필수이고 스키마도 문자열을 요구하므로, 빈 값일 때 무효한 빈 문자열을 보내지 않고 입력된 경우에만 갱신한다.
- **중복 클릭 방어**: 수정 저장, 마감/재모집 토글, 취소 확정 요청이 진행 중(`pending`)일 때는 모든 리더 액션 버튼을 잠가 중복 호출을 막는다.
- **LIVE 핑 상세 조회 시**: LIVE 핑에는 수정·취소·마감 토글이 없으며(조기 완료만 존재), 상세 모달에서도 리더 액션 영역을 렌더하지 않는다.
- **완주 판정·회고 등록 입구 미노출 (`007b` 분리)**: 본 브랜치(`007a`)에서는 아직 포팅되지 않은 완주 판정·Post-mortem 화면으로 가는 버튼을 노출하지 않는다 (`FR-021`).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 상세 모달의 리더 액션 영역은 로그인한 유저가 해당 글의 리더 본인(`role === 'leader'`)이고, 글 유형이 `STUDY` 또는 `PARTY`이며, 상태가 최종 상태(`COMPLETED`·`CANCELLED`)가 아닐 때만 표시해야 한다. (`req FR-017`, `NFR-003`)
- **FR-002**: 리더 액션 영역은 현재 상태에 따라 수동 마감/재모집 전환 버튼을 제공해야 한다 — `RECRUITING`일 때는 `[마감하기]`(`CLOSED`로 전환), `CLOSED`일 때는 `[재모집하기]`(`RECRUITING`으로 전환)를 표시한다. (`req FR-004`)
- **FR-003**: 글이 `CLOSED` 상태이더라도 현재 인원이 정원에 도달(`currentMembers >= maxMembers`)했거나 단기 파티 마감일이 지난 경우에는 `[재모집하기]` 버튼을 비활성화해야 한다. 단기 파티 마감일이 지난 경우에는 `RECRUITING` 상태라도 `[마감하기]`를 비활성화한다. (`req FR-004`, `FR-020`)
- **FR-004**: `[수정하기]` 버튼은 `status === 'RECRUITING'`(단기 파티는 마감일 미도과)일 때만 활성화하고, `CLOSED` 상태에서는 비활성화해야 한다. (`req FR-006`)
- **FR-005**: 수정 다이얼로그에서 제목(1~40자, 필수), 설명(최대 300자, 비우면 `null`), 장소(비우면 `null`), 초대 링크(입력 시 화이트리스트 도메인 검증)를 편집할 수 있어야 하며, 온라인/온·오프라인 병행 모집에서 기존 초대 링크가 있을 때 이를 임의로 지워 무효 요청이 되지 않도록 보호해야 한다. (`req FR-006`, `NFR-002`)
- **FR-006**: `[모집 취소]` 버튼은 `RECRUITING` 및 `CLOSED` 상태 모두에서 활성화되어야 하며, 취소 사유(공백 제외 1~300자)를 필수로 입력받아야 한다. (`req FR-005`)
- **FR-007**: 수정·마감/재모집 토글·취소 중 어느 요청이든 성공 시 모달과 대시보드 화면이 최신 데이터로 즉시 갱신되어야 하며, 실패 시 서버 에러 코드에 대응하는 한국어 안내 문구를 표시해야 한다. (`CLAUDE.md` §8)
- **FR-008**: 요청 처리 중(`pending`)에는 중복 제출이 일어나지 않도록 버튼을 비활성화해야 한다.
- **FR-009**: 완주 판정 및 회고 등록 진입 버튼은 이 브랜치에서 노출하지 않아야 한다 (`007b` 범위). (`req FR-021`)

### Key Entities

- **리더 액션 가능 상태 (LeaderActionState)**: 게시글의 `type`, `status`, `currentMembers`, `maxMembers`, `endDate`, 현재 시각(`now`)으로부터 파생되는 UI 제어 모델.
  - `visible`: 리더 액션 섹션 노출 여부 (`STUDY`/`PARTY` & `RECRUITING`/`CLOSED`)
  - `canEdit`: 수정 가능 여부 (`RECRUITING` & 파티 미만료)
  - `canToggleStatus`: 마감/재모집 토글 가능 여부 (`RECRUITING`일 때 파티 미만료, `CLOSED`일 때 정원 여유 있음 & 파티 미만료)
  - `nextToggleStatus`: 토글 클릭 시 목표 상태 (`'CLOSED'` 또는 `'RECRUITING'`)
  - `canCancel`: 모집 취소 가능 여부 (`RECRUITING` 또는 `CLOSED`)
- **수정 페이로드 (UpdatePatch)**: 수정 폼 입력을 서버 계약(`updatePostSchema`)에 맞게 직렬화한 객체 (`title`, `description: string | null`, `place: string | null`, `chatUrl?: string`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 리더가 상세 모달에서 클릭 1번으로 모집 중(`RECRUITING`) 글을 마감(`CLOSED`)하거나 마감된 글을 재모집(`RECRUITING`)으로 전환할 수 있고, 변경 결과가 즉시 화면에 반영된다.
- **SC-002**: 모집 중인 글에서 제목·설명·장소·초대 링크 수정 및 설명·장소 비우기(`null` 초기화)가 100% 정상 저장되고, 마감(`CLOSED`) 상태에서는 수정 입구가 사전에 차단된다.
- **SC-003**: 리더가 취소 사유를 입력해 모집을 취소하면 즉시 `CANCELLED` 상태와 취소 사유가 상세 모달에 표시되고, 이후 모든 변경·참여 액션이 차단된다.
- **SC-004**: 비리더·게스트 세션 및 최종 상태(`COMPLETED`·`CANCELLED`)·LIVE 핑에서는 리더 액션 UI 노출이 0건이다.
- **SC-005**: 리더 액션 상태 파생 및 수정 페이로드 직렬화 단위 테스트와 기존 전체 테스트 스위트(`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm drizzle-kit check`)가 100% 통과한다.

## Assumptions

- 백엔드 Route Handler 3종(`PUT /api/posts/:id`, `POST /api/posts/:id/status`, `POST /api/posts/:id/cancel`)과 도메인 서비스(`updatePost`, `toggleStatus`, `cancelPost`)는 Phase 1에서 이미 구현·검증되어 있다.
- 취소 사유(`reason`)는 앞뒤 공백 제거 후 1~300자여야 한다. 만약 `cancelSchema`에 `.trim()`이 빠져 공백 문자열(`"   "`)이 통과할 여지가 있다면 서버 검증 스키마에서도 `.trim()`을 보강한다.
- 완주 판정 및 Post-mortem 회고 등록 화면(`007b`)은 본 브랜치 머지 후 별도 브랜치에서 진행하며, `docs/requirement.md`의 `FR-021`에 `007a`/`007b` 분할을 명시해 SSOT를 일치시킨다.

## Dependencies

- `docs/requirement.md` (`FR-004`, `FR-005`, `FR-006`, `FR-017`, `FR-020`, `FR-021`, `NFR-002`, `NFR-003`)
- `docs/trd.md` §4 (`PUT /api/posts/:id`, `POST /api/posts/:id/cancel`, `POST /api/posts/:id/status`)
- `006-dashboard-realtime`에서 구현된 `src/components/detail/PostDetailModal.tsx` 및 `src/components/detail/LeaderActions.tsx`
