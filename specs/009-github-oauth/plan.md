# Implementation Plan: GitHub OAuth 로그인 및 30일 서명 세션 쿠키 (009)

**Branch**: `009-github-oauth` | **Date**: 2026-10-18 (사후 문서화: 2026-10-20) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-github-oauth/spec.md`

## Summary

배포 환경에서 실제 사용자 인증이 동작하도록 Supabase Auth 외부 의존성 없이 Next.js Route Handler 기반 GitHub OAuth 2.0 Authorization Code 플로우(`state` CSRF 검증)와 `GITHUB_CLIENT_SECRET` 기반 30일 HMAC-SHA256 서명 세션 쿠키(`modoo42_session`)를 구현한다.

## Technical Context

**Language/Version**: TypeScript 5, Node.js (Next.js 14 App Router)
**Primary Dependencies**: Next.js 14, Node `crypto` (`createHmac`, `timingSafeEqual`, `randomBytes`), Drizzle ORM (`drizzle-orm`, `postgres`)
**Storage**: Supabase PostgreSQL (`users` 테이블 — `005-user-identity-schema`에서 `github_id`·`login` 준비 완료, 추가 마이그레이션 없음)
**Testing**: Vitest (`tests/session.test.ts`, `tests/lib/auth.test.ts`)
**Target Platform**: Vercel Serverless & Local Dev
**Constraints**:
- GitHub OAuth App은 PKCE를 지원하지 않으므로 `modoo42_oauth_state` 단기 쿠키 + `timingSafeEqual`로 CSRF를 방어한다.
- 추가 서명 키 환경변수를 도입하지 않고 `GITHUB_CLIENT_SECRET`으로 세션을 서명한다.
- `avatar_url`은 수집하지 않으며 `campus`는 `null`로 둔다 (`CLAUDE.md` §7.2).

## Constitution Check

- **I. 사양 주도 · 테스트 우선**: 해커톤 마감 직전 사용자 결정으로 일회성 직결 구현 후 본 문서로 사후 보완 완료 (`docs/next-steps.md` 명시). 세션 서명·검증 및 유저 Upsert 테스트 포함.
- **II. 문서 SSOT 우선**: `docs/requirement.md` `FR-015` 및 `docs/trd.md` §2.2와 100% 일치.
- **III. 도메인 불변식 고정**: `avatar_url` 미수집, `github_id` 불변 키 매칭, `campus` nullable 준수.
- **IV. 동시성 · 상태 머신 무결성**: `syncGithubUser`에서 핸들 선점 회피(`stale:<github_id>`)와 Upsert를 단일 트랜잭션(`db.transaction`)으로 처리.
- **V. 보안 경계 · 링크 가시성**: `HttpOnly`, `SameSite=Lax`, 상용 `Secure` 쿠키 적용 및 `timingSafeEqual` 상수 시간 비교 적용.

## Project Structure

### Documentation (this feature)

```text
specs/009-github-oauth/
├── spec.md
├── plan.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── session.ts                 # HMAC-SHA256 세션 토큰 생성·검증, safeEqual, 쿠키 옵션
│   ├── oauth.ts                   # GitHub OAuth URL 상수 및 NEXT_PUBLIC_APP_URL 기반 콜백 URL 조립
│   └── auth.ts                    # upsertGithubUser, syncGithubUser, getCurrentUser 세션 우선 해석
├── app/
│   ├── page.tsx                   # 루트 게이트 (인증 시 /dashboard, 미인증 시 /login)
│   ├── login/
│   │   └── page.tsx               # 서비스 소개 랜딩 + 에러 배너 + Zero-Click 리다이렉트
│   └── api/
│       └── auth/
│           ├── github/route.ts    # state 발급 + GitHub 인가 화면 리다이렉트
│           ├── callback/route.ts  # state 검증 + 토큰 교환 + 프로필 조회 + Upsert + 세션 발급
│           └── logout/route.ts    # 세션 및 Mock 쿠키 파기 후 /login 리다이렉트
└── components/
    └── layout/
        ├── Sidebar.tsx            # 로그인/로그아웃 액션 연결
        └── LoginRequired.tsx      # 미인증 안내 화면 로그인 버튼 연결

tests/
└── session.test.ts                # TC-AUTH-SESSION 서명·위조·만료·상수시간 비교 단위 테스트
```

## Key Design Decisions

1. **서명 토큰 포맷 (`userId.exp.sig`)**:
   - DB 세션 테이블 조회 없이 서명과 만료 시각(`exp`, 초 단위 Unix timestamp)을 먼저 검증한 뒤 유효할 때만 `users` 행을 조회한다.
   - 서명은 `createHmac('sha256', GITHUB_CLIENT_SECRET).update(`${userId}.${exp}`).digest('base64url')`로 생성하고 `safeEqual`로 검증한다.
2. **핸들(`login`) 선점 충돌 해소 (`upsertGithubUser`)**:
   - 트랜잭션 내에서 `where(eq(users.login, login))`을 먼저 조회해 `owner.githubId !== githubId`인 구 행이 있으면 `login = 'stale:' + owner.githubId`로 비켜준 뒤 `onConflictDoUpdate({ target: users.githubId })`를 실행한다.
3. **콜백 URL 조립 (`appBaseUrl`)**:
   - `NEXT_PUBLIC_APP_URL`이 설정되어 있으면 후행 슬래시를 제거해 최우선 사용하고, 없을 때만 `new URL(request.url).origin`으로 폴백한다.
