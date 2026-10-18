# Research: 디자인 원본 대비 포팅 정합성 복구 (008)

**Branch**: `008-design-fidelity` | **Date**: 2026-10-18

`spec.md`의 Assumptions가 `speckit-plan`으로 미룬 결정 3건과, 계획 수립 중 추가로 드러난 차이 2건을 여기서 닫는다. 값의 SSOT는 여전히 `docs/designs/interactions.md` §3.3~3.5이고, 이 문서는 **"왜 그렇게 정했는가"**만 남긴다.

---

## R1. 신설 텍스트 토큰 2개의 이름

**Decision**: `ink-soft`(`#4b5040`)와 `muted-soft`(`#8a8f7a`).

**Rationale**: `tailwind.config.ts`에 이미 `accent-hover`·`accent-dark`·`accent-soft`·`accent-bright`라는 **접미사 규약**이 있다. 같은 규약을 글자색에도 쓰면 규칙을 하나만 기억하면 된다. 네 단계가 명도 순으로 `ink`(`#18181b`) → `ink-soft`(`#4b5040`) → `muted`(`#6b705c`) → `muted-soft`(`#8a8f7a`)가 되어 이름만 보고 순서를 읽을 수 있다.

쓰임도 이름과 맞는다. `ink-soft`는 "읽는 글"(스터디 소개·회고 본문)이라 `ink` 계열이 맞고, `muted-soft`는 보조 텍스트보다 더 약한 부속 메타(날짜·인원)라 `muted` 계열이 맞다.

**Alternatives considered**:

- `muted-2` / `muted-3` 같은 번호 — 번호는 쓰임을 말하지 않는다. 다섯 번째가 생기면 중간에 끼울 자리가 없다.
- `meta` / `prose` — 의미는 분명하지만 기존 `accent-*` 규약과 어긋나고, `prose`는 Tailwind Typography 플러그인의 예약어와 헷갈린다(이 저장소엔 미설치지만 나중에 넣으면 충돌한다).
- `#aab49c`를 `muted-soft`로 쓰고 `#8a8f7a`를 `muted`로 미는 안 — `#aab49c`는 **어두운 사이드바 배경 전용**이라 밝은 배경 위 위계와 섞이면 안 된다 (`findings.md` 2-13). `Sidebar.tsx:42`의 하드코딩을 유지한다.

---

## R2. `TC-DESIGN-*`의 정적 단정 방식

**Decision**: `node:fs`로 소스 파일을 읽고 **정규식으로 클래스 문자열을 단정**한다. 프로덕션 코드에서 클래스를 상수로 추출하지 않는다.

**Rationale**: 액센트 버튼 4종은 **치수가 서로 다르다** — 카드 CTA는 14px/`12px 16px 10px`/radius 9px/depth 3px, 배너 CTA는 16px/`16px 22px 14px`/radius 10px/depth 4px, 아카이브 탭은 14px/`11px 12px 9px`/radius 8px, `+ 핑 보내기`는 12px/`7px 12px 5px`/radius 7px이다 (`interactions.md` §3.3). **공유할 단일 클래스가 애초에 없으므로** 상수 추출은 공통 부분이 없는 것을 억지로 묶는 일이 된다. 게다가 `FR-015`가 범위를 색·폰트·치수·레이아웃으로 한정한다.

`requirement.md` §3 Test Suite 9도 이미 이 수단을 지정하고 있다 — "설정값과 소스 문자열에 대한 정적 단정". 즉 단정 대상 자체가 소스 텍스트다.

**브리틀함을 줄이는 3가지 규칙** (`tasks` 단계에서 그대로 구현한다):

1. **앵커를 쓴다.** 파일 전체를 훑지 않고 고유 리터럴(`상세보기 ↗`, `+ 핑 보내기`, `🏆명예의 전당`) 주변으로 범위를 좁힌 뒤 단정한다.
2. **`px`는 토큰 경계로 센다.** `/(?:^|\s)px(?=\s|$)/`처럼 앞뒤가 공백이거나 끝인 경우만 센다. `px-3`·`px-4`는 `-`가 뒤따르므로 걸러진다 (`interactions.md` §3.3 주의 3).
3. **공백을 접어서 비교한다.** 줄바꿈·들여쓰기가 바뀌어도 깨지지 않도록 `\s+`를 공백 1칸으로 정규화한 뒤 매칭한다.

