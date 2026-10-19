---
description: "다음 작업 순서와 사용자가 직접 수행해야 하는 외부 작업 목록"
---

# 다음 작업 (Next Steps)

**최종 갱신: 2026-10-20.** 기준 커밋 `894312f` (`origin/main`, `010-dev-console` 머지 직후). Phase 3은 디자인 정합성 복구(`FR-026`)까지 전부 끝났고, Phase 4의 `FR-015`(GitHub OAuth 로그인)와 `FR-027`·`FR-028`(개발자 콘솔 `010-dev-console`)이 머지됐다. **해커톤은 종료됐다. 다음 작업은 Phase 4의 남은 항목(`FR-018` Grace Period Cron → `NFR-005` Rate Limit → `FR-017` RLS)이다.**

**해커톤 마감이 임박해 `009-github-oauth`는 speckit 4단계를 돌지 않고 직결 구현했다 (2026-10-18 사용자 결정).** `specs/009-github-oauth/` 산출물(`spec.md`, `plan.md`, `tasks.md`, `checklists/requirements.md`)은 2026-10-20에 사후 작성을 완료했다. 이것은 `.claude/rules/speckit.md`의 「예외 — chore 직결 처리」에 해당하지 않는 **의도적 일회성 예외**이며, 다음 작업에서 선례로 쓰지 않는다.

이 문서는 **권위 문서가 아니다.** 범위와 요구사항은 `requirement.md`, 기술 설계는 `trd.md`, UX는 `prd.md`가 SSOT다. 여기에는 "무엇을 어떤 순서로 하는가"와 "누가 하는가"만 적는다. 내용이 어긋나면 SSOT를 따르고 이 문서를 고친다.

---

## 1. 사용자가 직접 해야 하는 작업

AI 에이전트가 대신할 수 없는 작업이다. 해당 Phase를 시작하기 전에 끝나 있어야 한다.

