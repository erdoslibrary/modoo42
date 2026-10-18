# Implementation Plan: 디자인 원본 대비 포팅 정합성 복구 (008)

**Branch**: `008-design-fidelity` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-design-fidelity/spec.md`

## Summary

Phase 3에서 포팅한 9화면이 `docs/designs/*.html`과 어긋난 지점을 복구한다. 신규 기능이 아니라 **포팅 누락의 사후 복구**이며 Phase 3.5(`FR-023`·`FR-024`)보다 앞선다 — 토큰과 버튼 규칙이 어긋난 상태로 배너·완주율 UI를 올리면 같은 수정을 두 번 한다.

범위는 네 덩어리다. ① **색** — `muted` 교정, 선택 상태를 제출 버튼과 분리, 텍스트 4단화, 표면·D-Day·메달 토큰 신설. ② **폰트** — 액센트 버튼·탭에 Galmuri11 복구(`font-bold` 제거), CLI 푸터에 고정폭 `GalmuriMono`. ③ **레이아웃** — 본문 최대 폭 1300px 복구, 랭킹·CLI 위치 교정, 카드 CTA 바닥 고정, 개설 카드 중앙 정렬과 픽셀 개구리. ④ **도메인 버그 1건** — `getPostDetail()` 참여자 조회의 `ORDER BY` 누락.

기술 접근은 **토큰 레이어에서 최대한 해결하는 것**이다. `muted` 한 줄로 51곳이 따라오고, 선택 상태 분리는 이미 있는 토큰 3종의 클래스만 바꾸면 된다. 새로 만드는 것은 색 토큰 9개, 컴포넌트 1개(`PixelFrog`), `@font-face` 1개뿐이다. DB 마이그레이션·스키마·API 응답 계약은 건드리지 않는다.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Next.js 14.2.35 (App Router)

**Primary Dependencies**: Tailwind CSS (토큰은 `theme.extend.colors`), Drizzle ORM (§8 정렬 수정 1건), `@supabase/supabase-js` 2.117.3 (변경 없음). **새 의존성 0개** — jsdom·testing-library를 설치하지 않는다.

**Storage**: Supabase PostgreSQL. **이번 작업에 스키마 변경·마이그레이션 없음.**

**Testing**: Vitest (`environment: node`). Test Suite 9의 `TC-DESIGN-01`~`04`는 설정값·소스 문자열 정적 단정, `TC-DETAIL-01`은 실제 DB 통합 테스트(트랜잭션 롤백 격리).

**Target Platform**: 브라우저. 데스크톱 1300px 기준 설계, 375px까지 1열로 접힘.

**Project Type**: Web application (Next.js 단일 앱, `src/` 아래 서버·클라이언트 혼재)

**Performance Goals**: 없음(렌더 성능 변경 아님). `NFR-004`의 실시간 1초 이내 반영은 **유지**되어야 하며 채널 수 1개가 불변이다.

**Constraints**:
- `FR-015` — 기능·DB 스키마·API 응답 계약 불변. 새 마이그레이션 0건.
- `SC-008` — 375px에서 1열, 가로 스크롤 없음.
- 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5. 새 숫자를 만들지 않는다.
- 미등록 색은 **실제 사용처가 확인된 것만** 토큰화.

**Scale/Scope**: 9화면 중 포팅 대상 8개(`PixelFrog.html` 제외). 수정 파일 약 20개, 신규 2개(`PixelFrog.tsx`, Test Suite 9 테스트). 요구사항 25개(`FR-001`~`FR-025`).

## Constitution Check

*GATE: Phase 0 전에 통과해야 하고 Phase 1 설계 후 재확인한다.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| **I. 사양 주도 · 테스트 우선** | PASS | `spec.md` → 본 `plan.md` → `tasks.md` → `implement` 순서를 지킨다. `TC-DETAIL-01`(도메인 로직)은 TDD로 간다 — `ORDER BY` 추가 전에 실패하는 테스트를 먼저 쓴다. `TC-DESIGN-*`도 수정 전에 작성해 Red을 확인한다. 테스트 제목에 `requirement.md` §3의 ID를 그대로 쓴다 |
| **II. 문서 SSOT 우선** | PASS | 값은 `interactions.md` §3.3~3.5에만 두고 `spec.md`·`plan.md`는 가리키기만 한다. `CLAUDE.md` §10의 보조 텍스트 색 충돌은 **코드보다 문서를 먼저 고쳤다**(완료). 범위 변경 6건은 `requirement.md` `FR-026`과 `prd.md` F2에 같은 커밋에서 반영했다 |
| **III. 도메인 불변식 고정** | PASS | 입력 제약·정책 규칙을 건드리지 않는다. 새 불변식을 만들지 않는다 |
| **IV. 동시성 · 상태 머신 무결성** | PASS | 트랜잭션·상태 전이에 변경이 없다. §8의 `ORDER BY`는 **읽기 경로**이고 쓰기 경합과 무관하다 |
| **V. 보안 경계 · 링크 가시성** | PASS | `chat_url` 마스킹 경로를 건드리지 않는다. `✓` 칩은 **이미 내려오는 `campus`**에서 파생하므로 응답에 필드를 더하지 않는다 (`research.md` R7) |
| **기술 제약 · 디자인 규율** | PASS | 이 작업 자체가 `anti-ai-slop.md` 준수를 되돌리는 일이다. 새로 들이는 시각 요소는 픽셀 개구리 SVG 1개뿐이고 `🐸`는 등재된 제품 고유 기호다. `✓`는 등재된 글리프 6종 안이다. 점선 구분선은 「구획: 효과 대신 border + 여백」에 해당한다 |
| **개발 워크플로우** | PASS | `main` 직접 커밋 없음. `docs:`/`feat:`/`test:` Conventional Commits. PR 본문에서 디자인 덩어리와 도메인 버그를 나눠 적는다 |

**위반 없음.** Complexity Tracking 비움.

### Phase 1 설계 후 재확인

| 원칙 | 재판정 | 비고 |
| :--- | :--- | :--- |
| I | PASS | `contracts/design-tokens.md` C6이 5개 TC의 단정 방식을 고정했다 |
| II | PASS | Phase 1에서 생긴 새 값(토큰 이름 9개)은 `data-model.md` §1에 **구조만**, 실제 색값은 `interactions.md`와 `tailwind.config.ts`에 둔다. 두 곳에 지침이 생기지 않았다 |
| III | PASS | 변동 없음 |
| IV | PASS | `research.md` R3이 `aside` prop 제거가 구독 수에 영향 없음을 확인했다. `contracts/design-tokens.md` C5에 기록 |
| V | PASS | `contracts/design-tokens.md` C4가 "응답 계약 불변"을 명시 |
| 디자인 규율 | PASS | R5(점선 구분선)·R6(D-Day 빨강)이 새로 들어왔고 둘 다 정보 전달 근거를 적었다 |

## Project Structure

### Documentation (this feature)

```text
specs/008-design-fidelity/
├── findings.md          # 사전 관찰 기록 (speckit 이전 단계)
├── spec.md              # Phase -1 output (speckit-specify)
├── plan.md              # This file (speckit-plan)
├── research.md          # Phase 0 output — 결정 R1~R8
├── data-model.md        # Phase 1 output — 토큰·클래스 자리 모델
├── quickstart.md        # Phase 1 output — 검증 절차
├── contracts/
│   └── design-tokens.md # Phase 1 output — 토큰·폰트·레이아웃·컴포넌트 계약
└── tasks.md             # Phase 2 output (speckit-tasks — 아직 없음)
```

### Source Code (repository root)

```text
tailwind.config.ts                        # 토큰: muted 교정 + 9개 신설

src/
├── app/
│   ├── globals.css                       # GalmuriMono @font-face 추가
│   ├── dashboard/page.tsx                # 블록 조립 순서 변경 (aside 제거)
│   └── create/page.tsx                   # 페이지 제목 치수
├── components/
│   ├── layout/
│   │   └── AppShell.tsx                  # <main> 최대 폭 1300px + 가운데 정렬
│   ├── ui/
│   │   └── PixelFrog.tsx                 # 신규 — 16×16 도트 인라인 SVG
│   ├── feed/
│   │   ├── RealtimeFeed.tsx              # aside prop 제거
│   │   ├── StudyGrid.tsx                 # 건수 박스 제거, 정렬 칩 검정, 제목 치수
│   │   ├── ArchiveTabs.tsx               # 탭 색·그림자, 점선 구분선, 결과물 ↗ 폰트
│   │   ├── Leaderboard.tsx               # 메달 3색, 뱃지 치수
│   │   ├── EmptyState.tsx                # 중앙 정렬 + 개구리 + 틴트
│   │   ├── LivePingBoard.tsx             # 핑 보내기 버튼 폰트
│   │   └── CliFooter.tsx                 # GalmuriMono, 박스 폭, 문구 위치
│   ├── card/
│   │   ├── CardMeta.tsx                  # 리더 패널 + ✓, 태그 첫 칸 색, 메타 배치
│   │   ├── StudyCard.tsx                 # min-height + 스페이서, CTA 폰트·치수
│   │   ├── PartyCard.tsx                 # D-Day 칩 색·치수, CTA 폰트
│   │   └── InitialBadge.tsx              # 크기만 (색 종류 유지)
│   ├── detail/
│   │   ├── PostDetailModal.tsx           # CTA 폰트·치수
│   │   ├── JoinConfirmDialog.tsx         # 버튼 폰트 (2곳)
│   │   ├── LeaderActions.tsx             # 버튼 폰트 (3곳)
│   │   ├── ParticipantList.tsx           # 섹션 제목 치수
│   │   └── CompletionModal.tsx           # 제출 버튼 글자 크기만
│   ├── create/
│   │   ├── TypeSwitch.tsx                # accent-soft + 우상단 원형 ✓, 라벨 치수
│   │   ├── RecruitForm.tsx               # 세그먼트 accent-bright, 스테퍼, 제출 버튼
│   │   └── LivePingForm.tsx              # 세그먼트 accent-bright, 제출 버튼 bg-live
│   ├── profile/
│   │   ├── ProfileHeader.tsx             # 뱃지 84px, 유저명·통계 치수·색
│   │   └── HistoryList.tsx               # 완주 칩 accent-bright
│   └── ...
└── lib/
    └── posts.ts                          # getPostDetail() 참여자 ORDER BY

tests/
├── design-fidelity.test.ts               # 신규 — TC-DESIGN-01~04
└── posts-detail.test.ts                  # TC-DETAIL-01 추가
```

**Structure Decision**: 기존 Next.js 단일 앱 구조를 그대로 쓴다. 새 디렉터리는 `src/components/ui/` 하나이며 `PixelFrog.tsx` 한 개를 담는다 — 기존 `card`/`feed`/`detail`/`create`/`profile`/`layout` 중 어디에도 속하지 않는 순수 표현 요소이기 때문이다. 테스트는 `tests/` 평면 구조를 따른다(`tests/design-fidelity.test.ts`).

## 구현 순서

`docs/next-steps.md` §3.4의 13단계를 따른다. 순서에 의미가 있다.

| 순 | 묶음 | 왜 이 순서인가 |
| ---: | :--- | :--- |
| 1 | ~~전수 대조~~ 완료 | — |
| 2 | 토큰 교정·신설 (`muted` + 9개) | **모든 클래스 변경의 선행이다.** 토큰 없이 클래스를 바꾸면 임의값(`bg-[#9be06a]`)이 흩어진다 |
| 3 | 본문 최대 폭 (`FR-016`) | **치수 작업보다 먼저.** 바깥 폭이 틀린 채로 글자 크기를 맞추면 비율 판단이 어긋난다 (`findings.md` 2-14) |
| 4 | 선택 상태 색 분리 (`FR-001`~`FR-005`) + D-Day 칩 | 가장 넓다. D-Day를 같이 해야 `accent-bright`가 "선택 상태"로 굳는다 (`research.md` R6) |
| 5 | 레이아웃 재조립 (`FR-017`) | 구조 변경이라 뒤의 치수 작업이 바뀐 자리 위에서 이뤄져야 한다 |
| 6 | 픽셀 폰트 (`FR-008`·`FR-009`·`FR-021`) | 색·구조가 끝난 뒤 폰트 |
| 7 | 치수 (`FR-010`~`FR-013`·`FR-018`~`FR-020`·`FR-022`~`FR-024`) | 마지막. 앞 단계가 다 끝나야 눈으로 판정된다 |
| 8 | 참여자 정렬 (`FR-014`) | 독립. 언제 해도 되지만 **PR 본문에서 분리해 적는다** |

TDD는 각 묶음 안에서 돈다 — `TC-DESIGN-*`를 먼저 써서 Red을 확인하고 고친다. `TC-DETAIL-01`은 8번에서 Red → Green.

## 주의 — 밟기 쉬운 지뢰

1. **`px`와 `px-3`**: Tailwind 가로 패딩 유틸과 폰트 클래스는 이름만 같다. 검색·치환 모두 토큰 경계로 구분한다 (`/(?:^|\s)px(?=\s|$)/`).
2. **`font-bold` 동반 제거**: `.px`를 붙이면서 `font-bold`를 안 빼면 픽셀이 뭉개진다. **이니셜 뱃지는 예외**로 `font-weight:800`을 유지한다.
3. **`.nb`가 항상 그림자를 준다**: 아카이브 비활성 탭과 정렬 칩은 그림자가 없어야 하므로 `.nb`를 떼거나 덮어쓴다. 색만 바꾸면 선택이 구분되지 않는다.
4. **`min-height`와 스페이서는 한 쌍**: 하나만 넣으면 카드가 제각각이거나 버튼이 뜬다.
5. **`aside` 제거 시 호출부 확인**: `app/dashboard/page.tsx`가 유일한 호출부인지 먼저 grep한다.
6. **`ENDED` 카피**: `HistoryCategory`의 `ENDED`가 원본의 `회고`와 같은 의미인지 `src/lib/view-types.ts`에서 확인한다. **다르면 카피를 그대로 두고 색만** 맞춘다.
7. **개구리는 도감이 아니다**: 개설 카드 1자리에만 쓴다. 색 변형 prop을 만들지 않는다. §1.3 보류를 푸는 것이 아니다.

## 불채택 목록 — 다음 대조에서 다시 세지 않는다

| 항목 | 근거 |
| :--- | :--- |
| 이니셜 뱃지 사람별 다색 | 색이 사람을 식별하지 못하고 「색은 의미에만」에 걸린다 (`findings.md` 2-6b) |
| 프로필 뱃지 그림자색 `#0d1409` | 그림자색을 둘로 늘리면 `--nb-depth` 단일 변수 구조가 깨진다 (2-8e) |
| 랭킹 1~3위 행 박스 | 메달 색 하나로 충분하다 (`FR-025`) |
| 주차별 커리큘럼 · 참여자별 증빙 | 저장 스키마가 없다 (2-10) |
| 기간 선택 버튼 `1/2/3개월` | `end_date`가 자동 산출된다 (2-10) |
| 개구리 도감 · 획득 배지 · 대왕 개구리 게이지 | `requirement.md` §1.3 보류 (2-10) |
| 상세 모달 리더 통계 블록 (`4회`·`92%`) | **자리도 만들지 않는다.** `4회`는 응답 계약(`PublicUser`)에 없고 더하면 `FR-015` 위반, `92%`는 `FR-024` 범위다. Phase 3.5가 값과 함께 만든다 (2026-10-18 사용자 결정, 2-6c) |

## Complexity Tracking

> Constitution Check에 위반이 없으므로 비운다.
