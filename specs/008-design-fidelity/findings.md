# 008 디자인 정합성 — 사전 관찰 기록 (findings)

**작성 2026-10-18.** 기준 커밋 `e0f6d70` (`origin/main`, PR #16 머지 직후). 브랜치 `008-design-fidelity`.

이 문서는 `speckit-specify` 이전 단계의 **관찰 기록**이다. 구현 지침이 아니다. 실제 값의 SSOT는 아래 "4. 반영 대상" 표가 가리키는 문서이며, 여기에는 "어떻게 측정했고 무엇이 어긋났는가"만 남긴다. 두 곳에 지침을 두면 나중에 갈라지기 때문이다.

**전수 대조 완료 (2026-10-18).** 1·2절은 `Dashboard.html` 대조 결과이고, **2-B절이 나머지 8화면 대조 결과다.** `PixelFrog.html`은 개구리 도감 보류라 범위 밖이다. 처음에 남아 있던 **[미검증]** 항목(2-4의 9색)도 모두 확정했다.

**가장 영향이 큰 발견은 2-5다** — 선택 상태 배경색이 제출 버튼과 같아서 액센트 1색 규칙이 깨져 있다. 2-3(버튼 폰트)보다 넓고, 새 토큰 없이 클래스만 바꾸면 된다.

---

## 1. 확인된 코드 버그

### 1-1. 상세 모달 참여자 목록의 순서가 비결정적이다

- **위치:** `src/lib/posts.ts`의 `getPostDetail()` 안 participants 조회
- **증상:** 조회에 `ORDER BY`가 없다. PostgreSQL이 실행 계획에 따라 행 순서를 바꾸므로, 같은 글의 참여자 목록이 렌더마다 다른 순서로 나올 수 있다.
- **드러난 경위:** 데모 데이터를 넣어 `participants` 행이 늘자 플래너가 계획을 바꿨고 `tests/posts-detail.test.ts:98`이 실패했다. 기대값 `[gs_leader, gs_member]`, 실제 `[gs_member, gs_leader]`.
- **데이터 양에 따라 숨는 버그다.** 행이 적을 때는 삽입 순서대로 나와 테스트가 통과한다. 운영 데이터가 쌓이면 재현된다.
- **수정안(검증 완료):** 조회에 `.orderBy(asc(participants.joinedAt), asc(users.login))`을 추가한다. 리더는 개설 시 첫 참여 행이므로 자연히 맨 앞에 온다. 이 수정을 적용해 `pnpm test` 275/275 통과를 확인했다. 변경량은 3줄이다.
- **반영처:** `requirement.md` `FR-026` 세부 명세의 "범위에 포함된 도메인 버그 1건" 항목, Test Suite 9 `TC-DETAIL-01`, `next-steps.md` §3.4-5.
- **분류:** 디자인이 아니라 도메인 로직이다. 성격이 다르므로 분리하는 안도 검토했으나, **`FR-026` 범위에 포함해 PR 하나로 처리한다 (2026-10-18 사용자 결정).** 변경이 3줄이고 테스트가 이미 통과하므로 분리 비용이 더 크다는 판단이다. 리뷰어가 디자인 수정과 도메인 버그 수정을 함께 보게 되므로, **PR 본문에서 두 덩어리를 나누어 적는다.**

---

## 2. 디자인 원본 대비 구현 불일치

### 2-1. 보조 텍스트 색이 다르다 — 영향 범위가 가장 넓다

- **디자인 원본:** `#6b705c` (올리브 그레이. 배경 `#EDEFE0`와 같은 계열)
- **구현:** `#71717a` (zinc. 푸른끼가 도는 중성 회색) — `tailwind.config.ts`의 `muted` 토큰
- **사용처:** `src/` 전체에서 `text-muted` 51곳
- **영향:** 화면 전체의 보조 텍스트 톤이 배경 계열에서 벗어난다. "전체적으로 밋밋하다"는 인상의 주된 원인으로 의심된다.
- **선행 조건:** 3-1의 문서 충돌을 먼저 해소해야 한다. **해소 완료** — `CLAUDE.md` §10 토큰 표가 `#6b705c`로 교정됐다.
- **반영처:** `CLAUDE.md` §10 디자인 토큰 표, `requirement.md` `FR-026`, `next-steps.md` §3.4-2. 코드 수정 지점은 `tailwind.config.ts:25`.

### 2-2. 랭킹 1·2·3위 메달 색이 빠졌다

- **디자인 원본:** 순위 뱃지에 금 `#F5C518` / 은 `#C9CDD4` / 동 `#CD7F32`. 26px, `border-radius:6px`
- **구현:** `src/components/feed/Leaderboard.tsx:22` — 전 순위가 `bg-white`로 동일하다
- **영향:** 상위 3명이 시각적으로 구분되지 않는다.
- **주의:** 이것은 새 요구가 아니다. **`FR-010`이 이미 "상위 5명(골드/실버/브론즈)"을 명시하고 있다.** 요구는 처음부터 있었고 구현만 누락됐다. 따라서 요구사항을 신설하지 않고 색값만 보강한다.
- **반영처:** `docs/designs/interactions.md` §3.4 (값의 SSOT. 4·5위는 `#eceedd` 바탕 + `#6b705c` 글자이고 치수는 다섯 자리 공통임을 실측해 추가했다), `next-steps.md` §3.4-4.

### 2-3. 액센트 버튼·탭에 픽셀 폰트가 빠졌다

- **디자인 원본:** 액센트 버튼 5개 **전부** `class="px"`(Galmuri11)다. 예외 0건. 아카이브 탭과 `+ 핑 보내기`도 `px`다.

  | 대상 | 원본 값 |
  | :--- | :--- |
  | 카드 CTA | `font-size:14px; padding:12px 16px 10px; border-radius:9px` |
  | 배너 CTA | `font-size:16px; padding:16px 22px 14px; border-radius:10px; border:3px` |
  | 아카이브 탭 | `font-size:14px; padding:11px 12px 9px; border-radius:8px; background:#9be06a` |
  | 핑 보내기 | `font-size:12px; padding:7px 12px 5px; border-radius:7px; background:#16a34a` |

- **구현:** `nb ... bg-accent ...` 조합 9종 중 `px` 폰트 클래스를 가진 것이 **0개**다. 전부 Pretendard에 `font-bold`가 붙어 있다.
- **작업 시 주의 두 가지:**
  1. `px-3` 등은 Tailwind의 가로 패딩 유틸이다. 폰트 클래스 `px`와 이름만 같고 다른 것이다. 검색할 때 혼동하기 쉽다.
  2. **Galmuri11에는 bold 자체가 없다.** `font-bold`를 함께 주면 브라우저가 합성 굵게를 만들어 픽셀이 뭉개진다. 디자인 원본도 `font-weight`를 쓰지 않는다. `px`를 붙일 때 `font-bold`를 빼야 한다.
- **세로 패딩이 비대칭인 이유:** 원본이 `padding:12px 16px 10px`처럼 위를 아래보다 2px 크게 준다. 픽셀 폰트의 글리프가 박스 안에서 높이 앉기 때문에 광학 중심을 맞추는 보정이다. 그대로 따라야 한다.
- **구분되는 규칙:** 디자인은 **버튼·탭에만** `px`를 쓴다. 정렬 칩(`최신순`·`마감임박순`)에는 `px`가 없다. 칩과 라벨은 Pretendard가 맞다.
- **위 두 줄을 실측으로 정정했다 (2026-10-18, 반영 작업 중).** ① **칩이라고 전부 Pretendard는 아니다.** D-Day 칩(`Dashboard.html:2816`, `:2417`)과 이니셜 뱃지는 `px`를 쓴다. 가르는 선은 "칩이냐"가 아니라 **"숫자·대문자 약어냐 한글 문구냐"**다 — 한글 문구 칩(`모집 중`·`최신순`·`LIVE`·태그)은 Pretendard, 숫자·이니셜(`D-3`·`HL`·`GH`)은 `px`다. ② **`font-weight`를 안 쓰는 것은 버튼·탭에 한정된다.** 이니셜 뱃지는 원본이 `px`와 `font-weight:800`을 함께 쓴다(`Dashboard.html:2885`, `:3670`). 1~2글자 대문자라 합성 굵게가 눈에 띄지 않기 때문으로 보인다. 뱃지에서만 유지하고 버튼·탭으로 옮기지 않는다.
- **반영처:** `docs/designs/interactions.md` §3.3 (값의 SSOT. 쓰는 자리 10종과 쓰지 않는 자리를 표로, 주의 3개를 함께 적었다), `CLAUDE.md` §10은 손대지 않았다 — 폰트 선택 근거는 이미 있고 치수는 `interactions.md` 소관이다. `next-steps.md` §3.4-3에 11개 파일 목록을 옮겼다.
- **선행 작업 기록:** 이 수정을 11개 파일에 적용해 `pnpm test` 275/275, `typecheck`, `lint` 통과를 확인했다. 다만 나머지 네 화면을 전수 대조하기 전에 머지하면 또 반쪽이 되므로 폐기했다. 다시 작업할 때 위 표의 값을 그대로 쓰면 된다. 적용했던 파일은 다음과 같다.

  `src/components/card/StudyCard.tsx`, `src/components/card/PartyCard.tsx`, `src/components/detail/PostDetailModal.tsx`, `src/components/detail/JoinConfirmDialog.tsx`(2곳), `src/components/detail/LeaderActions.tsx`(3곳), `src/components/create/RecruitForm.tsx`, `src/components/create/LivePingForm.tsx`, `src/components/feed/ArchiveTabs.tsx`, `src/components/feed/LivePingBoard.tsx`

### 2-4. 대조하지 않은 색이 남아 있다 [검증 완료 — 2026-10-18]

`Dashboard.html`에 등장하는 색은 33종인데 `tailwind.config.ts` 토큰은 11종이다. 차이 중 다수(`#F4B400`·`#3C8FE8`·`#9B5BE8`·`#E8554B` 등 고빈도 색)는 픽셀 개구리 SVG의 도트 색이라 토큰화 대상이 아니다. 그러나 아래는 UI 색일 가능성이 있고 아직 확인하지 않았다.

**9종 전부 실제 UI 색으로 확인됐다.** SVG 도트가 아니다. `Dashboard.html`의 선언을 속성별로 집계한 결과다.

| 색 | 쓰이는 속성 | 건수 | 용도 |
| :--- | :--- | ---: | :--- |
| `#FF4D4F` | `background` | 3 | D-Day 칩(파티 카드 `:2816`, 배너 대형 `:2417`)과 알림 점(`:2406`). **위험·취소가 아니라 잔여 기간 강조다** |
| `#eceedd` | `background` | 11 | 표면 1단(랭킹 4·5위 뱃지, 태그 칩) |
| `#F4F7E8` | `background` | 8 | 표면 2단(더 밝은 패널) |
| `#d8dcc6` | `border-top: 2px dashed` | 5 | 목록 구분선 |
| `#e0e3cf` | `border`, 스크롤바 `track` | 2 | 약한 경계·스크롤바 바닥 |
| `#E7F6EC` | `background` | 3 | 녹색 틴트 패널 |
| `#aef5bf` | `background` | 1 | LIVE 칩 안의 `pulse` 상태 점 |
| `#8a8f7a` | `color` | 12 | 3차 텍스트(보조보다 더 약함) |
| `#aab49c` | `color` | 3 | 4차 텍스트 |

**텍스트 단계가 3단이다** — `#6b705c`(보조) → `#8a8f7a`(3차) → `#aab49c`(4차). 구현의 `muted` 1종으로는 이 위계를 표현할 수 없다. 토큰 이름과 채택 범위는 `speckit-plan` 단계에서 정한다. **사용처가 확인된 것만 넣는다** — 표면 2단·녹색 틴트는 포팅한 화면에 해당 패널이 없으면 토큰을 만들지 않는다.

- **반영처:** 이 표가 관찰 기록의 종착지다. `requirement.md` `FR-026`에는 "실제 사용처가 확인된 것만 토큰화"라는 범위 제한만 적었고, `next-steps.md` §3.4 주의 문단에 같은 제한을 걸었다.

---

## 2-B. 미대조 8화면 전수 대조 결과 (2026-10-18)

대조 대상은 `about_study.html` · `create_study.html` · `create_study_party.html` · `create_study_live.html` · `myprofile.html` · `complete.html` · `complete_postmortem.html` · `Dashboard_postmortem.html` 8개다. `PixelFrog.html`은 개구리 도감 보류(§1.3)라 범위 밖이다.

**방법:** 각 파일의 색 선언을 속성별로 집계하고, `class="px"` 요소를 전수 추출해(150건) 구현 컴포넌트의 클래스 문자열과 맞췄다.

**가장 큰 소득은 2-5다.** 2-3(버튼 폰트)보다 영향이 넓고, 색 토큰의 의미 체계를 바로잡는 문제다.

### 2-5. 선택 상태의 배경색이 제출 버튼과 같다 — 액센트 1색 규칙 위반

**디자인 원본의 색 역할이 3단으로 갈린다.**

| 역할 | 원본 색 | 쓰이는 곳 |
| :--- | :--- | :--- |
| 제출·참여 (최종 행동) | `#5FB63A` (`accent`) | `개설하기` · `참여하기 ↗` · `기록 남기기` · 선택 완료 `✓` 칩 |
| 선택된 상태 (세그먼트·탭·메뉴) | `#9be06a` (`accent-bright`) | 사이드바 활성 메뉴 · 아카이브 탭 활성 · 기간/시간 세그먼트 활성 · 이력 `완주` 칩 |
| 선택된 상태 (카드) | `#E4F1D4` (`accent-soft`) | 유형 선택 카드 · 이력 `진행중` 칩 |

**구현은 선택 상태에도 `bg-accent`(`#5FB63A`)를 쓴다.** 어긋난 지점 5곳이다.

| 구현 | 현재 | 원본 |
| :--- | :--- | :--- |
| `src/components/feed/ArchiveTabs.tsx:36` | 활성 탭 `bg-accent` | `#9be06a` |
| `src/components/create/TypeSwitch.tsx:24` | 선택 카드 `bg-accent` | `#E4F1D4` + 우상단 `✓` 원형 칩(22px, `background:#5FB63A`, `border:2px solid #18181b`) |
| `src/components/create/LivePingForm.tsx:88` | 선택 유효시간 `bg-accent` | `#9be06a` |
| `src/components/create/RecruitForm.tsx:194` | 선택 진행 방식 `bg-accent` | `#9be06a` |
| `src/components/profile/HistoryList.tsx:13` | `완주` 칩 `bg-accent` | `#9be06a` |

**왜 고쳐야 하는가:** `CLAUDE.md` §10과 `.claude/rules/anti-ai-slop.md`가 "액센트 1색, 색은 의미(상태·위계)에만"을 요구한다. 지금은 "눌러서 확정하는 버튼"과 "이미 선택된 보기"가 같은 색이라 위계가 전달되지 않는다. 토큰은 이미 셋 다 있다(`accent`·`accent-bright`·`accent-soft`) — **새 토큰 없이 클래스만 바꾸면 된다.**

`TypeSwitch.tsx:29`는 이미 `✓`를 텍스트 접두로 쓴다. 원본은 카드 우상단의 원형 칩이므로 위치·형태가 다르다. CompletionModal은 원본과 같은 원형 칩을 이미 쓴다(`src/components/detail/CompletionModal.tsx:154`) — 그 구현을 참고한다.

### 2-6. 상세 모달 (`about_study.html`)

| # | 항목 | 원본 | 구현 |
| :--- | :--- | :--- | :--- |
| a | 모달 CTA | `font-size:16px;padding:16px 18px 14px;border-radius:10px`, `px` | `PostDetailModal.tsx:221` — `text-[14px] px-4 py-2.5 rounded-lg font-bold`, `px` 없음 |
| b | 참여자 이니셜 뱃지 | 34px·radius 7px·11px, **배경이 사람마다 다르다** — `#20301C`·`#5FB63A`·`#3C8FE8`·`#F5842E` | `InitialBadge.tsx:10` — `dark`/`light` 2종뿐이라 전원 같은 색 |
| c | 리더 카드 | 뱃지 52px·radius 10px·15px + 리더 통계(`4회`·`92%`, `px` 18px `#3c7a1e`) | 리더 통계 블록이 없다. 뱃지 크기도 `lg`=56px·18px로 다르다 |
| d | 메타 값 | `px` 14px | `PostDetailModal.tsx:119~155` — **일치한다** (`px` 적용돼 있음) |
| e | 섹션 제목 | `px` 16px | `ParticipantList.tsx:21` — `px` 14px. 폰트는 맞고 크기만 작다 |

b는 **채택하지 않기로 확정했다 (2026-10-18 사용자 결정).** 이니셜 뱃지 배경은 전원 같은 색으로 둔다. `login` 해시로 색을 돌리면 같은 색이 다른 사람에게 재사용되므로 색이 사람을 식별하지 못하고, `.claude/rules/anti-ai-slop.md`의 「색은 의미(상태·위계)에만」에 걸린다. `InitialBadge.tsx:10`의 `dark`/`light` 2종을 유지하고 **크기만 원본에 맞춘다** (34px·radius 7px·11px / 리더 52px·radius 10px·15px / 프로필 84px).

c의 완주율 `92%`는 **`FR-024` 범위와 겹친다.** 산출 함수가 Phase 3.5에서 들어오므로 FR-026에서는 리더 통계 자리(레이아웃·`px` 18px·`#3c7a1e`)만 맞추고 완주율 값은 `FR-024`에 맡긴다. 두 번 구현하지 않는다.

### 2-7. 개설 폼 (`create_study.html` · `_party` · `_live`)

| # | 항목 | 원본 | 구현 |
| :--- | :--- | :--- | :--- |
| a | 페이지 제목 | `px` 26px | `src/app/create/page.tsx:49` — `px` 20px |
| b | STEP 라벨 | `px` 12px `#6b705c` | `TypeSwitch.tsx:15` — `px` 13px `text-muted`. 색은 2-2 토큰 교정으로 따라온다 |
| c | 유형 탭 라벨 | `px` 15px | `TypeSwitch.tsx:28` — `px` 14px |
| d | 제출 버튼 | `px`, `font-size:15px;padding:16px 30px 14px;border-radius:9px;box-shadow:4px` | `RecruitForm`·`LivePingForm.tsx:112` — `text-[14px] px-4 py-2.5 rounded-lg font-bold`, `px` 없음 |
| e | LIVE 제출 버튼 배경 | `#16a34a`(`live`) | `LivePingForm.tsx:112` — `bg-accent`. **색이 다르다** |
| f | 유효시간 세그먼트 | 높이 46px·`px` 14px | `LivePingForm.tsx:88` — `py-1.5` + `font-bold`, `px` 없음 |
| g | 인원 스테퍼 숫자 | `px` 16px, 폭 70px | `RecruitForm.tsx:233` — `px` 14px, 폭 64px |
| h | 파티 진행 방식 | 세그먼트 1덩어리(`border-left:2px`, radius 0, 높이 46px) | `RecruitForm.tsx:194` — 낱개 pill 나열 |

e가 실질적이다. **LIVE 핑은 녹색 계열이 따로다** — 원본은 전광판·핑 버튼·제출 버튼 전부 `#16a34a`로 묶는다. `live` 토큰이 이미 있고 `LivePingBoard.tsx:38`은 그걸 쓴다. 개설 폼만 `accent`로 새어 있다.

### 2-8. 프로필 (`myprofile.html`)

| # | 항목 | 원본 | 구현 |
| :--- | :--- | :--- | :--- |
| a | 프로필 뱃지 | 84px·radius 14px·`px` 30px·`border:3px`·`box-shadow:3px 3px 0 #0d1409` | `ProfileHeader.tsx:11` — `InitialBadge lg` = 56px·18px·radius 7px·border 2.5px |
| b | 유저명 | `px` 26px | `ProfileHeader.tsx:13` — `px` 18px |
| c | 통계 숫자 | `px` 22px **`color:#3c7a1e`** | `ProfileHeader.tsx:22` — `px` 20px, 색 지정 없음(=`ink`) |
| d | 이력 상태 칩 | `px` 10px·`padding:4px 8px 2px`·radius 6px. 완주 `#9be06a` / 진행중 `#E4F1D4` / **회고 `#6b705c` + 흰 글자** | `HistoryList.tsx:12` — 완주 `bg-accent` / 진행중 `bg-accent-soft` / **`ENDED`는 `bg-white`이고 라벨이 `종료`** |
| e | 그림자 색 | `#0d1409`(진한 올리브-검정) 4곳 | 전역 `#18181b` |

d의 라벨 차이(`회고` vs `종료`)는 **단순 카피 문제가 아니다.** 원본은 회고가 등록된 스터디를 가리키고, 구현의 `ENDED`는 `HistoryCategory` 분류값이다(`src/lib/view-types.ts`). 분류 의미가 같은지 확인한 뒤 카피를 맞춘다. 다르면 카피를 그대로 두고 색만 맞춘다.

e는 **채택하지 않는 쪽을 권한다.** 84px 큰 뱃지 한 곳의 그림자만 색이 다르고, 전역 그림자색을 둘로 늘리면 `--nb-depth` 한 변수로 깊이를 관리하는 §3.1 구조가 깨진다. `findings` 기록만 남기고 `#18181b`를 유지한다 — **이것은 내 판단이므로 되돌릴 수 있다.**

### 2-9. 완주·회고 (`complete.html` · `complete_postmortem.html`)와 Post-mortem 탭 (`Dashboard_postmortem.html`)

**007b 포팅이 가장 충실하다.** `CompletionModal.tsx:286`은 이미 `nb px rounded-[9px] [--nb-depth:4px]`에 `✓` 원형 칩(`:154`·`:183`)까지 원본과 같다. 남은 차이는 2건이다.

| # | 항목 | 원본 | 구현 |
| :--- | :--- | :--- | :--- |
| a | 제출 버튼 글자 크기 | 15px | `CompletionModal.tsx:286` — 14px |
| b | 판정 모달 제목 | `px` 22px | `CompletionModal.tsx:112` — `px text-[20px] sm:text-[22px]`. **일치한다** (데스크톱 기준) |
| c | 아카이브 탭 비활성 | `box-shadow:none` | `ArchiveTabs.tsx:37` — `nb`가 항상 그림자를 준다. **활성/비활성이 그림자로 구분되지 않는다** |
| d | 표면색 | `#F0F1E4`(완주 화면 패널), `#E7F6EC`(회고 탭 틴트) | 토큰에 없다 |

c는 2-5와 한 쌍이다. 원본은 **색 + 그림자 유무**로 탭 선택을 표시하고, 구현은 색만 쓴다.

### 2-10. 의도적으로 포팅하지 않은 것 — 불일치가 아니다

다음 대조에서 "누락"으로 다시 집계하지 않도록 근거와 함께 남긴다.

* **4주 커리큘럼 섹션** (`about_study.html:2520` 부근, `WK1`~`WK4`) — 주차별 커리큘럼을 담는 컬럼이 없다. `HistoryList.tsx:5`가 이미 "저장되는 데이터가 없어 만들지 않는다(spec FR-005)"로 기록해 뒀다. `template_data`로 넣는 것은 템플릿 정의 변경이므로 `FR-026`(스키마·API 불변) 밖이다.
* **참여자별 완주 인증 목록** (`about_study.html:2558`) — `proof_url`·`proof_type`은 `posts`에 1건씩 있고(`src/db/schema.ts:57-58`) `participants`에는 없다. 사람마다 증빙을 다르게 보여주려면 스키마 변경이 필요하다. 구현은 글 단위 증빙 링크 1개를 그린다(`PostDetailModal.tsx:173`).
* **기간 선택 버튼 `1개월`/`2개월`/`3개월`** (`create_study.html`) — `end_date`는 항상 익월 말일로 자동 산출된다(`FR-001`, 2026-10-18 확정). 리더가 고를 수 없으므로 버튼 자체가 없는 것이 맞다.
* **개구리 도감·획득 배지** (`myprofile.html`) — `requirement.md` §1.3 보류. `#f2c836`·`#f1f2e8`는 이 섹션 전용 색이므로 토큰화하지 않는다.
* **대왕 개구리 게이지** (`Dashboard.html` 배너 우측) — §1.3 보류.

### 2-11. 충실한 지점 — 고치지 않는다

* **사이드바** (`Sidebar.tsx`) — 로고 뱃지 38px·`px` 15px, 활성 메뉴 `bg-accent-bright`, 비활성 `#aab49c` + `hover:bg-white/[0.08]`까지 원본과 같다. 2-5의 예외가 아니라 **유일하게 선택 상태 색이 맞는 곳**이다. 나머지를 여기에 맞추면 된다.
* **상세 모달 메타 값·`.nb` 깊이 체계·`pulse` 점·CLI 푸터 색(`#cfe8bd`)** — 일치한다.

### 2-12. 추가로 확정된 미등록 색

2-4의 9색에 더해, 8화면에서 5색이 더 나왔다. 전부 실제 UI 색이다.

| 색 | 쓰임 | 등장 |
| :--- | :--- | :--- |
| `#F0F1E4` | 패널 배경 | `complete.html`·`complete_postmortem.html` (4) |
| `#9aa088` | 약한 텍스트 | `about_study.html`·`myprofile.html` (3) |
| `#4b5040` | 어두운 보조 텍스트 | 3개 파일 (5) |
| `#b9c0a4` | `border:2px dashed` (빈 자리 표시) | `about_study.html` (4) |
| `#0d1409` | 그림자 색 (2-8e) | `myprofile.html` (4) |
| `#f2c836`·`#f1f2e8` | 개구리 도감 전용 — **토큰화 대상 아님** | `myprofile.html` |

### 2-13. 텍스트 색 단계 — 사용처를 세어 4단으로 확정 (2026-10-18 결정)

원본의 글자 색은 5종이지만 **색 개수만큼 토큰을 만들지 않는다.** 9개 파일에서 `color:` 선언을 글자 크기와 함께 집계한 결과다.

| 원본 색 | 선언 수 | 크기 | 쓰임 | 처리 |
| :--- | ---: | :--- | :--- | :--- |
| `#6b705c` | 약 107 | 11~14px | 일반 보조 텍스트 | `muted` 토큰을 이 값으로 교정 (2-2) |
| `#8a8f7a` | 약 56 | 10~15px | 보조보다 약한 부속 메타(날짜·인원) | **토큰 신설.** 56곳이라 생략하면 보조 텍스트가 한 톤으로 뭉친다 |
| `#4b5040` | 5 | 13~15px | 본문 단락(스터디 소개·회고 본문) | **토큰 신설.** 건수는 적지만 "읽는 글" 자리가 분명하다 |
| `#aab49c` | 22 | 15px | **전부 사이드바 비활성 메뉴** (어두운 배경 전용) | 토큰 만들지 않는다. `Sidebar.tsx:42`가 이미 `text-[#aab49c]`로 쓴다 |
| `#9aa088` | 1 | 10px | `미수집` — 개구리 도감 | 버린다. §1.3 보류 범위다 |

**결과: 2단(`ink`·`muted`) → 4단, 새 토큰 2개.** 이름은 `speckit-plan`에서 정한다.

### 2-14. 전수 대조가 놓친 것 — 레이아웃 (2026-10-18, 사용자 화면 확인)

**1절~2-13의 대조는 색 선언과 `class="px"` 추출로 했다.** 둘 다 요소 단위 속성이라 "블록이 어디에 어떤 폭으로 놓이는가"는 집계되지 않았다. 사용자가 `pnpm dev`로 실제 화면을 열어 7건을 짚었고, 전부 재현·확인됐다.

| # | 지점 | 원본 | 구현 |
| :--- | :--- | :--- | :--- |
| a | 본문 최대 폭 | `<main>` `max-width:1300px` (`:2412`) | `AppShell.tsx:18` — **없다.** 1920px 모니터에서 본문 약 1600px, 카드 400px → 520px |
| b | 랭킹·CLI 위치 | 랭킹은 아카이브와 같은 행(`1.5fr : 1fr`, `:3660`), CLI는 맨 아래 전체 폭 | `RealtimeFeed.tsx` — 둘 다 스터디 그리드 오른쪽 300px `aside` |
| c | 카드 CTA 높이 | `min-height:296px` + `<div style="flex:1">` 스페이서로 바닥 고정 | `StudyCard.tsx` — 둘 다 없어 제목 줄 수에 따라 버튼 높이가 다르다 |
| d | 개설 카드 | `min-height:296px`, `align-items:center;justify-content:center`, 42px 픽셀 개구리, `background:rgba(228,241,212,0.45)` (`:3322`) | `EmptyState.tsx` — `p-5 text-center`뿐. 세로 중앙 정렬·개구리·틴트 모두 없다 |
| e | 섹션 건수 | 테두리·배경 없는 `color:#3c7a1e;font-size:17px` 글자 (`:2867`) | `StudyGrid.tsx:34` — 흰 바탕 + 검정 테두리 박스 |
| f | CLI 글꼴 | `font-family:'GalmuriMono',...` **고정폭** | `CliFooter.tsx` — `.px`(Galmuri11, 가변폭) |
| g | 정렬 칩 | 활성 `#18181b` 바탕·흰 글자, 비활성 투명 (`:2869~2870`) | `StudyGrid.tsx:45` — 활성 `bg-accent`, 비활성 `bg-white`. 2-5가 센 5곳에 없던 6번째 선택 상태 지점 |

**"글씨가 크다"는 인상의 원인은 글씨가 아니다.** 실측하면 구현의 글자 크기는 확인한 모든 자리에서 원본보다 **작다** — 섹션 제목 21→16px, 카드 제목 20→15px, 리더명 14→13px, 카드 메타 13→12px, 태그 칩 13→11px, 카드 CTA 14→13px, 개설 카드 제목 15→14px·설명 13→12px. 원인은 a다. 바깥 폭이 설계보다 300px 넓어 카드가 커지고, 그 안의 작은 글자가 비율을 어긋나게 한다. **치수(2-6~2-9)를 먼저 고쳐도 a가 남으면 비율은 복구되지 않는다.**

**대조 중 추가로 드러난 3건과 그 결정 (2026-10-18).** 위 표를 쓰면서 같이 발견했고 전부 사용자가 결정했다.

| 지점 | 원본 | 구현 | 결정 |
| :--- | :--- | :--- | :--- |
| 랭킹 행 | 1~3위만 `#F4F7E8` 박스 + 테두리 + 그림자, 4·5위 투명 | 다섯 행 모두 맨 줄 | **불채택.** 메달 색 하나로 충분하고 박스를 넣으면 랭킹이 무거워진다 |
| 카드 리더 줄 | `#F4F7E8` 패널 + 우측 20px 원형 `✓` | 패널 없는 맨 줄 | **채택.** `✓`는 **42 인증 완료** 표시로 의미를 고정하고 `campus !== null`일 때만 렌더한다. 응답 계약(`PublicUser` = `{login, campus}`)을 바꾸지 않고 쓸 수 있는 신호가 `campus`뿐이다. 캠퍼스 뱃지와 정보가 겹치지만 원본도 부제 `42 인트라`와 `✓`를 함께 둔다 |
| 카드 메타 항목 | `스터디 기간` + 하단 `모집 현황`·`사이클` | `스터디 기간`·`모집 현황`·`진행 방식` 세 줄 묶음 | **항목은 구현 유지, 배치만 원본.** `모집 현황`만 하단 CTA 옆으로 내린다. `사이클`을 더하지 않고 `진행 방식`을 빼지 않는다 — 온/오프라인 구분이 참여 판단에 쓰인다 |

- **반영처:** `docs/designs/interactions.md` **§3.5 신설**(레이아웃 골격·카드 치수·CLI 글꼴. 기존 「하지 말 것」은 §3.6으로 밀렸다)과 §3.3(정렬 칩·태그 칩 첫 칸 색), `requirement.md` `FR-026`에 레이아웃 bullet과 `TC-DESIGN-04`, `next-steps.md` §3.4-10~13, 스펙의 User Story 7·`FR-016`~`FR-022`.
- **다음 대조에 반영할 교훈:** 색·폰트 집계만으로는 레이아웃이 잡히지 않는다. **블록 배치·폭·정렬을 별도 항목으로 센다.**

---

## 3. 문서 충돌과 그 결론

### 3-1. 보조 텍스트 색에 대해 `CLAUDE.md`와 디자인 원본이 어긋난다

- `CLAUDE.md` §10 디자인 토큰 표: 보조 텍스트 `#71717a`
- `docs/designs/Dashboard.html`: `#6b705c`

구현은 `CLAUDE.md`를 따랐으므로 **코드가 규칙을 어긴 것이 아니다.** `CLAUDE.md` §1이 "충돌을 발견하면 임의로 한쪽을 따르지 말고 문서를 먼저 수정한다"고 정하고 있다.

**결론 (2026-10-18 사용자 결정): 디자인 HTML의 색감을 정답으로 삼는다.** 따라서 `CLAUDE.md` §10의 보조 텍스트 값을 `#6b705c`로 교정하고, 그 뒤에 `muted` 토큰을 바꾼다. 순서를 지켜야 한다.

**반영 완료.** `CLAUDE.md` §10 토큰 표가 `#6b705c`(올리브 그레이, 배경 계열)로 교정됐다. 코드(`tailwind.config.ts:25`)는 아직 `#71717a`다 — `speckit-implement` 단계에서 바꾼다.

### 3-2. 디자인 HTML의 아이콘·이모지를 anti-ai-slop 예외로 등재한다

**결론 (2026-10-18 사용자 결정).** 현재 `CLAUDE.md` §10은 제품 고유 이모지 3종(🏆·🪦·🐸)만 허용하고 "그 외 불릿·장식·강조용 이모지는 금지"로 닫혀 있다. 디자인 원본이 쓰는 아이콘과 이모지가 여기에 걸리므로, `.claude/rules/anti-ai-slop.md`의 「프로젝트 예외」에 등재하고 `CLAUDE.md` §10 「규칙 해석」에 근거를 적는다.

**반영 완료.** 등재 전에 `docs/designs/*.html` 9개 파일의 글리프를 전수 집계했고, **제품 이모지 3종 외에는 6종뿐이었다** — `✓`(완주·체크) · `✕`(미완주·닫기) · `↗`(외부 링크) · `←`(뒤로) · `→`(이동) · `›`(더 보기). 전부 아이콘 자리에서 동작을 가리키므로 anti-ai-slop의 「정당성」을 통과한다. `.claude/rules/anti-ai-slop.md` 「프로젝트 예외」에 6종을 명시해 등재하고, `CLAUDE.md` §10 「규칙 해석」에 근거와 **"이 예외는 6종으로 닫혀 있다"**는 제한을 함께 적었다. 전수 집계를 했으므로 "원본이 쓰는 아이콘 전부"라는 열린 문구를 쓰지 않았다.

---

## 4. 반영 대상과 순서

**결론 (2026-10-18 사용자 결정): `FR-026`을 신설해 이 작업을 하나로 묶는다.** 색·폰트 수정을 규칙 문서에만 흩어두면 Phase 범위로 추적할 ID가 없고, 아직 대조하지 않은 네 화면 때문에 작업량이 더 늘어날 것이 분명하기 때문이다.

아래 1~6은 문서 작업이므로 `docs:` 커밋 하나로 묶는다. 그 뒤에 speckit 4단계로 들어간다.

**1~6 반영과 전수 대조(2-B, 2-5~2-13)가 모두 끝났다 (2026-10-18).** 대조 후 판단이 남았던 2건(이니셜 뱃지 다색·텍스트 색 단계)도 같은 날 확정했다 — 2-6b와 2-13이다. 대조로 범위가 늘었으므로 `requirement.md` `FR-026`에 선택 상태 색 분리를 추가하고 `next-steps.md` §3.4의 작업 순서를 8단계로 고쳤다. **다음 단계는 `speckit-specify`다.**

| 순 | 문서 | 할 일 | 상태 |
| :--- | :--- | :--- | :--- |
| 1 | `docs/requirement.md` | `FR-026`(디자인 원본 대비 포팅 정합성 복구) 신설, Test Suite 9 추가, 1-1 버그의 TC 추가 | **완료** — §1.1 Phase 3 bullet, §2 Phase 3 표에 `FR-026` 행, §3 Test Suite 9(`TC-DESIGN-01`~`03`·`TC-DETAIL-01`), §5.2 마일스톤 4에 순서 명시 |
| 2 | `CLAUDE.md` §10 | 보조 텍스트를 `#6b705c`로 교정. 「규칙 해석」에 아이콘·이모지 예외 근거 추가 | **완료** — 토큰 표 1행 교정, 「규칙 해석」에 기능 글리프 6종 예외 |
| 3 | `.claude/rules/anti-ai-slop.md` | 「프로젝트 예외」에 디자인 HTML의 아이콘·이모지 등재 | **완료** — 글리프 6종을 열거해 등재(열린 문구 대신) |
| 4 | `docs/designs/interactions.md` | §3에 소절 신설 — 버튼·탭 폰트와 치수(2-3), 메달 색값(2-2) | **완료** — §3.3(폰트·치수 10종 + 주의 3개), §3.4(순위 뱃지 색). 기존 「하지 말 것」은 §3.5로 밀렸다 |
| 5 | `docs/next-steps.md` | 미대조 화면 네 개의 전수 대조를 작업 항목으로 추가 | **완료** — §3.4 신설(작업 5단계·코드 지점). 함께 고친 것: U10 폐기 처리(`demo:*` 0건 실측), Phase 3.5 브랜치를 `009-hackathon-demo`로 변경, 시드 폐기 경위 기록 |
| 6 | 이 파일 | 위 반영이 끝나면 각 항목에 반영처를 주석으로 남긴다 | **완료** — 각 항목에 `반영처` 줄. 반영 중 실측으로 **2-3의 칩 규칙과 `font-weight` 서술을 정정**하고 **2-4의 [미검증] 9색을 전부 확정**했다 |

**4번이 값의 SSOT다.** `CLAUDE.md` §1이 `interactions.md`를 "제거된 호버·누름 값과 Phase 3 CSS 구현 지침의 SSOT"로 지정하고 있으므로, 폰트·치수·색값의 실제 숫자는 그쪽에 적고 이 문서는 관찰 기록으로 남긴다.

---

## 5. 참고 — 이 브랜치 범위가 아닌 것

혼동을 막기 위해 적어 둔다. 아래는 미구현이지만 버그가 아니며, 이미 다른 Phase 범위로 잡혀 있다.

- 모집 사이클 알람 배너(`FR-023`), 랭킹 완주율 지표(`FR-024`) — Phase 3.5
- 정규 스터디 모집창(매월 15일~말일) 강제, 단기 파티 행사 기간 2날짜 모델 — Phase 3.5
- 대왕 개구리 소환 게이지, 개구리 도감, 획득 배지 — `requirement.md` §1.3 보류

저장소 전반의 기존 리스크(`GET /api/list` 무제한 공개, GitHub 핸들 선점 충돌, RLS 적용 시 Realtime 구독 중단 등)는 `docs/next-steps.md` §4와 각 `specs/*/research.md`가 이미 다루고 있으므로 여기에 옮겨 적지 않는다.