| # | 작업 | 필요 시점 | 왜 대신 못 하는가 |
| :--- | :--- | :--- | :--- |
| U1 | PR 생성 및 머지 | 즉시 | 저장소 권한 |
| ~~U2~~ | ~~`posts` 테이블을 `supabase_realtime` publication에 등록~~ **완료 (2026-10-18)** | — | 컬럼 목록을 지정해 등록했다: `id`, `type`, `status`, `current_members`, `max_members`, `expires_at`, `created_at`, `updated_at`. **단, 이 목록은 페이로드를 걸러내지 못한다** — `006`에서 실측해 보니 anon 구독자에게 `chat_url`까지 전부 왔다. 실제 방어선은 마이그레이션 `0003_revoke_anon_chat_url.sql`의 컬럼 단위 SELECT 권한이다 (`trd.md` §5-2) |
| ~~U3~~ | ~~`.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정 확인~~ **완료 (2026-10-18 실측)** | — | 신형 `sb_publishable_` 키로 `posts-channel` 구독이 `SUBSCRIBED`까지 가고 `INSERT`·`UPDATE` 이벤트를 받는 것을 확인했다 (`@supabase/supabase-js` 2.117.3). 레거시 anon JWT로 되돌릴 필요가 없다. 구독 직후 1초 남짓은 이벤트가 유실될 수 있어, 즉시 반영이 필요한 흐름은 서버 렌더 결과를 기준으로 둔다 |
| ~~U4~~ | ~~Vercel 프로젝트 연결~~ **완료 (2026-10-18)** | — | GitHub 저장소와 Vercel 연동 완료 (PR Preview 및 `main` 배포 자동 실행 확인) |
| U5 | 전용 테스트 DB 또는 Direct 접속(포트 5432) 확보 | Phase 4 (`NFR-006`) | Supabase 플랜·인스턴스 결정 |
| U6 | GitHub Secrets에 테스트용 `DATABASE_URL` 등록 | Phase 4, U5 이후 | 저장소 설정 권한 (현재 `gh secret list` 0건) |
| ~~U7~~ | ~~GitHub OAuth App 등록, `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 발급~~ **로컬 설정 완료 (2026-10-18)** | — | `.env.local`에 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL` 설정 확인 완료. 배포 도메인에서 OAuth를 쓸 때는 GitHub OAuth App 콜백 URL과 Vercel 환경변수에도 동일하게 등록 필요 |
| ~~U11~~ | ~~**Vercel 환경변수 + OAuth App 콜백 URL 등록**~~ **완료 (2026-10-20)** | — | Vercel Production에 `GITHUB_CLIENT_ID`·`GITHUB_CLIENT_SECRET`·`NEXT_PUBLIC_APP_URL` 및 GitHub OAuth App 콜백 URL 등록 완료 |
| ~~U8~~ | ~~**Supabase DB 비밀번호 회전** 후 `.env.local`의 `DATABASE_URL` 갱신~~ **완료 (2026-10-20)** | — | `.env.example` 자리표시자 교체 및 DB 비밀번호 회전 완료 |
| U9 | **Mock 데이터 수동 정리** — `public` 스키마에 남은 Mock 유저 4건(`github_id = 'mock:*'`)과 그 글 10건·참여 15건을 지운다. 삭제 순서는 `participants` → `posts` → `users`다 (`posts.leader_id`가 `onDelete: 'restrict'`). **주의:** `tests/identity-schema.test.ts`의 `TC-IDENT-03`이 백필 행 3건 이상을 단정하므로 **Phase 4 전체 구현 완료 후 상용 오픈 직전**에 테스트 수정과 함께 실행한다 | Phase 4 완료 후 상용 오픈 직전 | 마이그레이션에 `DELETE`를 넣으면 모든 환경에서 실행되어 실데이터를 지운다. 사람이 판단해 1회 실행해야 한다 |
| ~~U10~~ | ~~**데모 데이터 정리** — `FR-025` 시드가 넣은 `github_id = 'demo:*'` 유저와 그 글·참여를 `pnpm seed:demo --reset`으로 지운다~~ **해당 없음 (2026-10-18).** 시드를 폐기하기 전에 `--reset`을 돌려 `demo:*` 행을 전부 지웠다. 2026-10-18 실측 결과 `users`에는 `mock:*` 4건만 남아 있고 `demo:*`는 0건이다. `FR-025`를 다시 구현하면 이 항목을 되살린다 | — | — |

---

## 2. 완료 — CI 첫 실행 확인

`.github/workflows/ci.yml`의 첫 실행은 PR #6(`chore/ci-gates`)과 #7(`docs/github-oauth`)에서 끝났다. 둘 다 CI success로 `main`에 머지됐다. 셋업·`--frozen-lockfile`·더미 `DATABASE_URL` 빌드 모두 통과했으므로 Phase 3 착수 조건이 해제됐다.

---

## 3. 완료 — Phase 3 (UI 결합 & Realtime)

Phase 3의 네 브랜치가 모두 완료·머지되었다.

1. ~~`005-user-identity-schema` — `FR-016` 유저 식별 스키마 전환~~ **완료·머지됨** (PR #8, 아래 §3.1의 0번). 산출물은 `specs/005-user-identity-schema/`, 마이그레이션은 `drizzle/0002_fantastic_meteorite.sql`.
2. ~~`006-dashboard-realtime` — `FR-013`, `FR-014`, `FR-019`, `FR-020`, `NFR-004`~~ **완료·머지됨** (PR #10). 산출물은 `specs/006-dashboard-realtime/`.
3. ~~`007a-leader-actions` — 리더 기본 액션(수정 `FR-006` · 취소 `FR-005` · 마감/재모집 토글 `FR-004`)을 상세 모달에 결합~~ **완료·머지됨** (PR #13, 아래 §3.3의 2번). 산출물은 `specs/007a-leader-actions/`.
4. ~~`007b-completion-lifecycle` — 완주 판정(`FR-008`)·회고 등록(`FR-009`) 화면 포팅 및 상세 모달 표출(`FR-021`)~~ **완료·머지됨** (PR #14, 아래 §3.3의 2번). 산출물은 `specs/007b-completion-lifecycle/`.

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
2. **완주 판정·회고 등록 화면(`complete.html`·`complete_postmortem.html`) → `FR-021` 신설, 별도 브랜치로 분리.** `006-dashboard-realtime`(모집·참여·실시간 루프)을 머지한 뒤 착수한다. 006의 상세 모달에는 판정 입구 자리만 비워 둔다.

   **007은 범위가 커 두 브랜치로 쪼갠다.** 분할선은 **진입 조건**이다 — 한쪽은 모집 단계의 아무 리더, 다른쪽은 판정창 전용 + 전용 화면 포팅. 백엔드 API는 Phase 1·2에 모두 있으므로(`PUT` 수정·`cancel`·`status`·`complete`·`postmortem`) 007은 순수 프론트 결합이다.

   | 하위 | 범위 | 진입 조건 | 화면 포팅 |
   | :--- | :--- | :--- | :--- |
   | **007a 리더 기본 액션** | `PUT` 수정 · `cancel` 취소 · `status` 마감/재모집 토글 | 리더 본인, 모집/마감 상태 | 없음 (상세 모달 버튼·인라인) |
   | **007b 완주 라이프사이클** | `complete` 판정 · `postmortem` 회고 | 판정창(종료월 15일~익월 10일), `STUDY` 전용 | `complete.html` + `complete_postmortem.html` |

   007a가 모달 액션그룹 토대와 리더 인가 가드를 깔고, 007b가 그 위에 판정 화면을 올린다. 각 브랜치마다 speckit 4단계를 1바퀴 돈다.

---

## 3.4. 완료 — `008-design-fidelity` 디자인 정합성 복구 (`FR-026`)

**완료·머지됨 (PR #17, 커밋 `2b80532`).** 아래 13단계 체크리스트는 작업 기록으로 남긴다. 산출물은 `specs/008-design-fidelity/`다.

관찰 기록은 `specs/008-design-fidelity/findings.md`이고, **값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5다.** 이 문서에는 순서와 코드 지점만 적는다.

**2026-10-18에 사용자가 실제 화면을 보고 6건을 추가했다.** 전수 대조가 색·폰트 위주였고 레이아웃을 보지 않아 놓친 것들이다. 아래 10~13단계이며, `interactions.md` §3.5를 값 SSOT로 신설했다.

작업 순서:

1. ~~**전수 대조**~~ **완료 (2026-10-18).** 9화면 중 `PixelFrog.html`(도감 보류)을 뺀 8화면을 대조했다. 결과는 `findings.md` 2-B절(2-5~2-13)이다. 색 선언을 속성별로 집계하고 `class="px"` 요소 150건을 구현 클래스와 맞췄다.
2. **선택 상태 배경색 분리 (2-5).** 가장 넓다. 선택 상태는 `accent-bright`(세그먼트·탭·메뉴)와 `accent-soft`(카드), 제출·참여만 `accent`다. 고칠 곳 5개 — `feed/ArchiveTabs.tsx:36`, `create/TypeSwitch.tsx:24`, `create/LivePingForm.tsx:88`, `create/RecruitForm.tsx:194`, `profile/HistoryList.tsx:13`. 아카이브 탭은 비활성에서 그림자를 없애야 하고(`nb`가 항상 그림자를 준다), LIVE 개설 폼 제출 버튼은 `bg-live`다(`LivePingForm.tsx:112`). 사이드바(`layout/Sidebar.tsx`)가 유일하게 맞는 곳이니 거기에 맞춘다. **여섯 번째 지점이 있다 — 정렬 칩(`feed/StudyGrid.tsx:45`)은 녹색이 아니라 검정이다** (2026-10-18 사용자 결정). 활성 `#18181b` 바탕·흰 글자, 비활성은 배경·그림자 없이 테두리까지 투명하다. 값은 `interactions.md` §3.3이다.
3. **보조 텍스트 색.** `tailwind.config.ts:25`의 `muted`를 `#71717a` → `#6b705c`. 선행 문서 교정(`CLAUDE.md` §10)은 완료됐다. 사용처는 `text-muted` 51곳이고 토큰 1곳 수정으로 따라온다. 하드코딩된 `#71717a`가 남아 있는지 `grep -rn '71717a' src/`로 확인한다.
4. **액센트 버튼·탭 픽셀 폰트.** `px` 추가 + `font-bold` 제거. 고칠 파일 11개는 `findings.md` 2-3에 목록이 있다 — `src/components/card/StudyCard.tsx`, `card/PartyCard.tsx`, `detail/PostDetailModal.tsx`, `detail/JoinConfirmDialog.tsx`(2곳), `detail/LeaderActions.tsx`(3곳), `create/RecruitForm.tsx`, `create/LivePingForm.tsx`, `feed/ArchiveTabs.tsx`, `feed/LivePingBoard.tsx`. 007b가 만든 `detail/CompletionModal.tsx`는 이미 `px`를 쓰므로 대상이 아니다.
5. **랭킹 순위 뱃지.** `src/components/feed/Leaderboard.tsx:22`가 전 순위 `bg-white`이고 치수도 24px·radius 5px·border 1.5px·12px다. 원본은 26px·radius 6px·border 2px·13px에 1·2·3위 금·은·동, 4·5위 `#eceedd` 바탕 + `#6b705c` 글자다.
6. **치수 차이 (`findings.md` 2-6~2-9).** 폰트 크기·패딩·뱃지 크기가 원본보다 작은 지점들이다 — 상세 모달 CTA(16px/`16px 18px 14px`/radius 10px), 개설 페이지 제목(`create/page.tsx:49` 20px → 26px), 프로필 뱃지(56px → 84px)와 유저명(18px → 26px)·통계 숫자(20px → 22px + `accent-dark`), 섹션 제목(14px → 16px), 인원 스테퍼(14px/64px → 16px/70px). **`interactions.md` §3.3 표의 값을 쓴다.**
7. **텍스트 색 4단화 (2026-10-18 확정).** `muted`를 `#6b705c`로 교정하고 **새 토큰 2개만 만든다** — `#8a8f7a`(부속 메타, 56곳)와 `#4b5040`(본문 단락, 5곳). `#aab49c`는 사이드바 전용이라 토큰화하지 않고(`Sidebar.tsx:42`가 이미 하드코딩), `#9aa088`은 도감 보류 범위라 버린다. 근거는 `findings.md` 2-13. 토큰 이름은 `speckit-plan`에서 정한다.
8. **이니셜 뱃지는 색을 늘리지 않는다 (2026-10-18 확정).** 원본은 사람마다 배경색이 다르지만 채택하지 않는다 — 색이 사람을 식별하지 못하고 anti-ai-slop의 「색은 의미에만」에 걸린다. `InitialBadge.tsx:10`의 2종을 유지하고 **크기만** 맞춘다(34px / 리더 52px / 프로필 84px).
9. **참여자 정렬 버그 (디자인 아님, 같은 PR).** `src/lib/posts.ts`의 `getPostDetail()` 참여자 조회에 `ORDER BY`가 없다. `.orderBy(asc(participants.joinedAt), asc(users.login))` 3줄. 리더가 첫 참여 행이라 자연히 맨 앞에 온다. 데이터가 적으면 삽입 순서로 나와 숨는 버그다. **PR 본문에서 디자인 덩어리와 나누어 적는다.**
10. **본문 최대 폭 복구.** `src/components/layout/AppShell.tsx:18`의 `<main>`에 `max-width:1300px`가 없다. 원본은 `padding:30px 36px 56px;max-width:1300px`다. **이 한 줄이 "화면이 커 보인다"의 주원인이다** — 없으면 1920px 모니터에서 본문이 약 1600px까지 늘어나 카드 한 장이 400px → 520px이 된다. 같은 줄의 `min-width:1280px` 제거(375px 1열 대응)는 유지한다. `AppShell.tsx:4` 주석도 두 값을 구분해 다시 적는다.
11. **랭킹·CLI 푸터 위치.** 원본은 ① 스터디 그리드(전체 폭) ② 아카이브 + 랭킹(`1.5fr : 1fr` 한 행) ③ CLI 푸터(맨 아래, 좌측 정렬) 순이다. 구현은 랭킹·CLI를 스터디 그리드 오른쪽 300px 사이드바에 넣었다(`feed/RealtimeFeed.tsx`의 `aside` prop). **`aside` prop을 없애고 `app/dashboard/page.tsx`의 조립 순서를 바꾼다.** 이 항목만 컴포넌트 구조를 건드린다 — 데이터 흐름과 응답 계약은 그대로다.
12. **카드·개설 카드 치수.** ① 스터디 카드(`card/StudyCard.tsx`)에 `min-height:296px`와 하단 스페이서를 넣어 `[상세보기]`를 바닥에 고정한다 — 지금은 제목 줄 수에 따라 버튼 높이가 제각각이다. 패딩도 `p-4`(16px) → `24px 24px 20px`. ② 점선 개설 카드(`feed/EmptyState.tsx`)를 가로·세로 중앙 정렬하고 **42px 픽셀 개구리 SVG**를 넣는다. 개구리는 `Dashboard.html` 개설 카드가 쓰는 1종만 컴포넌트로 만든다(2026-10-18 사용자 결정) — **개구리 도감(§1.3 보류)과 무관하다.** ③ 섹션 제목 옆 건수(`feed/StudyGrid.tsx:34`)에서 흰 박스·테두리를 빼고 `#3c7a1e` 글자만 남긴다. ④ 태그 칩(`card/CardMeta.tsx`의 `TagList`)은 **첫 칸만 색이 다르다** — 첫 태그 `#3c7a1e` 글자 + `#E4F1D4` 바탕 + `#3c7a1e` 테두리, 나머지는 무채. 구현은 전부 같은 흰 칩이다. ⑤ 리더 줄(`CardMeta.tsx`의 `LeaderLine`)을 `#F4F7E8` 패널에 담고 우측에 20px 원형 `✓`를 붙인다 — **`campus !== null`일 때만 렌더한다**(2026-10-18 사용자 결정). ⑥ 카드 메타는 **항목은 그대로 두고 `모집 현황`만 하단 CTA 왼쪽으로** 내린다. `사이클`을 추가하지 않고 `진행 방식`을 빼지 않는다.

