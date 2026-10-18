---
description: "다음 작업 순서와 사용자가 직접 수행해야 하는 외부 작업 목록"
---

# 다음 작업 (Next Steps)

**최종 갱신: 2026-10-18.** 기준 커밋 `3be565a` (브랜치 `chore/ci-gates`).

이 문서는 **권위 문서가 아니다.** 범위와 요구사항은 `requirement.md`, 기술 설계는 `trd.md`, UX는 `prd.md`가 SSOT다. 여기에는 "무엇을 어떤 순서로 하는가"와 "누가 하는가"만 적는다. 내용이 어긋나면 SSOT를 따르고 이 문서를 고친다.

---

## 1. 사용자가 직접 해야 하는 작업

AI 에이전트가 대신할 수 없는 작업이다. 해당 Phase를 시작하기 전에 끝나 있어야 한다.

| # | 작업 | 필요 시점 | 왜 대신 못 하는가 |
| :--- | :--- | :--- | :--- |
| U1 | PR 생성 및 머지 | 즉시 | 저장소 권한 |
| U2 | `posts` 테이블을 `supabase_realtime` publication에 등록 | Phase 3 (`FR-014`) | Supabase 대시보드 또는 직접 SQL. Drizzle 마이그레이션 밖의 작업이다 |
| U3 | `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인 | Phase 3 | 자격증명. 현재 값이 들어 있는지 확인되지 않았다 |
| U4 | Vercel 프로젝트 연결 | Phase 3 배포 시 | Vercel 계정 권한. 현재 `vercel.json` 없고 GitHub deployments 0건이다 |
| U5 | 전용 테스트 DB 또는 Direct 접속(포트 5432) 확보 | Phase 4 (`NFR-006`) | Supabase 플랜·인스턴스 결정 |
| U6 | GitHub Secrets에 테스트용 `DATABASE_URL` 등록 | Phase 4, U5 이후 | 저장소 설정 권한 |
| U7 | GitHub OAuth App 등록, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 발급. 콜백 URL은 `http://localhost:3000/api/auth/callback`과 배포 도메인 둘 다 등록한다 | Phase 4 (`FR-015`) | GitHub 계정 권한 |
| U8 | **Supabase DB 비밀번호 회전** 후 `.env.local`의 `DATABASE_URL` 갱신 및 `.env.example` 자리표시자 교체 | 저장소 공개 전환 또는 해커톤 제출 전 | Supabase 대시보드 권한 |

---

## 2. 즉시 — CI 첫 실행 확인

`chore/ci-gates` PR이 `.github/workflows/ci.yml`의 첫 실행이다. **머지 전까지 Phase 3을 시작하지 않는다.** CI 없이 Phase 3 커밋이 쌓이면 검증받지 못한 코드가 누적된다.

실패 가능 지점 3개:

| 지점 | 증상 |
| :--- | :--- |
| `pnpm/action-setup@v4` + `version: 12.11.2` | 해당 버전 배포가 없으면 셋업 단계에서 실패 |
| `pnpm install --frozen-lockfile` | lockfile과 `package.json` 불일치 시 실패 |
| `pnpm build` | 더미 `DATABASE_URL`로 돌지만 CI에는 `.env.local`이 없다. `NEXT_PUBLIC_*` 미참조를 확인했으나 실환경 첫 검증이다 |

---

## 3. Phase 3 — UI 결합 & Realtime

Phase 3은 두 브랜치로 나눈다. 순서를 지킨다.

1. `origin/main`에서 `005-user-identity-schema` — `FR-016` 유저 식별 스키마 전환. 아래 §3.1의 0번이 전부 여기 들어간다.
2. 1번 머지 후 `origin/main`에서 `006-dashboard-realtime` — `FR-013`, `FR-014`, `FR-019`, `NFR-004`.

각 브랜치마다 speckit 4단계를 순서대로 돈다 (`speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`).

### 3.1 선행 작업 (UI 포팅 전에 끝낸다)

순서가 중요하다. 0이 끝나지 않으면 캠퍼스 뱃지 조건부 렌더를 두 번 작성하게 되고, 1~2가 끝나지 않으면 포팅한 화면의 폰트와 색이 디자인과 다르게 나온다.