**Alternatives considered**:

- **클래스를 상수로 추출하고 상수를 단정** — 치수가 자리마다 달라 공통 상수가 성립하지 않는다(위 근거). 억지로 묶으면 `BUTTON_BASE` + 자리별 오버라이드가 되어 지금보다 읽기 어려워진다.
- **jsdom + testing-library로 렌더해 계산된 스타일 단정** — `requirement.md` §3이 명시적으로 금지했고 `next-steps.md` §3.4 주의도 같다. Tailwind 클래스는 빌드 타임에 CSS로 바뀌므로 jsdom에서 렌더해도 **계산된 색·크기가 나오지 않는다.** 의존성만 늘고 얻는 게 없다.
- **스냅샷 테스트** — 의도한 변경과 회귀를 구분하지 못한다. 디자인을 또 고칠 때 전부 갱신하게 된다.

**한계를 적어 둔다.** 소스 문자열 단정은 "클래스가 적혀 있다"까지만 보증하고 "화면에 그렇게 보인다"는 보증하지 않는다. 시각적 일치는 `quickstart.md`의 수동 대조가 맡는다.

---

## R3. `RealtimeFeed`의 `aside` prop 제거 후 조립 형태

**Decision**: `RealtimeFeed`는 **실시간 3종(LIVE 전광판 · 파티 레일 · 스터디 그리드)만** 렌더하고 `aside` prop을 없앤다. 아카이브 + 랭킹 2열 그리드와 CLI 푸터는 `app/dashboard/page.tsx`가 직접 조립한다.

```tsx
// app/dashboard/page.tsx (조립만 발췌)
<AppShell me={toPublicUser(me)}>
  <div className="flex flex-col gap-8">
    <RealtimeFeed initial={...} now={now} myLogin={me.login} sort={sort} archive={...} />

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <ArchiveTabs kind={archiveKind} completed={completed} postmortem={postmortem} sort={sort} />
      <Leaderboard rows={ranking} />
    </div>

    <CliFooter />

    {detail && <PostDetailModal post={detail} role={role} now={now} />}
  </div>
</AppShell>
```

**Rationale**: `aside`는 원래 "서버 컴포넌트를 클라이언트 경계 너머로 끼워 넣는" 장치였다(`RealtimeFeed.tsx` 주석, `006` R7). 랭킹과 CLI가 더 이상 실시간 블록 **옆**이 아니라 **아래**로 가면 클라이언트 경계를 넘을 이유가 사라진다. prop을 없애면 `Leaderboard`·`CliFooter`가 서버 컴포넌트로 곧장 렌더되고 전달 경로가 한 단계 짧아진다.

**실시간 채널은 1개 그대로다** (`NFR-004`, `contracts/realtime-posts.md` §2). `useRealtimePosts`는 여전히 `RealtimeFeed` 한 곳에서만 호출되고, 이번 변경은 그 바깥 블록의 위치만 바꾼다. 구독이 끊겨도 서버 렌더 결과를 유지한다는 규칙도 영향받지 않는다.

**Alternatives considered**:

- **`aside`를 유지하고 CSS로만 재배치** — `aside`는 `RealtimeFeed` **내부** 그리드의 둘째 칸에 들어간다. 아카이브는 `RealtimeFeed` 바깥에 있으므로 CSS만으로는 둘을 같은 행에 놓을 수 없다. `order`나 음수 마진으로 흉내 내면 읽을 수 없는 레이아웃이 된다.
- **`ArchiveTabs`까지 `RealtimeFeed` 안으로 넣기** — 아카이브는 실시간 갱신 대상이 아니다(`listHallOfFame`은 구독하지 않는다). 클라이언트 경계 안으로 끌어들이면 쓸데없이 번들이 커진다.
- **대시보드 전용 레이아웃 컴포넌트 신설** — 블록 5개를 한 줄씩 나열하는 일에 새 추상이 필요하지 않다. `page.tsx`가 조립하는 지금 구조로 충분하다.

---

## R4. 표면 틴트 토큰의 채택 범위

**Decision**: 신설 토큰은 **4개**다 — `surface`(`#eceedd`), `surface-bright`(`#F4F7E8`), `line`(`#d8dcc6`), `dday`(`#FF4D4F`). 나머지 미등록 색은 토큰을 만들지 않는다.

