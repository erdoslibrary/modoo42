---
description: "다음 작업 순서와 사용자가 직접 수행해야 하는 외부 작업 목록"
---

# 다음 작업 (Next Steps)

**최종 갱신: 2026-10-18.** 기준 커밋 `d1866a7` (`007b-completion-lifecycle` PR #14 머지됨 — Phase 3 전체 완료).

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
| U8 | **Supabase DB 비밀번호 회전** 후 `.env.local`의 `DATABASE_URL` 갱신 (`.env.example` 자리표시자 교체는 완료됨) | 저장소 공개 전환 또는 해커톤 제출 전 | Supabase 대시보드 권한 |
| U9 | **Mock 데이터 수동 정리** — `FR-016` 전환에서 백필로 남은 Mock 유저 3건(`github_id = 'mock:*'`)과 그 글 3건·참여 6건을 지운다. 글·참여를 먼저 지워야 한다 (`posts.leader_id`가 `onDelete: 'restrict'`) | 상용 피드에 실사용자 글이 올라가기 전 | 마이그레이션에 `DELETE`를 넣으면 모든 환경에서 실행되어 실데이터를 지운다. 사람이 판단해 1회 실행해야 한다 |
| U10 | **데모 데이터 정리** — `FR-025` 시드가 넣은 `github_id = 'demo:*'` 유저와 그 글·참여를 `pnpm seed:demo --reset`으로 지운다. U9와 달리 **발표가 끝난 뒤**다 | 해커톤 발표 종료 후, 실사용자 모집이 시작되기 전 | 발표 전까지는 남아 있어야 하는 데이터다. 삭제 시점을 사람이 판단한다 |

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

## 3.5. Phase 3.5 — 발표용 UI 보강 & 데모 데이터

범위: `FR-023`(모집 사이클 알람 배너), `FR-024`(랭킹 완주율), `FR-025`(`pnpm seed:demo`). 해커톤 발표·심사용이며 007b 머지 직후 ~ Phase 4 착수 전에 넣는다. 브랜치 1개(`008-hackathon-demo`)에서 speckit 4단계를 1바퀴 돈다.

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

## 4. Phase 4 — GitHub OAuth & 보안·운영 자동화

범위: `FR-015`, `FR-017`, `FR-018`, `FR-022`, `NFR-005`, `NFR-006`(CI 편입). `FR-016`은 Phase 3 선행으로 옮겼고, 42 캠퍼스 파싱은 `requirement.md` §1.3 보류로 내렸다.

`FR-022`(비로그인 읽기 전용 열람)는 2026-10-18에 신설했다. 기존 `FR-015`와 `prd.md` §F1이 "비로그인 대시보드 접근 원천 불가 + 307 리다이렉트"를 못박고 있었으므로 두 문서를 같은 커밋에서 함께 고쳤다. **해커톤 시연 일정과 맞물린다** — 상용 빌드에서는 Mock 인증(`/api/mock-auth`, `MockAuthModal`)이 비활성이라, `FR-022` 없이 배포본을 열면 심사위원이 볼 수 있는 화면이 하나도 없다. 시연이 Phase 4 완료보다 앞선다면 로컬 `pnpm dev`로 시연하거나 `FR-022`를 데모 브랜치로 앞당긴다.

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
