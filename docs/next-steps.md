---
description: "다음 작업 순서와 사용자가 직접 수행해야 하는 외부 작업 목록"
---

# 다음 작업 (Next Steps)

**최종 갱신: 2026-10-18.** 기준 커밋 `cde4585` (브랜치 `006-dashboard-realtime` 구현 완료, PR 대기).

이 문서는 **권위 문서가 아니다.** 범위와 요구사항은 `requirement.md`, 기술 설계는 `trd.md`, UX는 `prd.md`가 SSOT다. 여기에는 "무엇을 어떤 순서로 하는가"와 "누가 하는가"만 적는다. 내용이 어긋나면 SSOT를 따르고 이 문서를 고친다.

---

## 1. 사용자가 직접 해야 하는 작업

AI 에이전트가 대신할 수 없는 작업이다. 해당 Phase를 시작하기 전에 끝나 있어야 한다.

| # | 작업 | 필요 시점 | 왜 대신 못 하는가 |
| :--- | :--- | :--- | :--- |
| U1 | PR 생성 및 머지 | 즉시 | 저장소 권한 |
| ~~U2~~ | ~~`posts` 테이블을 `supabase_realtime` publication에 등록~~ **완료 (2026-10-18)** | — | 컬럼 목록을 지정해 등록했다: `id`, `type`, `status`, `current_members`, `max_members`, `expires_at`, `created_at`, `updated_at`. **단, 이 목록은 페이로드를 걸러내지 못한다** — `006`에서 실측해 보니 anon 구독자에게 `chat_url`까지 전부 왔다. 실제 방어선은 마이그레이션 `0003_revoke_anon_chat_url.sql`의 컬럼 단위 SELECT 권한이다 (`trd.md` §5-2) |
| ~~U3~~ | ~~`.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인~~ **완료 (2026-10-18 실측)** | — | 신형 `sb_publishable_` 키로 `posts-channel` 구독이 `SUBSCRIBED`까지 가고 `INSERT`·`UPDATE` 이벤트를 받는 것을 확인했다 (`@supabase/supabase-js` 2.117.3). 레거시 anon JWT로 되돌릴 필요가 없다. 구독 직후 1초 남짓은 이벤트가 유실될 수 있어, 즉시 반영이 필요한 흐름은 서버 렌더 결과를 기준으로 둔다 |
| U4 | Vercel 프로젝트 연결 | Phase 3 배포 시 | Vercel 계정 권한. 현재 `vercel.json` 없고 GitHub deployments 0건이다 |
| U5 | 전용 테스트 DB 또는 Direct 접속(포트 5432) 확보 | Phase 4 (`NFR-006`) | Supabase 플랜·인스턴스 결정 |
| U6 | GitHub Secrets에 테스트용 `DATABASE_URL` 등록 | Phase 4, U5 이후 | 저장소 설정 권한 |
| U7 | GitHub OAuth App 등록, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 발급. 콜백 URL은 `http://localhost:3000/api/auth/callback`과 배포 도메인 둘 다 등록한다 | Phase 4 (`FR-015`) | GitHub 계정 권한 |
| U8 | **Supabase DB 비밀번호 회전** 후 `.env.local`의 `DATABASE_URL` 갱신 및 `.env.example` 자리표시자 교체 | 저장소 공개 전환 또는 해커톤 제출 전 | Supabase 대시보드 권한 |
| U9 | **Mock 데이터 수동 정리** — `FR-016` 전환에서 백필로 남은 Mock 유저 3건(`github_id = 'mock:*'`)과 그 글 3건·참여 6건을 지운다. 글·참여를 먼저 지워야 한다 (`posts.leader_id`가 `onDelete: 'restrict'`) | 상용 피드에 실사용자 글이 올라가기 전 | 마이그레이션에 `DELETE`를 넣으면 모든 환경에서 실행되어 실데이터를 지운다. 사람이 판단해 1회 실행해야 한다 |

---

## 2. 완료 — CI 첫 실행 확인

`.github/workflows/ci.yml`의 첫 실행은 PR #6(`chore/ci-gates`)과 #7(`docs/github-oauth`)에서 끝났다. 둘 다 CI success로 `main`에 머지됐다. 셋업·`--frozen-lockfile`·더미 `DATABASE_URL` 빌드 모두 통과했으므로 Phase 3 착수 조건이 해제됐다.

---

## 3. Phase 3 — UI 결합 & Realtime

Phase 3은 세 브랜치로 나눈다. 순서를 지킨다.

