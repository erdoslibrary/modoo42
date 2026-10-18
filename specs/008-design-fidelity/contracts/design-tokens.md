# Contract: 디자인 토큰과 클래스 자리 (008)

이 작업이 외부에 노출하는 계약은 HTTP API가 아니라 **토큰 이름과 클래스 규칙**이다. 다른 화면이 이 이름을 참조하므로 계약으로 고정한다. 값의 SSOT는 `docs/designs/interactions.md` §3.3~3.5다.

---

## C1. 토큰 계약 (`tailwind.config.ts`)

### 깨면 안 되는 것

1. **`muted`는 `#6b705c`다.** `#71717a`가 저장소 어디에도 남아서는 안 된다 (`TC-DESIGN-01`).
2. **글자 축은 4단이고 그 이상 늘리지 않는다.** `ink` → `ink-soft` → `muted` → `muted-soft`. 다섯 번째 단계가 필요해 보이면 먼저 `findings.md` 2-13의 집계를 다시 센다.
3. **녹색 3종의 역할은 고정이다.** `accent`는 제출·참여에만, `accent-bright`는 선택된 세그먼트·탭·메뉴, `accent-soft`는 선택된 카드. **선택 상태에 `accent`를 쓰지 않는다.**
4. **`live`·`dday`·`medal-*`는 액센트 축 밖이다.** 액센트 1색 규칙은 녹색 계열에만 적용되고, 이 셋은 각각 LIVE 계열·남은 기간·순위라는 별도 정보를 전달한다.
5. **토큰 이름은 접미사 규약을 따른다.** `-soft`(더 약함) · `-bright`(더 밝음) · `-dark`(더 어두움) · `-hover`(호버 상태). 번호 접미사(`-2`·`-3`)를 쓰지 않는다.

### 전체 토큰 목록

교정 1건과 신설 9건은 `data-model.md` §1을 따른다. 기존 10개(`bg`·`ink`·`accent`·`accent-hover`·`accent-dark`·`accent-soft`·`accent-bright`·`live`·`sidebar`·`card`)는 값이 바뀌지 않는다.

---

## C2. 폰트 클래스 계약

| 규칙 | 내용 |
| :--- | :--- |
| F1 | 버튼·탭에는 `.px`를 붙이고 **`font-bold`를 함께 주지 않는다.** Galmuri11에 bold가 없다 |
| F2 | 숫자·대문자 약어 뱃지에는 `.px`와 `font-weight:800`을 함께 쓴다. **이 예외는 뱃지에만** 적용된다 |
| F3 | 한글 문구 칩·본문·라벨·텍스트 링크는 Pretendard다. `.px`를 붙이지 않는다 |
| F4 | CLI 푸터만 `GalmuriMono`(고정폭)를 쓴다. `@font-face` 별칭이 `globals.css`에 있어야 한다 |
| F5 | 세로 패딩 비대칭(위가 아래보다 2px 큼)을 그대로 옮긴다. 광학 중심 보정이다 |

**`px` vs `px-*` 주의**: Tailwind의 `px-3`은 가로 패딩 유틸이고 폰트 클래스 `.px`와 다르다. 검사·수정 양쪽에서 토큰 경계로 구분한다 — `/(?:^|\s)px(?=\s|$)/`.

---

## C3. 레이아웃 계약

| 규칙 | 내용 |
| :--- | :--- |
| L1 | `AppShell`의 `<main>`은 최대 폭 1300px이고 가운데 정렬이다 |
| L2 | 루트에 `min-width:1280px`를 넣지 않는다. 375px에서 1열로 접힌다 (`SC-008`) |
| L3 | 대시보드 블록 순서는 LIVE → 파티 → 스터디 → (아카이브 + 랭킹) → CLI다 |
| L4 | 랭킹은 아카이브와 같은 행의 오른쪽이다. 스터디 그리드의 사이드바가 아니다 |
| L5 | 열 전환 분기점은 `xl` 하나만 쓴다. 새 분기점을 만들지 않는다 |
| L6 | 카드의 `min-height`와 하단 스페이서는 **한 쌍**이다. 하나만 넣지 않는다 |

---

## C4. 컴포넌트 계약 변경

### 변경되는 prop

| 컴포넌트 | 변경 | 영향 |
| :--- | :--- | :--- |
| `RealtimeFeed` | `aside: React.ReactNode` **제거** | `app/dashboard/page.tsx`가 유일한 호출부다. 다른 호출부가 없음을 확인하고 지운다 |

### 신설 컴포넌트

| 컴포넌트 | Props |
| :--- | :--- |
| `PixelFrog` | `{ size?: number }` — 기본 42. **색 변형 prop을 받지 않는다** (`FR-019`) |

### 변경되는 렌더 조건

| 컴포넌트 | 조건 |
| :--- | :--- |
| `LeaderLine`의 `✓` 칩 | `leader.campus !== null`일 때만 렌더 (`FR-023`, `research.md` R7) |

**응답 계약(`FeedPost`·`PostDetail`·`PublicUser`)은 바뀌지 않는다.** `✓`는 이미 내려오는 `campus`에서 파생한다.

---

## C5. 실시간 계약 (변경 없음 확인)

`contracts/realtime-posts.md`(006)의 **채널 1개** 규칙은 유지된다. `useRealtimePosts`는 여전히 `RealtimeFeed` 한 곳에서만 호출된다. `aside` prop 제거는 클라이언트 경계 **바깥** 블록의 위치만 바꾸므로 구독 수·구독 대상·끊김 시 동작(서버 렌더 결과 유지)에 영향이 없다 (`NFR-004`).

---

## C6. 테스트 계약 (Test Suite 9)

| ID | 단정 대상 | 방식 |
| :--- | :--- | :--- |
| `TC-DESIGN-01` | `tailwind.config.ts`의 `muted` 값, 메달 3색 토큰 존재, `#71717a` 0건 | 설정 import + 저장소 문자열 검색 |
| `TC-DESIGN-02` | 액센트 버튼·탭에 `.px`가 있고 `font-bold`가 없다 | 소스 텍스트 + 정규식 (앵커 사용) |
| `TC-DESIGN-03` | 정렬 칩·상태 칩·라벨·텍스트 링크에 `.px`가 없다 | 소스 텍스트 + 정규식 |
| `TC-DESIGN-04` | `<main>`에 최대 폭 제한, `GalmuriMono` `@font-face` 선언, `CliFooter`가 그 글꼴 사용 | 소스 텍스트 + `globals.css` 읽기 |
| `TC-DETAIL-01` | `getPostDetail()` 참여자 정렬 결정성 | 실제 DB 통합 테스트 (트랜잭션 롤백) |

**jsdom·testing-library를 설치하지 않는다.** 근거와 대안 검토는 `research.md` R2에 있다. 시각적 일치는 `quickstart.md`의 수동 대조가 맡는다.