**랭킹 행 박스는 채택하지 않는다** (2026-10-18 사용자 결정). 원본은 1~3위 행에 박스를 씌우지만 메달 색만으로 충분하다고 보고 다섯 행을 같은 맨 줄로 둔다. 5단계는 뱃지 색·치수만 고친다.
13. **CLI 푸터 글꼴.** `feed/CliFooter.tsx`가 가변폭 `Galmuri11`(`.px`)을 쓴다. 원본은 고정폭 `GalmuriMono`다. CDN 배포명이 `GalmuriMono11`이라 `globals.css`에 별칭 `@font-face`가 필요하다. 선언문은 `interactions.md` §3.5에 있다. 박스가 폭을 채우지 않고(`min-width:380px`) 안내 문구가 박스 밖 아래로 나가는 것도 함께 맞춘다.

주의: 마이그레이션·스키마·API 표면 변경은 **없다**. 미등록 색(`#FF4D4F` D-Day 칩, 표면 틴트 `#eceedd`·`#f4f7e8`·`#d8dcc6`·`#F0F1E4` 등)은 실제 사용처가 확인된 것만 토큰에 넣는다. **포팅하지 않는 것은 `findings.md` 2-10에 근거와 함께 분리돼 있다** — 주차별 커리큘럼·참여자별 증빙(둘 다 저장 스키마 없음), 기간 선택 버튼(`FR-001`이 `end_date`를 자동 산출), 개구리 도감·배지(§1.3 보류). 다음 대조에서 "누락"으로 다시 세지 않는다. jsdom·testing-library를 새로 설치하지 않는다 — `vitest` 환경이 `node`이므로 Test Suite 9는 설정값·소스 문자열 정적 단정으로 구현한다 (`requirement.md` §3 Test Suite 9).

