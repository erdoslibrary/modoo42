# Implementation Plan: 대시보드 UI 결합 & 실시간 동기화 (Phase 3 본편)

**Branch**: `006-dashboard-realtime` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-dashboard-realtime/spec.md`

## Summary

Phase 1~2에서 만든 모집·참여·완주·LIVE 핑 도메인에 **화면을 붙인다.** 디자인 원본 7개 HTML을 Next.js 컴포넌트로 옮겨 대시보드(피드 4영역)·상세 모달·2단계 참여 확인·개설 폼 3종·프로필을 만들고, Supabase Realtime 구독으로 참여자 수와 LIVE 핑을 1초 내 반영한다. 사양 단계에서 신설한 `FR-020`(단기 파티 마감 Lazy Filter)도 같은 브랜치에서 닫는다 — 피드가 그 값을 직접 읽기 때문이다.

기술 접근은 4갈래다.

1. **기반**: 폰트(Galmuri11 + Pretendard, 디자인 원본과 같은 CDN)·디자인 토큰(Tailwind `theme.extend`)·`.nb` 눌림 클래스(`interactions.md` §3.1)를 먼저 세운다. 이게 없으면 포팅한 화면 색과 폰트가 디자인과 다르게 나온다.
2. **조회**: 서버 컴포넌트가 `src/lib/posts.ts`·신규 `src/lib/profile.ts`를 직접 호출해 첫 화면을 렌더한다. HTTP 왕복을 만들지 않는다(research R1).
3. **변경·실시간**: 참여·개설·조기 완료만 클라이언트에서 기존 Route Handler를 호출한다. 실시간은 채널 1개(`posts-channel`)와 훅 1개(`useRealtimePosts`)로 모으고, payload에 없는 제목·위치는 조회로 보강한다(research R10).
4. **도메인 추가**: 단기 파티 마감을 `listPosts`(조회 제외)·`joinPost`(참여 거절)·`createPost`(KST 당일 끝 정규화) 3지점에 넣는다. 표기 파생은 `src/lib/display.ts`로 모아 CLI와 공유한다.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 14.2.35 App Router (React 18, Node 런타임)

**Primary Dependencies**: 기존 설치분만 쓴다 — `@supabase/ssr` 0.12.7 + `@supabase/supabase-js` 2.117.3(실시간), `lucide-react` 1.58(사이드바 아이콘), Tailwind CSS 3.4, Drizzle ORM, Zod, Vitest. **신규 의존성 0개.**

**Storage**: Supabase PostgreSQL 17.11. **스키마 변경 없음** — 신규 마이그레이션을 만들지 않는다.

**Testing**: Vitest. 실제 Supabase에 붙어 트랜잭션 롤백으로 격리한다. 컴포넌트 렌더 테스트는 도입하지 않고 파생 로직을 순수 함수로 내려 검증한다(research R14). 화면 검증은 [quickstart.md](./quickstart.md) 수동 시나리오.

**Target Platform**: 데스크톱 브라우저 우선, 375px 이상 반응형. 배포는 Vercel(U4 미완, 구현을 막지 않는다).

**Project Type**: 웹 애플리케이션 단일 프로젝트 (Next.js App Router + Route Handlers)

**Performance Goals**: 실시간 반영 1초 이내(NFR-004). LIVE `INSERT` 1건당 보강 조회 1회 이하. 초기 렌더는 RSC 1패스.

**Constraints**:
- 공개 복제 컬럼이 최소 집합으로 고정돼 있어 실시간 payload에 제목·위치·`chat_url`이 없다(trd §5). 구성을 바꾸지 않는다.
- `chat_url`은 상세 조회의 참여자 응답에만 존재한다. 클라이언트로 내려가는 어떤 데이터에도 비참여자용 링크가 섞이면 안 된다(헌법 V).
- 디자인 원본은 인라인 스타일 251곳 + `min-width:1280px` 데스크톱 고정이다. 호버·누름은 제거된 상태이고 그 값의 SSOT는 `interactions.md`다.
- `pnpm test`는 CI에 없다. PR 전 로컬 필수 게이트다(NFR-006).
- 공개 키가 신형 `sb_publishable_` 형식이다. 실시간 수용 여부는 실측으로 확인한다(U3, research R11).

**Scale/Scope**: 신규 파일 약 25개(컴포넌트 15 + 페이지 4 + lib/hooks 4 + 테스트 4~5), 수정 파일 약 8개, 문서 2개(`CLAUDE.md` §3, `next-steps.md`). 화면 4개(대시보드·개설·프로필 + 모달 2종).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
| :--- | :--- | :--- |
| I. 사양 주도 · 테스트 우선 | PASS | spec.md·checklist 완료, 이 plan 다음에 tasks → implement. 이 브랜치가 도메인에 더하는 유일한 규칙(단기 파티 마감)은 TDD로 간다 — `TC-PARTY-01`·`02`를 먼저 Red로 쓴다. 표기·분류 파생도 순수 함수 테스트를 먼저 쓴다. 컴포넌트 렌더 테스트를 두지 않는 근거는 research R14 |
| II. 문서 SSOT 우선 | PASS | 사양 단계에서 `requirement.md`(FR-020·FR-021·TC-PARTY)·`CLAUDE.md` §6.4·`prd.md`·`next-steps.md`를 먼저 고쳤다. 구현 중 `CLAUDE.md` §3(`src/hooks/` 추가)과 `next-steps.md`(U3 실측 결과, RLS 전방 위험)를 같은 PR에서 갱신한다. 디자인 원본과 문서가 어긋나는 7곳은 spec FR-005로 범위 밖을 명시했다 |
| III. 도메인 불변식 고정 | PASS | 입력 제약을 새로 만들지 않는다. 프론트 검증은 보조이고 서버 Zod가 최종 방어선이다(FR-029). `avatar_url` 미수집·이니셜 뱃지, 캠퍼스 필터 미구현, 자진 취소 없음을 화면에서도 지킨다. 저장되지 않는 지표(완주율)를 화면에 만들지 않는다 |
| IV. 동시성 · 상태 머신 무결성 | PASS | 참여 트랜잭션 구조(`FOR UPDATE` → 상태 → 멱등 → 정원 → 기록)를 바꾸지 않고 검증 1건을 멱등 반환 **뒤**에 끼운다(data-model §3). 상태 전이 집합은 그대로다 — `FR-020`은 전이가 아니라 조회 필터다. 확인 팝업 중복 클릭은 UI에서 막고, 서버는 기존 멱등성으로 받는다 |
| V. 보안 경계 · 링크 가시성 | PASS | 비참여자 상세에 `chat_url` 키가 없는 기존 동작을 그대로 쓰고, 화면은 그 응답만 읽는다. 실시간 복제 컬럼을 늘리지 않는다. Mock 모달은 `NODE_ENV` 이중 차단 유지(FR-041). 참여 전 링크 선취득 설계를 명시적으로 기각했다(research R9) |

위반 없음. Complexity Tracking 비움.

**신규 디렉터리 1개(`src/hooks/`)에 대한 정당화**: `CLAUDE.md` §3 규약에 없는 경로다. `useRealtimePosts`는 클라이언트 전용 상태 훅이라 `src/lib/`(서버·순수 모듈)와 `src/components/`(렌더) 어디에도 맞지 않는다. 같은 PR에서 규약 문서에 경로를 추가해 SSOT를 맞춘다.

## Project Structure

### Documentation (this feature)

```text
specs/006-dashboard-realtime/
├── plan.md                      # 이 파일
├── spec.md                      # 완료
├── research.md                  # Phase 0 산출물 (R1~R14)
├── data-model.md                # Phase 1 산출물 (뷰 모델·파생 규칙·변경 지점)
├── quickstart.md                # Phase 1 산출물 (게이트·수동 검증·보안 확인)
├── contracts/
│   ├── party-expiry.md          # FR-020 조회·참여·개설 델타
│   ├── realtime-posts.md        # posts-channel 구독 계약
│   └── profile-view.md          # getProfile 내부 조회 계약
├── checklists/requirements.md   # 완료 (16/16)
└── tasks.md                     # Phase 2 (/speckit-tasks, 이 명령에서 만들지 않음)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx               # 폰트 교체(Galmuri11·Pretendard), metadata, lang="ko"
│   ├── globals.css              # 토큰·.nb·.px·pulse·.hs. Next 기본값·Arial 제거
│   ├── page.tsx                 # /dashboard 리다이렉트로 교체
│   ├── dashboard/page.tsx       # [신규] RSC. 피드 4영역 + ?post=·?archive= 수용
│   ├── create/page.tsx          # [신규] RSC 셸 + 클라이언트 폼. ?type= 수용
│   └── profile/page.tsx         # [신규] RSC. getProfile 호출
├── components/
│   ├── layout/{Sidebar,AppShell}.tsx          # [신규] 사이드바·셸
│   ├── feed/{LivePingBoard,PartyRail,StudyGrid,ArchiveTabs,Leaderboard,EmptyState,CliFooter}.tsx
│   ├── card/{StudyCard,PartyCard,LivePingCard,InitialBadge,CampusBadge}.tsx
│   ├── detail/{PostDetailModal,JoinConfirmDialog,ParticipantList,LeaderActions}.tsx
│   ├── create/{TypeSwitch,StudyForm,PartyForm,LivePingForm,TemplatePicker}.tsx
│   ├── profile/{ProfileHeader,HistoryList}.tsx
│   └── MockAuthModal.tsx        # 기존. 로그인 필요 안내와 연결
├── hooks/
│   └── useRealtimePosts.ts      # [신규] posts-channel 구독 1개
├── lib/
│   ├── supabase/client.ts       # [신규] createBrowserClient 싱글턴
│   ├── display.ts               # [신규] remainingLabel·ddayLabel·initials·headcount·cycle
│   ├── profile.ts               # [신규] getProfile + 이력 분류
│   ├── posts.ts                 # createPost 정규화 · listPosts 필터 · joinPost 검증
│   ├── end-date.ts              # endOfKstDay 추가
│   └── cli-format.ts            # 라벨 2종을 display.ts에서 import (출력 문자열 불변)
└── app/fonts/Geist*.woff        # 삭제

