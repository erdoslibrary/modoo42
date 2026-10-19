# Tasks: GitHub OAuth 로그인 및 30일 서명 세션 쿠키 (009)

**Input**: Design documents from `/specs/009-github-oauth/`
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: 세션 토큰 및 OAuth 헬퍼 모듈

- [x] T001 `tests/session.test.ts`에 `TC-AUTH-SESSION` 단위 테스트 작성 (정상 검증, 서명 위조 거부, 페이로드 변조 거부, 30일 만료 거부, 형식 오류 방어, `safeEqual` 길이 불일치 방어)
- [x] T002 `src/lib/session.ts`에 `createSessionToken`, `verifySessionToken`, `safeEqual`, `sessionCookieOptions` 및 쿠키 상수(`modoo42_session`, `modoo42_oauth_state`) 구현
- [x] T003 `src/lib/oauth.ts`에 GitHub OAuth 엔드포인트 상수 및 `NEXT_PUBLIC_APP_URL` 우선 `appBaseUrl`/`callbackUrl` 헬퍼 구현

---

## Phase 2: 유저 동기화 및 세션 우선 해석 (`src/lib/auth.ts`)

- [x] T004 `src/lib/auth.ts`에 `upsertGithubUser` 및 트랜잭션 래퍼 `syncGithubUser` 구현 (`github_id` 충돌 기준 Upsert, 타 유저 `login` 충돌 시 `stale:<github_id>` 선행 치환)
- [x] T005 `src/lib/auth.ts`의 `getCurrentUser()`가 `modoo42_session` 서명 쿠키를 1순위로 해석하고 없을 때만 Mock 페르소나로 폴백하도록 수정

---

## Phase 3: OAuth Route Handlers (`/api/auth/*`)

- [x] T006 `src/app/api/auth/github/route.ts` 구현 (32바이트 `state` 생성, `modoo42_oauth_state` 10분 쿠키 저장, GitHub authorize 리다이렉트)
- [x] T007 `src/app/api/auth/callback/route.ts` 구현 (`state` 상수 시간 검증 및 1회용 즉시 파기, 액세스 토큰 교환, `/user` 프로필 조회, `syncGithubUser` 호출, 30일 `modoo42_session` 발급 후 `/dashboard` 리다이렉트)
- [x] T008 `src/app/api/auth/logout/route.ts` 구현 (`modoo42_session` 및 `modoo42_mock_user` 즉시 만료 파기 후 `/login` 리다이렉트)

---

## Phase 4: 소개 랜딩 및 레이아웃 연동

- [x] T009 `src/app/login/page.tsx` 서비스 소개 랜딩 및 Zero-Click 리다이렉트(`me` 존재 시 `/dashboard`), 콜백 에러 안내 배너 구현
- [x] T010 `src/app/page.tsx` 루트 게이트 구현 (인증 시 `/dashboard`, 미인증 시 `/login` 리다이렉트)
- [x] T011 `src/components/layout/Sidebar.tsx` 및 `src/components/layout/LoginRequired.tsx`에 GitHub 로그인 입구 및 로그아웃(`POST /api/auth/logout`) 연결
- [x] T012 전체 검증 게이트(`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm drizzle-kit check`) 통과 확인