---

## 3.5. ~~Phase 3.5 — 발표용 UI 보강 & 데모 데이터~~ — §1.3 보류 (2026-10-18)

**착수하지 않는다.** 해커톤 마감까지 남은 시간을 Phase 4 GitHub OAuth에 전부 쓰기로 했다 — 배포본에서 로그인이 안 되면 심사위원이 볼 수 있는 화면이 없으므로 인증이 발표용 UI보다 앞선다. `FR-023`·`FR-024`·`FR-025`와 단기 파티 2날짜 모델·정규 스터디 1~14일 개설 차단이 함께 `requirement.md` §1.3으로 내려갔다. **`009`는 GitHub OAuth가 쓴다** (`009-github-oauth`).

아래 내용은 재개할 때 쓰려고 그대로 남긴다. 원래 범위는 `FR-023`(모집 사이클 알람 배너), `FR-024`(랭킹 완주율), `FR-025`(`pnpm seed:demo`)였다.

**시드(`FR-025`)는 한 번 만들었다가 폐기됐다 (2026-10-18).** 미완성 UI 위에서 데모를 돌리자 디자인 정합성 문제가 드러나 방향을 바꿨고, `scripts/seed-demo.ts`·`pnpm seed:demo`·`tsx`를 전부 지웠다. 폐기 전에 `--reset`으로 `demo:*` 행을 정리했다(위 U10). 다시 만들 때 재사용할 사실 3개: ① 파티는 `templateId`를 받지 않는다(넘기면 `템플릿은 정규 스터디 전용입니다` 400) ② 회고 스터디는 `postmortemPost` 전에 `toggleStatus(..., 'CLOSED')`가 필요하다(회고는 상태 전이가 아니다, `FR-009`) ③ 대량 삽입은 `ORDER BY` 없는 쿼리를 단정하는 테스트를 깨뜨린다(`getPostDetail` 사례는 `FR-026` 범위로 수정).

**범위가 커졌다.** 원래 계획은 "스키마 불변"이었으나 2026-10-18 브레인스토밍에서 도메인 규칙 2건이 바뀌었고 그중 하나는 마이그레이션을 부른다. 아래 0-b와 0은 **Phase 1 구현을 소급 변경**한다.

**규칙 수정과 데모 작업을 한 브랜치에서 병행한다** (2026-10-18 사용자 결정). 분리 제안은 기각됐다 — 발표 일정이 걸려 있어 PR을 두 번 돌리는 비용이 더 크다. 대신 **브랜치 안에서 순서를 지킨다: 0-b → 0 → 1 → 2 → 3.** 시드(3)가 바뀐 모집창·행사 기간 규칙을 전제로 데이터를 만들기 때문에, 규칙을 먼저 바꾸지 않으면 시드를 두 번 쓴다. 리뷰어가 도메인 규칙 변경과 발표용 시드를 한 PR에서 같이 보게 되므로, PR 본문에서 두 덩어리를 나눠 적는다.

코드 변경이 필요한 지점 5개:

