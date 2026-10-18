# Research: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Feature**: `007b-completion-lifecycle` | **Date**: 2026-10-18

## R1: 마무리 화면(`complete.html` · `complete_postmortem.html`) 결합 형태 — `<dialog>` 모달 vs 별도 라우트

- **Decision**: 상세 모달(`PostDetailModal.tsx` → `LeaderActions.tsx`) 내부에서 열리는 네이티브 `<dialog>` 컴포넌트(`src/components/detail/CompletionModal.tsx`)로 포팅한다.
- **Rationale**:
  - `006-dashboard-realtime`의 R7("모달은 네이티브 `<dialog>`로 만든다")·R12("라우트는 4개만 만들고 ... 보호 라우트 목록을 `trd.md` §2.2가 `/dashboard`·`/create`로 전제") 및 `007a-leader-actions`의 `LeaderActions.tsx` 패턴과 완전히 일관된다.
  - `docs/prd.md` F4·F5는 상세 모달 내 `[스터디 종료 및 결과 기록]` 클릭 시 "단일 모달에서 2가지 경로(완주 성공 / Post-mortem 회고 등록) 중 선택"한다고 명시하고 있다.
  - 판정 또는 회고 등록 직후 `router.refresh()`로 대시보드(`🏆명예의 전당`·`🪦Post-mortem`·`성실 멤버 랭킹`)와 상세 모달이 페이지 이탈 없이 즉시 갱신된다.
- **Alternatives considered**:
  - 별도 페이지 라우트(`/posts/[id]/complete` 등) 신설: `trd.md` §2.2의 보호 라우트 목록을 늘리고 대시보드 배경 맥락을 잃어 기각.

## R2: 디자인 원본 `complete.html`과 요구사항(`FR-008`) 간 차이 해소

- **Decision**: `CLAUDE.md` §1의 문서 우선순위(`requirement.md` > `trd.md` > `prd.md` > 디자인 HTML)에 따라 다음 두 가지를 확정한다:
  1. **팀원 완주 체크박스 목록 필수 포함**: `[🏆 완주했어요]` 경로 상단에 리더를 제외한 `JOINED` 참여 팀원 체크박스 목록(기본값 전원 체크 `true`)을 배치한다.
  2. **증빙 URL(`proofUrl`) 단일 선택 입력**: 디자인 원본의 복수 입력칸(`GH`, `N`, `+ 링크 추가`) 대신, DB 스키마(`posts.proof_url: text`)와 API 계약(`completePostSchema`: `proofUrl?: string`)에 맞춰 `https://` 단일 선택 입력란 1개로 포팅한다.
- **Rationale**:
  - 백엔드 `completePost`(`src/lib/posts.ts` L529-554)는 리더 제외 `JOINED` 참여자 전원의 `{ userId, isCompleted }` 배열을 필수로 검증하며 최소 1명 이상이 `isCompleted: true`여야 통과한다. 체크박스 UI가 없으면 리더가 중도 이탈자를 구분해 판정할 수 없다 (`requirement.md` FR-008, `prd.md` F5).
  - `posts.proof_url`은 단일 `text` 컬럼이고 `completePostSchema`도 `proofUrl: referenceUrlSchema.optional()` 단일 문자열만 받는다.

## R3: 리더 전용 판정 대상 팀원 식별자(`verdictMembers`) 전달과 `TC-IDENT-04` 보존

- **Decision**: `getPostDetail(postId, viewerId, database)`에서 기존 `leader`와 `participants`(`PublicUser[]`: `{ login, campus }`)는 그대로 유지하고, 조회자가 해당 글의 리더 본인(`viewerId === post.leaderId`)일 때만 `verdictMembers: VerdictMember[]`(`{ userId, login, campus }`) 필드를 응답에 추가한다. 또한 상세 모달 표출을 위해 `proofUrl`과 `postmortemText`를 `PostDetail`에 포함한다.
- **Rationale**:
  - `TC-IDENT-04`(`tests/posts-detail.test.ts` L42)는 `detail.leader`와 `detail.participants`의 원소가 `{ login, campus }`만 가짐을 단언한다. `participants` 배열 자체에 `userId`를 섞으면 `TC-IDENT-04`가 깨지고 비리더에게도 내부 UUID가 노출된다.
  - 반면 `POST /api/posts/:id/complete`는 `evaluations: [{ userId: uuid, isCompleted: boolean }]`를 요구하므로, 리더 본인에게만 `verdictMembers`를 조건부로 내려주면(`chatUrl`을 참여자에게만 내려주는 패턴과 동일) `TC-IDENT-04`와 최소 노출 원칙을 모두 지킬 수 있다.
- **Alternatives considered**:
  - `completePost`가 `userId` 대신 `login`을 받도록 백엔드 계약 변경: Phase 2에서 확정된 API 계약(`specs/003-completion-lifecycle/contracts/posts-complete.md`) 및 `tests/posts-complete.test.ts` 전체와 충돌하므로 기각.

## R4: 판정 창(`computeVerdictWindow`) 및 경로별 활성 조건 파생

- **Decision**: `src/lib/leader-actions.ts`에 순수 함수 `completionActionStateOf(post, role, now)`와 페이로드 빌더 `buildCompletePayload`, `buildPostmortemPayload`를 추가한다.
  - **입구 노출(`showEntry`)**: `role === 'leader' && post.type === 'STUDY' && (post.status === 'RECRUITING' || post.status === 'CLOSED')`. (`PARTY`·`LIVE`·최종 상태는 미노출)
  - **모달 오픈 가능(`canOpenModal`)**: `post.endDate !== null && now >= computeVerdictWindow(post.endDate).opensAt`. 창이 열리기 전(`now < opensAt`)에는 버튼을 비활성화하고 오픈 예정일(`종료월 15일 오픈`)을 안내한다.
  - **완주 판정 경로 활성(`canComplete`)**: `opensAt <= now <= closesAt` && `post.postmortemText === null` && `(post.verdictMembers?.length ?? 0) >= 1`.
    - 미충족 시 `canComplete: false`와 구체적 사유(`completeDisabledReason`: 팀원 0명 / 이미 회고 등록됨 / 판정 기한 경과)를 반환하고, 모달 기본 선택(`defaultChoice`)을 `'postmortem'`으로 전환한다.
  - **Post-mortem 경로 활성(`canPostmortem`)**: `now >= opensAt`이면 기한 제한 없이 허용(기존 회고 덮어쓰기 포함).
- **Rationale**: 백엔드 `completePost`와 `postmortemPost`의 시간·상태·배타성 규칙을 프론트에서 1:1로 반영해 불필요한 400 에러를 예방하고 명확한 UX 가이드를 제공한다.