| 토큰 | 값 | 확인된 사용처 |
| :--- | :--- | :--- |
| `surface` | `#eceedd` | 태그 칩 무채 바탕(`CardMeta.tsx`의 `TagList` 2번째 이후), 랭킹 4·5위 뱃지 바탕 |
| `surface-bright` | `#F4F7E8` | 카드 리더 패널 바탕 (`FR-023`) |
| `line` | `#d8dcc6` | 아카이브 목록 행 구분선 `border-top:2px dashed` (`FR-026-a`, 아래 R5) |
| `dday` | `#FF4D4F` | 단기 파티 D-Day 칩 (아래 R6) |

**Rationale**: `requirement.md` `FR-026`과 `next-steps.md` §3.4 주의가 "실제 사용처가 확인된 것만 토큰화"로 범위를 걸었다. 위 4개는 이번 작업에서 **실제로 클래스를 쓰는 자리가 확정됐다.** 나머지는 아니다.

**토큰을 만들지 않는 것과 근거**:

- `#F0F1E4`·`#E7F6EC` — 완주·회고 화면의 패널 배경인데 007b 포팅이 해당 패널을 `accent-soft`/`card`로 이미 소화했고 바꿀 이유가 없다 (`findings.md` 2-9d).
- `rgba(228,241,212,0.45)` (개설 카드 바탕) — `accent-soft`의 45% 불투명도다. `bg-accent-soft/45`로 쓰고 토큰을 늘리지 않는다.
- `#e0e3cf` — `globals.css`의 스크롤바에 이미 하드코딩돼 있고 그 한 곳뿐이다.
- `#aab49c`·`#9aa088`·`#0d1409`·`#aef5bf`·`#b9c0a4` — `findings.md` 2-13·2-8e가 각각 불채택·보류·사이드바 전용으로 정리했다.
- `#f2c836`·`#f1f2e8` — 개구리 도감 전용(§1.3 보류).

**랭킹 메달 3색**(`#F5C518`·`#C9CDD4`·`#CD7F32`)은 `TC-DESIGN-01`이 "토큰으로 존재한다"를 단정하므로 **토큰으로 만든다** — `medal-gold`·`medal-silver`·`medal-bronze`. 의미가 분명하고 세 개가 한 묶음이라 이름이 값을 설명한다.

---

## R5. [신규 발견] 아카이브 목록에 행 구분선이 없다

**관찰**: 원본의 아카이브 목록은 행마다 `border-top:2px dashed #d8dcc6;padding:13px 0`으로 나뉜다 (`Dashboard.html:3672` 이하). 구현(`ArchiveTabs.tsx`)은 `flex flex-col gap-3`으로 간격만 주고 선이 없다.

**Decision**: 점선 구분선을 넣는다. `line` 토큰(R4)을 쓴다. 첫 행에는 선이 없다(원본도 `border-top`이라 첫 행 위에 선이 생기지만, 패널 제목 아래 구분 역할이므로 그대로 둔다).

**Rationale**: `.claude/rules/anti-ai-slop.md`의 **「구획: 효과 대신 `1px solid border` + 여백으로 나눈다」**에 정확히 해당한다. 장식이 아니라 목록 항목의 경계를 전달한다. 여백만으로는 항목 수가 늘었을 때 어디서 끊기는지 읽기 어렵다.

**함께 발견한 것 — 아카이브 패널 치수.** 원본은 `border:3px;border-radius:14px;padding:20px 24px 22px;box-shadow:5px 5px 0`이고 구현은 `nb rounded-[10px] p-4`(기본 `--nb-depth:3px`)다. `FR-022`(작아진 치수 교정)의 대상이므로 별도 FR을 만들지 않고 거기서 처리한다.

**함께 발견한 것 — `결과물 ↗`에 `px`가 잘못 붙어 있다.** 원본은 `font-size:13px;color:#6b705c;font-weight:600`으로 **Pretendard 텍스트 링크**인데 구현(`ArchiveTabs.tsx`)은 `px` 12px를 쓴다. 폰트 규칙이 **반대 방향으로** 어긋난 유일한 자리다. `TC-DESIGN-03`(칩·라벨에 `px`가 없다)의 검사 대상에 텍스트 링크를 포함한다.

---