0-b. **단기 파티 행사 기간 2날짜 모델 (`FR-001`·`FR-020`, 2026-10-18 확정).** **이 항목만 마이그레이션이 있다.** `posts.start_date`(nullable)를 신설하고 `end_date`의 의미를 마감일에서 **행사 종료일**로 바꾼다. 제약은 시작일 ∈ [오늘, 오늘+1개월], 종료일 ∈ [시작일, 시작일+13일]이다. 영향 지점:
   * `src/db/schema.ts` + `docs/trd.md` §3.2를 같은 PR에서 함께 고친다 (`CLAUDE.md` §3).
   * **기존 파티 행은 `start_date`가 `null`이다.** 백필하지 않는다 — 과거 파티의 실제 시작일을 알 수 없다. 카드·상세 모달에 `null` 분기를 둔다.
   * `src/components/card/PartyCard.tsx:8` `deadlineLine()` — "10/14 마감"에서 "10/20~10/27"로 바뀐다. 당일치기(시작일 = 종료일)는 "10/14" 한 날짜로 쓴다.
   * `src/lib/display.ts:18` `ddayLabel()` — **기준을 행사 시작일로 바꾼다** (2026-10-18 확정). 파티 레일의 "마감 임박" 정렬(`listPosts`의 `sort: 'deadline'`)도 시작일 기준이다. **호출부 3곳이 전부 `PARTY` 전용이라 분기를 나눌 필요가 없다** — `PartyCard.tsx:26`, `cli-format.ts:68`(`kind === 'parties'`), `PostDetailModal.tsx:125`(`post.type === 'PARTY'`). 정규 스터디는 `cycleLabel`을 쓴다.
   * 기대값을 고쳐야 하는 테스트: `tests/lib/display.test.ts:43`, `tests/lib/cli-format.test.ts:94`. 둘 다 `end_date`를 D-Day 기준으로 보고 `D-3`을 단정한다. **CLI 출력 포맷은 바꾸지 않는다** — 날짜 기준만 바뀐다 (`src/lib/display.ts:3` 주석의 경고 대상은 포맷이다).
   * 상세 모달 라벨 `마감`(`PostDetailModal.tsx:124`)을 `행사 기간`으로 바꾼다.
   * `src/components/create/RecruitForm.tsx:251` — 마감일 단일 Datepicker를 시작일·종료일 2개로 바꾼다.
   * `tests/party-expiry.test.ts`, `tests/posts-create.test.ts` — 날짜 검증 케이스 추가 (TC-PARTY-03·04).
   * **`FR-020`의 제외 기준이 행사 종료일로 확정됐다.** 정원 미달과 행사 시작일 도래는 제외 사유가 아니다. 행사 진행 중 중도 합류를 허용한다.

0. **정규 스터디 모집 기간 규칙 변경 (`FR-001`, 2026-10-18 확정).** 배너가 모집창을 노출하므로 선행한다. 모집은 매월 15일~말일뿐이고 `end_date`는 **항상 익월 말일**이다. `computeStudyEndDate`의 14일 분기를 없애고(`src/lib/end-date.ts:7`), `createPost`에 KST 1~14일 거절(400)을 넣는다. 영향 지점은 아래 4곳이다.
   * `tests/posts-create.test.ts:63` — "1~14일 개설 → 당월 말일" 단정을 모집창 밖 400 단정으로 바꾼다. 63~85행의 3개 케이스 전부 영향.
   * `src/app/create/page.tsx:38` — 개설 폼의 예상 종료일 표시. 모집 대기 기간에는 폼 자체를 막는다.
   * `src/lib/posts.ts:61` — `computeStudyEndDate(new Date())` 호출부. 아래 1번의 `now` 주입과 같은 지점이다.
   * **기존 데이터는 백필하지 않는다.** 당월 말일로 잡힌 기존 글은 그대로 둔다. 소급 변경은 진행 중 스터디의 판정창을 움직인다.

1. **`createPost`에 `now` 주입 추가** (`src/lib/posts.ts:51`). 현재 이 함수만 `now`를 받지 않고 내부 `new Date()`로 정규 스터디 `end_date`를 산출한다. 그래서 과거 사이클 스터디를 만들 수 없고, 명예의 전당·Post-mortem 아카이브 시드가 불가능하다. `createLivePing`·`completePost`·`postmortemPost`는 이미 `now`를 받으므로 일관성 복원이기도 하다. 생성 SQL을 직접 쓰거나 생성 후 `UPDATE`로 덮는 우회를 쓰지 않는다.
2. **`getLeaderboard`에 완주율 조인 추가** (`src/lib/posts.ts`). 공식은 `CLAUDE.md` §7.2가 SSOT다. 정렬 기준은 건드리지 않는다 — 완주율은 표시 전용이다. `src/components/feed/Leaderboard.tsx:27`이 "완주 N · 리더 N"만 렌더하므로 거기에 붙인다.
2-b. **상세 모달 리더 통계 2칸** (`src/components/detail/PostDetailModal.tsx`). `FR-026`에서 이관됐다 (2026-10-18 사용자 결정). 원본은 `about_study.html:2551~2552`에서 `리더 경험 N회`·`완주율 N%`를 `#F4F7E8` 패널 2칸(`px` 18px·`#3c7a1e`)으로 둔다. **`FR-026`은 자리도 만들지 않았다** — 완주율은 2번의 산출 함수가 필요하고, **리더 횟수는 상세 응답의 리더 타입(`PublicUser` = `{login, campus}`)에 없어 응답 계약을 넓혀야 한다.** `FR-026`은 응답 계약 불변이 제약이라 손댈 수 없었다. 여기서 리더 필드 확장을 함께 처리한다 — `PublicUser`를 바꿀지 상세 응답에만 통계 필드를 더할지는 `speckit-plan`에서 정한다. 뱃지 크기(리더 52px)는 `FR-026`이 이미 맞췄으므로 다시 세지 않는다.
3. **배너 컴포넌트와 사이클 산출 순수 함수** (`src/lib/end-date.ts`). `computeStudyEndDate`와 KST 경계 규칙을 공유한다.