1. ~~`005-user-identity-schema` — `FR-016` 유저 식별 스키마 전환~~ **완료·머지됨** (PR #8, 아래 §3.1의 0번). 산출물은 `specs/005-user-identity-schema/`, 마이그레이션은 `drizzle/0002_fantastic_meteorite.sql`.
2. ~~`006-dashboard-realtime` — `FR-013`, `FR-014`, `FR-019`, `FR-020`, `NFR-004`~~ **구현 완료, PR 대기.** 남은 것은 브라우저 실측 2건이다: `specs/006-dashboard-realtime/tasks.md`의 T067(375px 반응형)과 T071(quickstart §3 수동 11건·§4 실시간 4건). 원래 내용: 선행 외부 작업 U2·U3은 완료됐다. **Realtime 검증 작업은 tasks.md 마지막 Phase에 둔다** — 화면 포팅(`FR-013`·`FR-019`)과 선행 작업 1~3은 Realtime 없이 진행되므로 순서를 섞으면 불필요하게 막힌다. 산출물은 `specs/006-dashboard-realtime/`.
3. 006 머지 후 `007` — `FR-021` 완주 판정·회고 등록 화면 포팅 (아래 §3.3의 2번).

각 브랜치마다 speckit 4단계를 순서대로 돈다 (`speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`).

### 3.1 선행 작업 (UI 포팅 전에 끝낸다)

순서가 중요하다. 0이 끝나지 않으면 캠퍼스 뱃지 조건부 렌더를 두 번 작성하게 되고, 1~2가 끝나지 않으면 포팅한 화면의 폰트와 색이 디자인과 다르게 나온다.

0. ~~**유저 식별 스키마 전환 (`FR-016`, 별도 브랜치·별도 PR)**~~ **완료.** `users`에 `github_id`·`login` 신설, `intra_id`·`campus`·`intra_verified_at` nullable 전환, `location_type`에 `OFFLINE_ETC` 추가. 응답 계약 5건의 유저 투영을 `login`으로 통일하고 LIVE 핑 파생을 `campusToLocationType()`으로 옮겼다. Mock 페르소나는 4종(`github_only` 추가)이 됐다. 열거형 값 추가는 전진 전용이라 되돌릴 수 없다.
1. ~~**폰트 교체**~~ **완료 (006).** Galmuri11 + Pretendard를 CDN `@import`로 올리고 `layout.tsx`에서 Geist를 걷어냈다. 원래 내용: `src/app/layout.tsx`가 아직 Geist(`./fonts/GeistVF.woff`, `./fonts/GeistMonoVF.woff`)를 쓴다. Galmuri11 + Pretendard로 바꾼다 (`CLAUDE.md` §10).
2. ~~**`src/app/globals.css` 정리**~~ **완료 (006).** 디자인 토큰은 `tailwind.config.ts`에, `.nb`·`.px`·`.hs`·`pulse`는 `globals.css`의 `@layer components`에 있다. 원래 내용: 현재 `font-family: Arial, Helvetica, sans-serif`와 Next 기본 다크모드 변수가 들어 있다. 디자인 토큰(배경 `#EDEFE0`, 텍스트 `#18181b`, 액센트 `#5FB63A`)으로 교체하고 `.nb` 클래스를 추가한다 (`designs/interactions.md` §3.1).
3. ~~**`src/app/page.tsx` 교체**~~ **완료 (006).** `/dashboard`로 리다이렉트한다. 원래 내용: 아직 Next.js 기본 템플릿이다 (`nextjs.org/icons/next.svg` 로고 포함).
4. ~~**Supabase 클라이언트 생성**~~ **완료 (006).** `src/lib/supabase/client.ts` + `src/hooks/useRealtimePosts.ts`. 원래 내용: `@supabase/ssr`·`@supabase/supabase-js`가 설치돼 있으나 `src/` 어디에서도 import하지 않는다. `useRealtimePosts` 훅의 기반이다. U2·U3이 선행돼야 동작 검증이 가능하다.

### 3.2 화면 포팅 순서

`Dashboard.html` → `about_study.html`(상세 모달) → `create_study.html` → `myprofile.html`.

`sc-if`로 숨겨지던 분기는 별도 파일에 있다. `CLAUDE.md` §1의 분기 파일 표를 본다.

### 3.3 결정 완료 — Phase 3 스펙 작성 시 해소된 공백 2건 (2026-10-18)

1. **단기 파티 `end_date` 도래 처리 → `FR-020` 신설, Lazy Filter 채택.** 상태 전이와 cron 없이 조회에서 제외하고 참여를 400(`CLOSED`)으로 거절한다. LIVE 핑 만료(`FR-011`)와 같은 방식이라 운영 부담이 0이고 이미 검증된 패턴이다. `requirement.md` FR-020·TC-PARTY-01·02, `CLAUDE.md` §6.4, `prd.md` §1-5·F5를 같은 PR에서 함께 고쳤다.
2. **완주 판정·회고 등록 화면(`complete.html`·`complete_postmortem.html`) → `FR-021` 신설, 별도 브랜치로 분리.** `006-dashboard-realtime`(모집·참여·실시간 루프)을 머지한 뒤 `007`에서 리더 액션 묶음(수정·취소·판정·회고)으로 한 번에 포팅한다. 006의 상세 모달에는 판정 입구 자리만 비워 둔다.

---

## 4. Phase 4 — GitHub OAuth & 보안·운영 자동화

범위: `FR-015`, `FR-017`, `FR-018`, `NFR-005`, `NFR-006`(CI 편입). `FR-016`은 Phase 3 선행으로 옮겼고, 42 캠퍼스 파싱은 `requirement.md` §1.3 보류로 내렸다.

인증 방식은 **GitHub OAuth 2.0 Authorization Code**다. PKCE는 GitHub OAuth App이 지원하지 않으므로 쓰지 않고 `state` 검증으로 CSRF를 막는다 (`trd.md` §2.2). U7이 선행 조건이다.

우선순위가 명확한 항목 4개:

1. **`GET /api/list` Rate Limit.** 이 엔드포인트는 인증이 없고 호출 제한도 없으면서 작성자 `login`과 LIVE 핑의 물리적 위치(예: "클러스터 2층")를 함께 공개한다. 외부인이 특정 카뎃의 실시간 위치를 무제한 조회할 수 있다. 노출은 최대 3시간 휘발 정보로 한정되고 `chat_url`은 제외되지만, `NFR-005` 작업의 **최우선 대상**이다. 근거는 `specs/004-live-ping-cli/result.md` §6.
2. **`pnpm test` CI 편입.** U5·U6이 선행 조건이다. 현재는 PR 제출 전 로컬 필수 게이트다 (`trd.md` §6.1 "실행 위치").
3. **RLS 활성화 시 Realtime 구독 점검.** `FR-017`로 `posts`에 RLS를 켜면 브라우저의 `postgres_changes` 구독이 RLS 평가를 받는다. 구독 주체가 통과할 `SELECT` 정책이 없으면 이벤트가 **에러 없이 조용히** 끊기고 `NFR-004`가 깨진다. 정책을 추가할 때 `006`의 2창 검증(`specs/006-dashboard-realtime/quickstart.md` §4)을 다시 돌린다. 근거는 `specs/006-dashboard-realtime/research.md` R11. **그리고 `chat_url` 차단은 RLS가 아니라 컬럼 단위 SELECT 권한(마이그레이션 `0003_revoke_anon_chat_url.sql`)이 맡는다.** RLS 정책을 쓰면서 권한을 다시 테이블 단위로 넓히면 `chat_url`이 구독자에게 다시 흘러간다 (`trd.md` §5-2).
4. **GitHub 핸들 선점 충돌 처리.** `users.login`은 `UNIQUE NOT NULL`인데 GitHub 핸들은 유저가 바꿀 수 있다. A가 `foo`에서 `bar`로 바꾸고 재로그인하지 않은 사이 B가 GitHub에서 `foo`를 차지해 로그인하면, B의 Upsert가 A의 행이 쥔 `login`과 충돌해 실패한다. `FR-015` 스펙 작성 시 ① 충돌 시 기존 행의 `login` 재조회·갱신 ② 유일 제약 해제 중 하나를 고른다. 근거는 `specs/005-user-identity-schema/research.md` R9.

Vercel 연결(U4) 후에는 preview 빌드와 CI의 `pnpm build`가 중복된다. 그때 CI에서 `build`를 뺄지 판단한다 (`trd.md` §6.3).

---

## 5. 보류 항목

`requirement.md` §1.3이 SSOT다. 착수 시 `FR-020` 이후 ID를 신설하고, 신규 테이블이 필요하면 `trd.md` §3.2에 함께 정의한다.

* 42 Intra 추가 인증 및 캠퍼스 뱃지 — 범위는 `intra_id`·`campus`·`intra_verified_at` 채우기와 뱃지 표출까지. 기수 표기와 42 전용 기능 게이팅은 범위 밖. 컬럼은 `FR-016`에서 미리 만들어 두므로 추가 마이그레이션이 필요 없다.
* 개구리 도감 / 무지개 개구리 도감 — 수집 단위, 획득 조건, 저장 스키마 미정.
* 획득 배지 — 배지 종류, 수여 트리거, 중복 수여 정책 미정.