0. **유저 식별 스키마 전환 (`FR-016`, 별도 브랜치·별도 PR)** — `users`에 `github_id`·`login` 신설, `intra_id`·`campus`·`intra_verified_at`을 nullable로, `location_type`에 `OFFLINE_ETC` 추가. `src/db/schema.ts`와 `docs/trd.md` §3.2를 같은 PR에서 함께 고친다. 응답에 `campus`가 실리는 계약 5건(`posts-get`, `posts-list`, `cli-list`, `hall-of-fame`, `leaderboard`)과 `src/lib/posts.ts:148`의 LIVE 핑 `location_type` 파생도 같이 고친다.
1. **폰트 교체** — `src/app/layout.tsx`가 아직 Geist(`./fonts/GeistVF.woff`, `./fonts/GeistMonoVF.woff`)를 쓴다. Galmuri11 + Pretendard로 바꾼다 (`CLAUDE.md` §10).
2. **`src/app/globals.css` 정리** — 현재 `font-family: Arial, Helvetica, sans-serif`와 Next 기본 다크모드 변수가 들어 있다. 디자인 토큰(배경 `#EDEFE0`, 텍스트 `#18181b`, 액센트 `#5FB63A`)으로 교체하고 `.nb` 클래스를 추가한다 (`designs/interactions.md` §3.1).
3. **`src/app/page.tsx` 교체** — 아직 Next.js 기본 템플릿이다 (`nextjs.org/icons/next.svg` 로고 포함).
4. **Supabase 클라이언트 생성** — `@supabase/ssr`·`@supabase/supabase-js`가 설치돼 있으나 `src/` 어디에서도 import하지 않는다. `useRealtimePosts` 훅의 기반이다. U2·U3이 선행돼야 동작 검증이 가능하다.

### 3.2 화면 포팅 순서

`Dashboard.html` → `about_study.html`(상세 모달) → `create_study.html` → `myprofile.html`.

`sc-if`로 숨겨지던 분기는 별도 파일에 있다. `CLAUDE.md` §1의 분기 파일 표를 본다.

### 3.3 Phase 3 스펙 작성 때 결정해야 할 것

**단기 파티 `end_date` 도래 시 자동 `CLOSED` 전이에 FR이 배정되지 않았다.** Phase 2에서 발견된 공백이 그대로 남아 있다. `CLAUDE.md` §6.4는 "`end_date` 도래 시 판정 없이 `CLOSED`로 단순 종료한다"고 규정하지만, 이를 수행하는 주체(cron / Lazy Filter / 조회 시 전이)가 정해지지 않았다. ID를 신설하거나 §1.3 보류로 분류한다.

---

## 4. Phase 4 — GitHub OAuth & 보안·운영 자동화

범위: `FR-015`, `FR-017`, `FR-018`, `NFR-005`, `NFR-006`(CI 편입). `FR-016`은 Phase 3 선행으로 옮겼고, 42 캠퍼스 파싱은 `requirement.md` §1.3 보류로 내렸다.

인증 방식은 **GitHub OAuth 2.0 Authorization Code**다. PKCE는 GitHub OAuth App이 지원하지 않으므로 쓰지 않고 `state` 검증으로 CSRF를 막는다 (`trd.md` §2.2). U7이 선행 조건이다.

우선순위가 명확한 항목 2개:

1. **`GET /api/list` Rate Limit.** 이 엔드포인트는 인증이 없고 호출 제한도 없으면서 작성자 `login`과 LIVE 핑의 물리적 위치(예: "클러스터 2층")를 함께 공개한다. 외부인이 특정 카뎃의 실시간 위치를 무제한 조회할 수 있다. 노출은 최대 3시간 휘발 정보로 한정되고 `chat_url`은 제외되지만, `NFR-005` 작업의 **최우선 대상**이다. 근거는 `specs/004-live-ping-cli/result.md` §6.
2. **`pnpm test` CI 편입.** U5·U6이 선행 조건이다. 현재는 PR 제출 전 로컬 필수 게이트다 (`trd.md` §6.1 "실행 위치").

Vercel 연결(U4) 후에는 preview 빌드와 CI의 `pnpm build`가 중복된다. 그때 CI에서 `build`를 뺄지 판단한다 (`trd.md` §6.3).

---

## 5. 보류 항목

`requirement.md` §1.3이 SSOT다. 착수 시 `FR-020` 이후 ID를 신설하고, 신규 테이블이 필요하면 `trd.md` §3.2에 함께 정의한다.

* 42 Intra 추가 인증 및 캠퍼스 뱃지 — 범위는 `intra_id`·`campus`·`intra_verified_at` 채우기와 뱃지 표출까지. 기수 표기와 42 전용 기능 게이팅은 범위 밖. 컬럼은 `FR-016`에서 미리 만들어 두므로 추가 마이그레이션이 필요 없다.
* 개구리 도감 / 무지개 개구리 도감 — 수집 단위, 획득 조건, 저장 스키마 미정.
* 획득 배지 — 배지 종류, 수여 트리거, 중복 수여 정책 미정.