판정창(`computeVerdictWindow`, `src/lib/end-date.ts:59`)과 참여 규칙(`joinPost`)은 **현행 유지로 확정됐다** (2026-10-18). 판정은 종료월 15일~익월 10일, 참여는 `RECRUITING`이고 정원이 남으면 사이클 시작 후에도 중도 합류가 된다. 코드 변경이 없다.

착수 전 확인한 사실:

* **시드는 `pnpm test`를 깨지 않는다.** `tests/setup/db.ts`가 트랜잭션 롤백으로 격리하고, 유일한 전역 단정인 `tests/leaderboard.test.ts`가 `BIG = 1_000_000` 오프셋으로 픽스처를 실데이터 위에 올린다. 데모 유저의 누적 카운트(최대 9)는 순위를 흔들지 않는다. 완주율을 추가할 때 이 단정의 기대값 객체도 같이 갱신해야 한다.
* **단기 파티 D-Day는 이미 구현돼 있다** (`src/components/card/PartyCard.tsx:26` → `ddayLabel`). 시드가 마감일을 실행 시각 기준 상대로 넣으면 그대로 렌더된다. 디자인의 고정 날짜(10/14~10/17)를 쓰면 `FR-020` Lazy Filter에 걸려 피드에서 사라진다.
* **LIVE 핑 "4시간 남음"은 표현할 수 없다.** 유효시간은 30/60/120/180분 4종뿐이다 (`CLAUDE.md` §7.1). 180분으로 바꾼다.
* **디자인의 랭킹 "완주율 98%"는 재현 대상이 아니다.** 실데이터 파생이므로 시드 내용에 따라 값이 달라진다. 완주율 분모에 **본인이 리더인 글이 포함되고 진행 중 참여도 들어간다** (`CLAUDE.md` §7.2). 시드 데이터를 그에 맞춰 설계해야 랭킹 퍼센트가 그럴듯하게 나온다.
* **시드는 모집창 규칙을 우회하지 않는다.** 위 0번으로 1~14일 개설이 막히므로, 각 사이클의 스터디를 만들 때 `createPost`에 **그 사이클의 모집 기간 안에 있는 `now`**를 넘긴다(예: 10월 사이클 아카이브는 9/20). 우회 플래그를 만들지 않는다.
* **시연 날짜가 KST 1~14일이면 개설 데모가 막힌다.** 배너는 모집 대기 상태로 뜨고 개설 버튼이 비활성화된다. 개설 플로우를 시연해야 하면 발표 시점을 15일 이후로 잡거나, 개설 화면만 따로 보여준다.
* **데모 유저는 `github_id = 'demo:*'`로 분리한다.** `mock:*`은 U9 수동 정리 대상이라 섞으면 구분이 안 된다. 삭제 순서는 `participants` → `posts` → `users`다 (`posts.leader_id`가 `onDelete: 'restrict'`).

---

## 4. 진행 중 — Phase 4 GitHub OAuth & 보안·운영 자동화

범위: `FR-015`, `FR-017`, `FR-018`, `FR-027`, `FR-028`, `NFR-005`, `NFR-006`(CI 편입). `FR-016`은 Phase 3 선행으로 옮겼고, 42 캠퍼스 파싱은 `requirement.md` §1.3 보류로 내렸다. (`FR-022` 비로그인 읽기 전용 열람은 `009-github-oauth` 실연동으로 폐기 — 비로그인 시 대시보드 접근 차단 유지)

### 4.0 구현 완료 — `010-dev-console` 개발자 콘솔 (`FR-027`·`FR-028`, 2026-10-19)

**Phase 4의 남은 항목 중 이것을 먼저 한다.** `FR-018` Grace Period 자동 이관과 `FR-008` 판정창은 달이 바뀌기를 기다리지 않고는 검증할 수 없다. 시연에서도 시각에 걸린 흐름을 보여줄 방법이 없었다. 하네스를 먼저 깔면 뒤 작업이 전부 빨라진다.

**speckit 4단계를 돈다.** `chore` 예외가 아니다 — 라우트 신설(`/api/dev/*`), 도메인 시그니처 변경(`now` 기본값 제거, `createPost`에 `now` 추가), 마이그레이션(`dev_sandbox` 스키마 + publication + 컬럼 권한) 셋 모두에 해당한다. 착수 전에 `.specify/feature.json`을 `specs/010-dev-console`로 바꾼다 — speckit 스크립트는 git 브랜치를 읽지 않는다.

설계 SSOT는 `trd.md` §2.4다. 2026-10-19 브레인스토밍에서 확정된 결정 9건 (8·9는 `speckit-specify` 단계에서 추가 확정):