## R6. [신규 발견] 단기 파티 D-Day 칩이 녹색이다

**관찰**: 원본의 D-Day 칩은 `background:#FF4D4F;color:#fff;font-size:13px;border:2px solid #18181b;padding:3px 9px;border-radius:5px`다 (`interactions.md` §3.3). 구현(`PartyCard.tsx:25`)은 `bg-accent-bright`(`#9be06a`) + 11px다.

**Decision**: `dday` 토큰(`#FF4D4F`)으로 바꾸고 치수도 맞춘다.

**Rationale**: `findings.md` 2-4가 이미 `#FF4D4F`를 "**위험·취소가 아니라 잔여 기간 강조**"로 분류했고 `Dashboard.html`에서 3건 모두 그 용도다. 지금은 D-Day 칩이 `accent-bright`라 **아카이브 탭 활성 상태·세그먼트 선택 상태와 같은 색**이 된다. `FR-001`이 `accent-bright`를 "선택된 상태"로 고정하는 순간 D-Day가 그 의미 체계에 잘못 끼어든다. 두 작업은 같은 PR에서 같이 처리해야 한다.

**`CLAUDE.md` §10 「색은 의미(상태·위계)에만」 위반이 아니다.** 액센트 1색 규칙은 녹색 계열을 가리키고, `#FF4D4F`는 "남은 기간이 얼마 없다"는 **시간 정보**를 전달하는 별도 축이다. LIVE 계열(`#16a34a`)이 별도 축인 것과 같다.

---

## R7. `✓` 칩의 의미와 데이터 (`FR-023` 보강)

**Decision**: `✓`는 **42 인증 완료** 표시이며 `leader.campus !== null`일 때만 렌더한다.

**Rationale**: `PublicUser`는 `{ login, campus }`뿐이고 `FR-015`가 응답 계약 변경을 막는다. 그 안에서 `✓`가 전달할 수 있는 사실은 `campus`의 유무가 유일하다. `CLAUDE.md` §7.2가 "GitHub 인증만 한 유저는 `campus`가 `null`"로 못박고 있으므로 파생이 성립한다.

**중복을 인정하고 기록한다.** `CampusBadge`(`42경산`/`42서울`)가 같은 사실을 이미 전달한다. 원본도 부제 `42 인트라 · 리더 4회`와 `✓`를 나란히 둔다. 사용자가 원본을 따르기로 결정했으므로(2026-10-18) 그대로 간다. **anti-ai-slop 「정당성」은 통과한다** — `✓`는 "답을 못 하는 장식"이 아니라 인증 여부를 가리키며, `campus`가 없으면 사라진다.

**`✓`는 새 글리프가 아니다.** `.claude/rules/anti-ai-slop.md` 「프로젝트 예외」에 등재된 6종 안에 이미 있다.

---

## R8. 반응형에서 레이아웃이 접히는 방식

**Decision**: `xl` 미만에서는 아카이브 + 랭킹 2열을 1열로 접고, 스터디 그리드는 기존 `sm:grid-cols-2 xl:grid-cols-3`을 유지한다. 본문 `max-width`는 `mx-auto`와 함께 건다.

**Rationale**: 원본은 `min-width:1280px`라 반응형 분기가 없다. 구현은 `SC-008`(375px 1열)을 지켜야 하므로 원본에 없는 판단이 필요한데, **이미 쓰는 분기점을 그대로 쓴다** — 스터디 그리드가 `xl`에서 3열이 되므로 같은 `xl`에서 아카이브도 2열이 되면 두 블록의 열 전환이 한 지점에서 일어난다. 분기점을 새로 만들면 중간 폭에서 어긋난 레이아웃이 나온다.

`max-width`만 걸고 `mx-auto`를 빼면 넓은 화면에서 본문이 왼쪽에 쏠린다. 원본은 `min-width`로 그 상황이 생기지 않아 명시가 없지만, 구현에는 필요하다.

---

## 미해결 없음

`spec.md`의 NEEDS CLARIFICATION 성격 항목(토큰 이름·단정 방식·조립 형태)이 모두 닫혔다. R5·R6은 계획 중 새로 발견했고 둘 다 `FR-026` 범위 안이라 별도 승인이 필요하지 않다 — R6은 `FR-001`의 선택 상태 색 분리와 **같은 PR에서 처리해야 한다**는 제약이 붙는다.