tailwind.config.ts               # 색·폰트 토큰 등록

tests/
├── party-expiry.test.ts         # [신규] TC-PARTY-01, TC-PARTY-02
├── lib/display.test.ts          # [신규] 표기 파생 경계값
├── lib/profile.test.ts          # [신규] 이력 분류·정렬
├── lib/end-date.test.ts         # endOfKstDay 경계 추가
└── (기존 전건)                   # CLI 출력 문자열이 안전망
```

**Structure Decision**: 기존 단일 프로젝트 구조(CLAUDE.md §3)를 유지한다. `src/components/` 아래를 관심사별 하위 폴더(`layout`·`feed`·`card`·`detail`·`create`·`profile`)로 나누는 이유는 이 브랜치가 컴포넌트 15개 이상을 한 번에 더하기 때문이다 — 평면 디렉터리에 쌓으면 다음 브랜치(`FR-021` 리더 액션)에서 찾기 비용이 올라간다. `src/lib/`에는 순수·서버 모듈만 두고, 클라이언트 훅은 `src/hooks/`로 분리한다(위 정당화 참조).

## Phase 0: Research

산출물: [research.md](./research.md). 결정 14건(R1~R14). 요지:

- R1 초기 렌더는 RSC가 도메인 함수 직접 호출, 변경만 Route Handler
- R2 표기 파생을 `display.ts`로 모아 CLI와 공유 (중복 제거)
- R3 파티 마감 경계는 저장 시 KST 당일 끝으로 정규화
- R4 마감 필터는 `listPosts` 1곳, 참여 차단은 `joinPost` 1곳
- R5 폰트는 디자인 원본과 같은 jsdelivr CDN (바이너리 미커밋)
- R6 토큰은 Tailwind `theme.extend`, `.nb`만 CSS
- R7 모달은 네이티브 `<dialog>` (의존성 0)
- R8 상세 모달 상태는 `?post=` 쿼리로 서버가 렌더 (마스킹 재판정)
- R9 새 탭은 클릭 시점에 선점 후 주소 주입 (팝업 차단 대응)
- R10 실시간은 채널 1개 + 훅 1개, `INSERT`는 조회로 보강
- R11 `sb_publishable_` 키 수용 여부는 실측, RLS 전방 위험 기록
- R12 라우트 4개(`/`·`/dashboard`·`/create`·`/profile`), 하위 목록은 앵커
- R13 프로필 이력은 신규 `profile.ts`의 조인 1회
- R14 컴포넌트 렌더 테스트 미도입, 파생 로직만 Vitest

미결 사항 없음.

## Phase 1: Design & Contracts

산출물:

- [data-model.md](./data-model.md) — 쓰기 정규화 1건, 조회 조건 1건, 참여 검증 1건, 뷰 모델 6종(`FeedCard`·`PostDetail`·`ArchiveItem`·`LeaderboardRow`·`ProfileView`·`RealtimeEvent`), 표기 파생 6종, `joinability` 상태표, 영향 코드 지점표
- [contracts/party-expiry.md](./contracts/party-expiry.md) — `GET /api/posts`·`POST /api/posts/:id/join`·`POST /api/posts` 델타와 경계 규칙
- [contracts/realtime-posts.md](./contracts/realtime-posts.md) — 채널·이벤트·payload 사용 필드·보강 조회·끊김 처리·RLS 전방 위험
- [contracts/profile-view.md](./contracts/profile-view.md) — `getProfile` 응답 모양, 분류 규칙, 노출 금지 필드, 범위 밖 섹션
- [quickstart.md](./quickstart.md) — 게이트 5종, 자동 테스트 범위, 수동 확인 11건, 실시간 2창 검증과 WebSocket 보안 확인, 마감 파티 수동 확인, 디자인 자가 점검

### Constitution Re-check (post-design)

| 원칙 | 판정 | 설계 후 확인 |
| :--- | :--- | :--- |
| I | PASS | `TC-PARTY-01`·`02`가 테스트 파일에 1:1 배치됐다. 신규 순수 모듈 3개(`display`·`profile`·`endOfKstDay`) 모두 테스트 대상이다. 렌더 테스트 공백은 quickstart 수동 11건 + 실시간 4건으로 덮는다 |
| II | PASS | 설계가 `trd.md` §4·§5와 같은 계약을 가리킨다. 신규 HTTP 엔드포인트 0개 — 프로필은 내부 조회 계약으로 두어 외부 표면을 늘리지 않았다. 문서 수정 2건을 tasks에 넣는다 |
| III | PASS | 입력 Zod 스키마를 바꾸지 않는다. 파티 `end_date` 정규화는 검증이 아니라 저장 정규화이고, 입력 허용 범위를 넓히지 않는다. 화면에 완주율·검색·배지를 만들지 않는다(FR-005) |
| IV | PASS | 참여 트랜잭션에 추가되는 검증의 위치를 멱등 반환 뒤로 고정했다 — 마감된 파티의 기존 참여자가 링크를 잃지 않는다. 상태 머신 전이 집합 불변 |
| V | PASS | 비참여자 데이터 경로에 `chat_url`이 없다(상세는 서버 렌더, 리스트는 애초에 미포함, 실시간은 복제 컬럼 제외). 참여 전 링크 선취득을 기각했고, WebSocket 프레임 확인을 검증 절차에 넣었다 |

## Complexity Tracking

위반 없음.