1. **시계는 오프셋 1개**(`modoo42_dev_clock`의 `offsetMs`). 음수 허용, 범위 제한 없음. 패널 입력은 절대 시각(KST)이고 오프셋은 노출하지 않는다. **점프 후에도 시계는 흐른다** — LIVE 카운트다운과 만료 전이를 재현하기 위함이다. 고정(freeze) 모드는 만들지 않는다.
2. **세션 검증만 실제 시각**(`realNow()`). 미래로 31일 점프했을 때 30일 세션이 만료 판정되어 콘솔에서 쫓겨나는 것을 막는다.
3. **격리는 `dev_sandbox` 스키마.** 같은 Supabase 프로젝트 안의 두 번째 스키마다. **별도 Supabase 프로젝트와 별도 Vercel 프로젝트는 기각됐다** — 실서비스 단계가 아니라 불필요한 비용을 늘리지 않는다 (2026-10-19 사용자 결정). Vercel Preview는 기존 프로젝트의 환경이라 추가 비용이 없다(U4 완료).
4. **진입 시 초기화 + 스냅샷.** 세션 사이로 데이터가 넘어가지 않으므로 누적이 없다. "유지하고 들어가기" 선택지는 넣지 않는다 — 누적을 만드는 장치였다. 나올 때의 정리는 보조이고, 탭 종료·쿠키 만료·서버 재시작에서 실행되지 않으므로 보장은 진입 쪽에 둔다.
5. **스냅샷은 `chat_url`을 플랫폼 보존 더미 링크로 치환한다.** 실제 오픈채팅방 초대 링크를 콘솔 비밀번호 보유자에게 노출하지 않는다. `speckit-plan`에서 전건 `NULL`을 기각했다 — `chatPlatform`이 컬럼이 아니라 `chat_url`에서 파생되기 때문이다(`src/lib/posts.ts:297`). 전건 `NULL`로 만들면 플랫폼 배지가 사라지고 참여 확인 카피가 모든 글을 오프라인 전용으로 본다.
6. **세션 표식(시작 시각 + TTL)으로 2창 검증을 살린다.** 표식이 유효하면 재진입이 초기화를 건너뛰고 합류한다. 시크릿 창으로 두 번째 유저를 띄우는 `NFR-004` 검증 절차(`specs/006-dashboard-realtime/quickstart.md` §4)가 첫 창을 지우지 않게 한다.
7. **게이트는 `DEV_CONSOLE_PASSWORD` 환경변수 유무.** Production 스코프에 미설정 → 운영 도메인에서 라우트 404. `timingSafeEqual` 비교 + `modoo42_dev_console` HMAC 서명 쿠키.
8. **게이트는 그 하나뿐이다. `MockAuthModal`을 삭제한다** (2026-10-19 사용자 결정). 페르소나 전환도 콘솔 세션 뒤로 들어가고, `isMockAuthEnabled()`의 `NODE_ENV` 기준을 콘솔 게이트로 바꾼다. 게이트가 둘이면 "상용에 열리지 않는다"를 두 경로에서 지켜야 하는데 그것이 이 기능의 유일한 보안 속성이다. 대가는 로컬 `.env.local`에 `DEV_CONSOLE_PASSWORD`를 넣고 1회 로그인해야 페르소나를 쓸 수 있는 것이다. 시계 오프셋도 콘솔 세션에 종속시킨다 — 쿠키만 심어서는 시각이 변하지 않는다.
9. **샌드박스 범위는 브라우저 단위 앱 전체다** (2026-10-19 사용자 결정). 콘솔 세션 쿠키가 유효한 동안 그 브라우저의 모든 읽기·쓰기가 `dev_sandbox`를 본다. 콘솔 화면만 격리하면 샌드박스에 쓴 글이 피드·상세에 안 보여 `FR-008`·`FR-018`·`FR-020` 검증이 성립하지 않는다. `src/lib/auth.ts`가 `defaultDb`를 직접 쓰므로 현재 유저 해석도 함께 돌린다. 쿠키 삭제가 운영 복귀 경로이고, 쿠키 없는 브라우저는 영향받지 않는다.

A·B를 한 브랜치로 묶는다 (2026-10-19 사용자 결정). 사용자 프로비저닝을 기다리지 않으므로 나눌 이유가 없다. 브랜치 안의 순서는 A → B다 — 패널과 시계가 먼저 있어야 샌드박스 진입 흐름을 붙일 수 있다.

* **A (`FR-027`)** — `src/lib/clock.ts`, 도메인 `now` 기본값 제거, `createPost`에 `now` 추가, 호출부 주입(RSC 2곳 + 라우트 4곳 + `api/list`), 클라이언트 오프셋 전달, 패널 3섹션, `MockAuthModal` 삭제 및 페르소나 게이트 교체.
* **B (`FR-028`)** — `dev_sandbox` 스키마 재생, 샌드박스 drizzle 인스턴스, 핸들 주입, 스냅샷(`chat_url` 마스킹), 세션 표식, 비밀번호 게이트, publication + 컬럼 권한 마이그레이션.

`specs/010-dev-console/`의 `spec.md`·`checklists/requirements.md`·`plan.md`·`research.md`(결정 13건)·`data-model.md`·`contracts/`(2건)·`quickstart.md`·`tasks.md`(76개 작업 9단계)가 2026-10-19에 작성됐고 **`speckit-implement`로 구현이 끝났다.**

구현에서 확정된 사실 6건 (설계 문서에 없던 실측):

1. **`dev_sandbox`의 열거형은 `public`과 다른 타입이다.** `campus_type`·`post_type`·`post_status`·`location_type`·`participant_status`가 스키마 스코프라 스냅샷 INSERT가 `column "campus" is of type dev_sandbox.campus_type but expression is of type campus_type`로 거부된다. 5개 컬럼 전부 `::text::dev_sandbox.<enum>`으로 캐스트한다 (`src/lib/dev/snapshot.ts`).
2. **마이그레이션 SQL의 `"public".` 수식을 치환해야 한다.** `drizzle/0000`은 `CREATE TYPE "public"."campus_type"`과 FK `REFERENCES "public"."users"`를 쓴다. `search_path`만 바꿔서는 `public`에 손을 댄다. 재생 스크립트가 `"public".` → `"dev_sandbox".`로 바꾼다.
3. **샌드박스 `search_path`에 `public`을 넣지 않는다.** 넣으면 `dev_sandbox`에 없는 테이블이 조용히 운영 테이블로 떨어진다. `dev_sandbox, extensions`만 쓴다.
4. **raw `execute()` 경로에 `Date`를 바인딩할 수 없다.** postgres.js가 `ERR_INVALID_ARG_TYPE`로 거부한다. 표식 기록은 `toISOString()` + `::timestamptz` 캐스트로 쓴다.
5. **`joinPost`에도 `now`를 신설했다.** `posts.ts`의 파티 만료 검증이 `Date.now()`를 직접 읽고 있었다. 주입하지 않으면 `party_ended` 프리셋으로 참여 거절을 재현할 수 없다 — `tasks.md` T011에 없던 13번째 함수다.
6. **라우트 단위 테스트는 시각·핸들 모듈을 모킹해야 한다.** `tests/api/*`는 핸들러를 직접 호출하므로 `cookies()`가 요청 스코프 밖에서 던진다. `@/lib/clock`·`@/lib/dev/sandbox`를 대역으로 바꿨다. 게이트 판정을 약화시키지 않는 쪽을 택했다 — `cookies()` 실패를 삼키면 콘솔 세션의 쓰기가 운영 테이블로 떨어질 수 있다.

