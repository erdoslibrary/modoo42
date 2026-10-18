# 008 디자인 정합성 — 사전 관찰 기록 (findings)

**작성 2026-10-18.** 기준 커밋 `e0f6d70` (`origin/main`, PR #16 머지 직후). 브랜치 `008-design-fidelity`.

이 문서는 `speckit-specify` 이전 단계의 **관찰 기록**이다. 구현 지침이 아니다. 실제 값의 SSOT는 아래 "4. 반영 대상" 표가 가리키는 문서이며, 여기에는 "어떻게 측정했고 무엇이 어긋났는가"만 남긴다. 두 곳에 지침을 두면 나중에 갈라지기 때문이다.

대조 기준은 `docs/designs/Dashboard.html` 하나뿐이다. **나머지 네 화면(`about_study.html`·`create_study.html`·`myprofile.html`·`complete.html`)은 아직 대조하지 않았다.** 같은 성격의 누락이 더 있을 가능성이 높으므로, 전수 대조가 이 브랜치 범위에 포함된다.

추정만 하고 검증하지 않은 항목은 **[미검증]**으로 표시했다.

---

## 1. 확인된 코드 버그

### 1-1. 상세 모달 참여자 목록의 순서가 비결정적이다

- **위치:** `src/lib/posts.ts`의 `getPostDetail()` 안 participants 조회
- **증상:** 조회에 `ORDER BY`가 없다. PostgreSQL이 실행 계획에 따라 행 순서를 바꾸므로, 같은 글의 참여자 목록이 렌더마다 다른 순서로 나올 수 있다.
- **드러난 경위:** 데모 데이터를 넣어 `participants` 행이 늘자 플래너가 계획을 바꿨고 `tests/posts-detail.test.ts:98`이 실패했다. 기대값 `[gs_leader, gs_member]`, 실제 `[gs_member, gs_leader]`.
- **데이터 양에 따라 숨는 버그다.** 행이 적을 때는 삽입 순서대로 나와 테스트가 통과한다. 운영 데이터가 쌓이면 재현된다.
- **수정안(검증 완료):** 조회에 `.orderBy(asc(participants.joinedAt), asc(users.login))`을 추가한다. 리더는 개설 시 첫 참여 행이므로 자연히 맨 앞에 온다. 이 수정을 적용해 `pnpm test` 275/275 통과를 확인했다. 변경량은 3줄이다.
- **분류:** 디자인이 아니라 도메인 로직이다. 성격이 다르므로 분리하는 안도 검토했으나, **`FR-026` 범위에 포함해 PR 하나로 처리한다 (2026-10-18 사용자 결정).** 변경이 3줄이고 테스트가 이미 통과하므로 분리 비용이 더 크다는 판단이다. 리뷰어가 디자인 수정과 도메인 버그 수정을 함께 보게 되므로, **PR 본문에서 두 덩어리를 나누어 적는다.**

---

## 2. 디자인 원본 대비 구현 불일치

### 2-1. 보조 텍스트 색이 다르다 — 영향 범위가 가장 넓다

- **디자인 원본:** `#6b705c` (올리브 그레이. 배경 `#EDEFE0`와 같은 계열)
- **구현:** `#71717a` (zinc. 푸른끼가 도는 중성 회색) — `tailwind.config.ts`의 `muted` 토큰
- **사용처:** `src/` 전체에서 `text-muted` 51곳
- **영향:** 화면 전체의 보조 텍스트 톤이 배경 계열에서 벗어난다. "전체적으로 밋밋하다"는 인상의 주된 원인으로 의심된다.
- **선행 조건:** 3-1의 문서 충돌을 먼저 해소해야 한다.

### 2-2. 랭킹 1·2·3위 메달 색이 빠졌다

- **디자인 원본:** 순위 뱃지에 금 `#F5C518` / 은 `#C9CDD4` / 동 `#CD7F32`. 26px, `border-radius:6px`
- **구현:** `src/components/feed/Leaderboard.tsx:22` — 전 순위가 `bg-white`로 동일하다
- **영향:** 상위 3명이 시각적으로 구분되지 않는다.
- **주의:** 이것은 새 요구가 아니다. **`FR-010`이 이미 "상위 5명(골드/실버/브론즈)"을 명시하고 있다.** 요구는 처음부터 있었고 구현만 누락됐다. 따라서 요구사항을 신설하지 않고 색값만 보강한다.

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
- **선행 작업 기록:** 이 수정을 11개 파일에 적용해 `pnpm test` 275/275, `typecheck`, `lint` 통과를 확인했다. 다만 나머지 네 화면을 전수 대조하기 전에 머지하면 또 반쪽이 되므로 폐기했다. 다시 작업할 때 위 표의 값을 그대로 쓰면 된다. 적용했던 파일은 다음과 같다.

  `src/components/card/StudyCard.tsx`, `src/components/card/PartyCard.tsx`, `src/components/detail/PostDetailModal.tsx`, `src/components/detail/JoinConfirmDialog.tsx`(2곳), `src/components/detail/LeaderActions.tsx`(3곳), `src/components/create/RecruitForm.tsx`, `src/components/create/LivePingForm.tsx`, `src/components/feed/ArchiveTabs.tsx`, `src/components/feed/LivePingBoard.tsx`

### 2-4. 대조하지 않은 색이 남아 있다 [미검증]

`Dashboard.html`에 등장하는 색은 33종인데 `tailwind.config.ts` 토큰은 11종이다. 차이 중 다수(`#F4B400`·`#3C8FE8`·`#9B5BE8`·`#E8554B` 등 고빈도 색)는 픽셀 개구리 SVG의 도트 색이라 토큰화 대상이 아니다. 그러나 아래는 UI 색일 가능성이 있고 아직 확인하지 않았다.

- `#FF4D4F` — 위험·취소 계열로 추정
- `#ECEEDD`, `#F4F7E8`, `#D8DCC6`, `#E0E3CF` — 표면 단계
- `#E7F6EC`, `#AEF5BF` — 녹색 틴트
- `#8A8F7A`, `#AAB49C` — 보조 회색 단계

---

## 3. 문서 충돌과 그 결론

### 3-1. 보조 텍스트 색에 대해 `CLAUDE.md`와 디자인 원본이 어긋난다

- `CLAUDE.md` §10 디자인 토큰 표: 보조 텍스트 `#71717a`
- `docs/designs/Dashboard.html`: `#6b705c`

구현은 `CLAUDE.md`를 따랐으므로 **코드가 규칙을 어긴 것이 아니다.** `CLAUDE.md` §1이 "충돌을 발견하면 임의로 한쪽을 따르지 말고 문서를 먼저 수정한다"고 정하고 있다.

**결론 (2026-10-18 사용자 결정): 디자인 HTML의 색감을 정답으로 삼는다.** 따라서 `CLAUDE.md` §10의 보조 텍스트 값을 `#6b705c`로 교정하고, 그 뒤에 `muted` 토큰을 바꾼다. 순서를 지켜야 한다.

### 3-2. 디자인 HTML의 아이콘·이모지를 anti-ai-slop 예외로 등재한다

**결론 (2026-10-18 사용자 결정).** 현재 `CLAUDE.md` §10은 제품 고유 이모지 3종(🏆·🪦·🐸)만 허용하고 "그 외 불릿·장식·강조용 이모지는 금지"로 닫혀 있다. 디자인 원본이 쓰는 아이콘과 이모지가 여기에 걸리므로, `.claude/rules/anti-ai-slop.md`의 「프로젝트 예외」에 등재하고 `CLAUDE.md` §10 「규칙 해석」에 근거를 적는다.

---

## 4. 반영 대상과 순서

**결론 (2026-10-18 사용자 결정): `FR-026`을 신설해 이 작업을 하나로 묶는다.** 색·폰트 수정을 규칙 문서에만 흩어두면 Phase 범위로 추적할 ID가 없고, 아직 대조하지 않은 네 화면 때문에 작업량이 더 늘어날 것이 분명하기 때문이다.

아래 1~6은 문서 작업이므로 `docs:` 커밋 하나로 묶는다. 그 뒤에 speckit 4단계로 들어간다.

| 순 | 문서 | 할 일 |
| :--- | :--- | :--- |
| 1 | `docs/requirement.md` | `FR-026`(디자인 원본 대비 포팅 정합성 복구) 신설, Test Suite 9 추가, 1-1 버그의 TC 추가 |
| 2 | `CLAUDE.md` §10 | 보조 텍스트를 `#6b705c`로 교정. 「규칙 해석」에 아이콘·이모지 예외 근거 추가 |
| 3 | `.claude/rules/anti-ai-slop.md` | 「프로젝트 예외」에 디자인 HTML의 아이콘·이모지 등재 |
| 4 | `docs/designs/interactions.md` | §3에 소절 신설 — 버튼·탭 폰트와 치수(2-3), 메달 색값(2-2) |
| 5 | `docs/next-steps.md` | 미대조 화면 네 개의 전수 대조를 작업 항목으로 추가 |
| 6 | 이 파일 | 위 반영이 끝나면 각 항목에 반영처를 주석으로 남긴다 |

**4번이 값의 SSOT다.** `CLAUDE.md` §1이 `interactions.md`를 "제거된 호버·누름 값과 Phase 3 CSS 구현 지침의 SSOT"로 지정하고 있으므로, 폰트·치수·색값의 실제 숫자는 그쪽에 적고 이 문서는 관찰 기록으로 남긴다.

---

## 5. 참고 — 이 브랜치 범위가 아닌 것

혼동을 막기 위해 적어 둔다. 아래는 미구현이지만 버그가 아니며, 이미 다른 Phase 범위로 잡혀 있다.

- 모집 사이클 알람 배너(`FR-023`), 랭킹 완주율 지표(`FR-024`) — Phase 3.5
- 정규 스터디 모집창(매월 15일~말일) 강제, 단기 파티 행사 기간 2날짜 모델 — Phase 3.5
- 대왕 개구리 소환 게이지, 개구리 도감, 획득 배지 — `requirement.md` §1.3 보류

저장소 전반의 기존 리스크(`GET /api/list` 무제한 공개, GitHub 핸들 선점 충돌, RLS 적용 시 Realtime 구독 중단 등)는 `docs/next-steps.md` §4와 각 `specs/*/research.md`가 이미 다루고 있으므로 여기에 옮겨 적지 않는다.
