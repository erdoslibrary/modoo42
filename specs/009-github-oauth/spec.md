# Feature Specification: GitHub OAuth 로그인 및 30일 서명 세션 쿠키 (009)

**Feature Branch**: `009-github-oauth`

**Created**: 2026-10-18 (사후 명세화: 2026-10-20)

**Status**: Implemented (PR #18, 커밋 `94b82a4`)

**Input**: User description: "009 GitHub OAuth 로그인 및 30일 서명 세션 쿠키 (FR-015) — 서비스 소개 랜딩(/login) 표출, GitHub OAuth 2.0 Authorization Code + state CSRF 검증(PKCE 미사용), github_id 기준 users Upsert(login 선점 충돌 시 stale:<github_id> 비켜주기), 30일 HMAC-SHA256 서명 세션 쿠키(modoo42_session) 발급 및 Zero-Click 재접속."

> **사후 작성 기록 (`docs/next-steps.md` §4):**
> 해커톤 마감 임박으로 인해 `009-github-oauth`는 2026-10-18에 사용자 결정으로 직결 구현·머지되었으며, 본 문서는 구현된 계약(`FR-015`, `trd.md` §2.2)과 아키텍처를 speckit 표준 양식으로 사후 기록한 산출물이다.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 방문자가 소개 랜딩에서 GitHub 계정으로 로그인한다 (Priority: P1)

처음 방문한 사용자가 루트(`/`) 또는 로그인 화면(`/login`)에서 서비스 소개를 확인하고 `[GitHub 계정으로 로그인]`을 클릭해 GitHub 인가를 거치면, 계정이 자동 생성/갱신되고 30일 유지 세션이 발급되어 대시보드(`/dashboard`)로 진입한다.

**Why this priority**: 상용 배포 환경에서는 로컬 Mock 인증이 비활성화되므로 실제 GitHub OAuth 로그인이 유일한 인증 수단이다 (`FR-015`).

**Independent Test**: 비로그인 상태에서 `/login`의 `[GitHub 계정으로 로그인]`을 클릭해 인가를 마친 뒤 `/dashboard`로 이동하고, `users` 테이블에 `github_id`와 `login`이 기록되며 `modoo42_session` 쿠키가 설정되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 비로그인 상태의 방문자, **When** 루트(`/`)에 접속한다, **Then** 서비스 소개 랜딩(`/login`)으로 이동하여 서비스 핵심 안내와 `[GitHub 계정으로 로그인]` 버튼을 본다. (`FR-015`)
2. **Given** `/login` 화면, **When** `[GitHub 계정으로 로그인]`을 누른다, **Then** 1회용 난수 `state`가 단기 쿠키(`modoo42_oauth_state`, 10분)에 저장되고 GitHub 인가 화면으로 이동한다. (`FR-015`)
3. **Given** GitHub 인가를 승인하고 콜백으로 돌아온 요청, **When** `state`가 쿠키 값과 일치한다, **Then** `state` 쿠키를 즉시 파기하고, GitHub 프로필의 불변 숫자 식별자(`id`)와 핸들(`login`)을 `users` 테이블에 동기화한 뒤 30일 유효 서명 세션 쿠키(`modoo42_session`)를 발급하고 `/dashboard`로 이동한다. (`FR-015`)
4. **Given** 콜백 요청에서 `state`가 누락·만료·불일치하거나 사용자가 권한 요청을 취소한 경우, **When** 콜백이 처리된다, **Then** `state` 쿠키를 즉시 파기하고 `/login?error=<사유>`로 되돌려보내며 한국어 안내 문구를 표시한다. (`FR-015`)

---

### User Story 2 - 재방문 사용자가 재로그인 없이 즉시 대시보드로 진입한다 (Priority: P1)

한 번 로그인한 사용자가 30일 이내에 다시 접속하면, 랜딩 화면을 거치지 않고 곧바로 대시보드(`/dashboard`)로 진입(Zero-Click)하며, 원할 때 사이드바에서 로그아웃할 수 있다.

**Why this priority**: 반복 접속하는 42 멤버가 매번 로그인 버튼을 누르지 않도록 30일 장기 세션과 Zero-Click 라우팅을 보장해야 한다 (`FR-015`).

**Independent Test**: 유효한 `modoo42_session` 쿠키가 있는 상태에서 `/` 또는 `/login`에 접속하면 즉시 `/dashboard`로 리다이렉트되고, 로그아웃 실행 시 세션 쿠키가 파기되어 `/login`으로 이동하는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 유효한 30일 세션 쿠키(`modoo42_session`)를 보유한 사용자, **When** `/` 또는 `/login`에 접속한다, **Then** 로그인 화면을 보지 않고 즉시 `/dashboard`로 이동한다. (`FR-015`)
2. **Given** 서명이 위조되었거나 만료 시각(30일)이 지난 `modoo42_session` 쿠키, **When** 세션을 검증한다, **Then** 비로그인(`null`)으로 판정되어 인증이 거부된다. (`FR-015`)
3. **Given** 로그인된 사용자, **When** 사이드바에서 로그아웃을 실행한다, **Then** `modoo42_session` 및 로컬 `modoo42_mock_user` 쿠키가 즉시 만료 파기되고 `/login`으로 이동한다. (`FR-015`)

---

### User Story 3 - GitHub 핸들(`login`)을 변경한 사용자도 기존 계정을 유지한다 (Priority: P2)

사용자가 GitHub에서 핸들(`login`)을 변경한 뒤 다시 로그인하더라도 불변 식별자(`github_id`)를 기준으로 기존 계정(완주 횟수·리더 횟수·스터디 이력)에 매칭되며 표시 핸들만 최신 값으로 갱신된다. 만약 과거에 다른 사용자가 쓰던 핸들을 새로 차지해 로그인하더라도 유일 제약 충돌 없이 계정이 동기화된다.

**Why this priority**: `users.login`은 `UNIQUE NOT NULL`이지만 GitHub 핸들은 변경 가능하므로, 불변 `github_id` 기준 매칭과 핸들 선점 충돌 회피가 없으면 재로그인이나 신규 가입이 실패한다 (`FR-015`, `FR-016`).

**Independent Test**: 동일 `github_id`로 바뀐 `login`을 Upsert하면 기존 `users.id`가 유지된 채 `login`만 갱신되고, 다른 `github_id` 행이 같은 `login`을 점유 중일 때 기존 행이 `stale:<github_id>`로 먼저 변경된 후 현재 유저가 정상 Upsert되는지 확인한다.

**Acceptance Scenarios**:

1. **Given** 이미 가입된 사용자(`github_id = "100"`, `login = "old_handle"`), **When** GitHub에서 핸들을 `"new_handle"`로 바꾸고 다시 로그인한다, **Then** 새 `users` 행을 만들지 않고 기존 행의 `login`만 `"new_handle"`로 갱신한다. (`FR-015`)
2. **Given** 사용자 A(`github_id = "100"`)가 과거 `"alice"` 핸들로 가입한 뒤 GitHub에서 핸들을 바꾸고 아직 재로그인하지 않은 상태, **When** 사용자 B(`github_id = "200"`)가 GitHub에서 `"alice"` 핸들을 차지해 로그인한다, **Then** 사용자 A의 `login`을 `"stale:100"`으로 먼저 비켜준 뒤 사용자 B를 `"alice"`로 정상 저장한다. (`FR-015`)

---

### Edge Cases

- **PKCE 미사용**: GitHub OAuth App은 PKCE(`code_challenge`)를 지원하지 않으므로 난수 `state` 쿠키 검증(상수 시간 비교)으로 CSRF를 방어한다.
- **`avatar_url` 미수집 및 `campus` 미결정**: 외부 프로필 이미지는 수집·저장하지 않으며(`CLAUDE.md` §7.2), GitHub 1차 인증 시점에는 `campus`를 `null`로 둔다(42 Intra 2차 인증은 `requirement.md` §1.3 보류).
- **리버스 프록시/배포 도메인 리다이렉트 호스트 오인 방지**: 콜백 URL과 리다이렉트 URL 조립 시 `NEXT_PUBLIC_APP_URL`을 최우선 사용하여 프록시 뒤에서 내부 호스트로 리다이렉트되는 문제를 막는다.
- **실제 세션과 로컬 Mock 페르소나 공존 시 우선순위**: `getCurrentUser()`는 항상 `modoo42_session`을 먼저 해석하고, 세션이 없을 때만 개발자 콘솔 게이트 뒤의 `modoo42_mock_user`를 읽는다.
- **개발 시계 점프 시 세션 만료 면제 (`010` 연동)**: 세션 발급 및 만료 검증은 개발 시계(`serverNow()`)가 아닌 실제 시각(`realNow()`)을 사용하여 미래 점프 시 로그아웃되지 않게 한다.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 `/login` 경로에서 서비스 소개와 `[GitHub 계정으로 로그인]` 진입점을 제공하고, 이미 인증된 사용자가 `/` 또는 `/login`에 접근하면 `/dashboard`로 즉시 리다이렉트해야 한다. (`req FR-015`)
- **FR-002**: 로그인 시작 요청(`GET /api/auth/github`)은 32바이트 난수 `state`를 생성해 10분 만료 `HttpOnly` 쿠키(`modoo42_oauth_state`)에 저장하고 GitHub 인가 URL(`scope=read:user`)로 리다이렉트해야 한다. (`req FR-015`)
- **FR-003**: 콜백 요청(`GET /api/auth/callback`)은 쿼리의 `state`와 쿠키의 `state`를 상수 시간 비교로 검증하고, 성공·실패 여부와 무관하게 `modoo42_oauth_state` 쿠키를 즉시 파기(1회용)해야 한다. (`req FR-015`)
- **FR-004**: 콜백은 인가 코드로 액세스 토큰을 교환해 GitHub 공개 프로필의 불변 식별자(`id`)와 핸들(`login`)만 읽어야 하며, `avatar_url`은 수집·저장하지 않고 `campus`는 `null`로 유지해야 한다. (`req FR-015`, `CLAUDE.md` §7.2)
- **FR-005**: 계정 동기화는 단일 트랜잭션 안에서 `github_id`를 기준으로 `users` 테이블에 Upsert해야 하며, 다른 `github_id` 행이 동일한 `login`을 점유 중이면 그 행의 `login`을 `stale:<github_id>`로 먼저 변경한 뒤 Upsert해야 한다. (`req FR-015`, `trd.md` §2.2-4)
- **FR-006**: 인증 성공 시 30일 만료 서명 세션 토큰(`userId.exp.sig`)을 `modoo42_session` 쿠키(`HttpOnly`, `SameSite=Lax`, 상용 `Secure`, `Path=/`)에 발급하고 `/dashboard`로 리다이렉트해야 한다. (`req FR-015`)
- **FR-007**: 로그아웃 요청(`/api/auth/logout`)은 `modoo42_session`과 `modoo42_mock_user` 쿠키를 즉시 만료시키고 `/login`으로 리다이렉트해야 한다. (`req FR-015`)
- **FR-008**: 세션 해석(`getCurrentUser()`)은 `modoo42_session`을 최우선으로 검증하고, 유효한 세션이 없을 때만 개발자 콘솔 페르소나 쿠키(`modoo42_mock_user`)로 폴백해야 한다. (`req FR-015`, `FR-027`)

### Key Entities

- **서명 세션 토큰 (SessionToken)**: `<userId>.<exp>.<sig>` 형식의 문자열. 추가 환경변수 없이 `GITHUB_CLIENT_SECRET`을 키로 한 HMAC-SHA256(`base64url`) 서명을 사용하며 유효기간은 30일(`2,592,000`초)이다.
- **OAuth State 쿠키 (`modoo42_oauth_state`)**: CSRF 방어용 1회용 난수 쿠키(유효기간 600초). 콜백 진입 시 즉시 파기된다.
- **GitHub 계정 매핑 (`users`)**: 불변 매칭 키 `github_id`(`String(profile.id)`)와 가변 표시 핸들 `login`(`profile.login`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 유효한 서명 세션 쿠키를 가진 재방문 사용자는 추가 클릭 없이 0초(단일 서버 리다이렉트) 만에 `/dashboard`로 진입한다.
- **SC-002**: 위조된 서명, 변조된 페이로드, 만료 시각(30일) 경과 토큰, 불일치 `state` 콜백은 100% 거부된다 (`TC-AUTH-SESSION`).
- **SC-003**: 사용자가 GitHub 핸들을 변경하거나 타인이 포기한 구 핸들을 차지해 로그인하더라도 유일 제약 오류 없이 100% 계정 동기화에 성공한다.
- **SC-004**: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm drizzle-kit check` 게이트가 모두 통과한다.

## Assumptions

- 서명 키는 별도 환경변수를 늘리지 않고 서버 전용 `GITHUB_CLIENT_SECRET`을 사용한다.
- 미인증 사용자의 대시보드 읽기 전용 열람 허용은 후속 요구사항인 `FR-022`(`011-guest-readonly`)에서 분리 처리한다.

## Dependencies

- `docs/requirement.md` (`FR-015`, `FR-016`)
- `docs/trd.md` §2.2 (`[Phase 4] 프로덕션 GitHub OAuth 2.0 플로우`)