파일 신설 13개(`src/lib/clock.ts`, `src/lib/dev/{console-session,sandbox,snapshot,presets,journal}.ts`, `src/components/dev/{ClockProvider,DevConsole,DevConsolePanel,ConsoleEntry,PostClockJump}.tsx`, `src/app/api/dev/{console,clock}/route.ts`, `scripts/sandbox-sync.mjs`), 삭제 1개(`src/components/MockAuthModal.tsx`), 테스트 신설 5개(`tests/dev-{clock,presets,sandbox,timestamps,session-source}.test.ts`). 필수 게이트 5종 통과(342 테스트 / 37 파일). `public` 대상 새 마이그레이션 0건.

**구현·검증·머지 완료 (PR #19, 커밋 `894312f`, 2026-10-20).** `pnpm sandbox:sync` 실행(`dev_sandbox.sandbox_meta` 태그 `0003_revoke_anon_chat_url`) 및 `specs/010-dev-console/quickstart.md` 8단계 검증까지 끝났다.

`speckit-plan`에서 확정된 구현 결정 중 설계를 바꾼 것 2건: ① **`database` 기본값도 함께 제거한다** — `now`만 필수로 만들 수 없고(TS1016), 콘솔 세션에서 핸들 누락은 운영 테이블에 쓰는 사고다 (`research.md` R1). ② **`chat_url` 마스킹은 전건 `NULL`이 아니라 플랫폼 보존 더미 링크다** (`contracts/sandbox-isolation.md` S4). 재생은 `pnpm sandbox:sync`(`scripts/sandbox-sync.mjs`, `tsx` 없이 `.mjs`)가 담당하고, 스키마 버전이 어긋나면 콘솔 진입이 409로 실패한다.

착수 전 확인된 사실 4개:

* **`src/lib/posts.ts`의 도메인 함수 전부가 이미 `database: Database = defaultDb`를 받는다** (`51`·`112`·`203`·`256`·`324`·`395`·`429`·`461`·`487`·`523`·`617`·`674`). 샌드박스 격리가 호출부 교체로 끝나는 이유다.
* **유효 시각으로 교체할 직접 호출은 3곳이고, 도메인 기본 인자는 7곳이다.** 전자는 `dashboard/page.tsx:39`·`create/page.tsx:36`·`api/list/route.ts:34`, 후자는 `posts.ts:116`·`327`·`397`·`529`·`622`와 `leader-actions.ts:101`·`205`다. **`created_at`·`joined_at`은 유효 시각으로 명시 삽입한다** (2026-10-19 승인, 삽입 경로 3곳, 마이그레이션 없음) — 과거 사이클 아카이브를 만들 수 있는 유일한 경로다. 실제 시각을 유지하는 자리는 세션 검증(`session.ts`)과 로그인 갱신(`auth.ts:70`·`77`)뿐이다 (`specs/010-dev-console/spec.md` FR-022·FR-023).
* **`createPost`만 `now`를 받지 않는다** (`posts.ts:61`이 내부에서 `computeStudyEndDate(new Date())`). §3.5의 1번 부채가 이 작업에 흡수된다.
* **`DATABASE_URL`은 하나이고 배포본과 공유한다.** 그래서 지금은 로컬 `pnpm dev`에서 만든 글이 운영 피드에 보인다. `FR-028`이 이 문제를 함께 해소하지만, **U5(전용 테스트 DB)를 대체하지는 않는다** — `pnpm test`는 여전히 공용 인스턴스의 `public`에 붙는다.

**해커톤 마감 때문에 `FR-015`(로그인)를 먼저 단독으로 넣었다 (2026-10-18).** 배포본에서 로그인이 되는 것이 최우선이기 때문이다. 이미 들어간 것과 남은 것은 아래와 같다.

| 항목 | 상태 |
| :--- | :--- |
| `FR-015` GitHub OAuth 로그인·세션·랜딩·로그아웃 | **구현·머지됨 (PR #18).** `src/lib/session.ts`, `src/lib/oauth.ts`, `src/app/api/auth/{github,callback,logout}/route.ts`, `src/app/login/page.tsx`, 루트 게이트 `src/app/page.tsx`, `getCurrentUser()`의 세션 우선 해석 |
| ~~U11 Vercel 환경변수·콜백 URL 등록~~ | **완료 (2026-10-20)** |
| `FR-018` Grace Period 자동 이관 Cron | **미착수 (다음 1순위, `011-grace-period-cron`).** `010-dev-console` 시계 하네스로 즉시 검증 가능 |
| `NFR-005` Rate Limit | **미착수 (다음 2순위, `012-rate-limit`)** |
| `FR-017` RLS | **미착수 (다음 3순위, `013-supabase-rls`)** |
| `NFR-006` `pnpm test` CI 편입 | 미착수. U5·U6 선행 |
| ~~`specs/009-github-oauth/` speckit 산출물~~ | **사후 작성 완료 (2026-10-20).** `spec.md`, `plan.md`, `tasks.md`, `checklists/requirements.md` |
| ~~`FR-027`·`FR-028` 개발자 콘솔~~ | **구현·수동 검증·머지 완료 (PR #19, 2026-10-20).** 위 §4.0 |

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
