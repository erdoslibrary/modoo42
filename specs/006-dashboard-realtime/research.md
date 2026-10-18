# Phase 0 Research: 대시보드 UI 결합 & 실시간 동기화

조사 대상은 "어떻게 만들 것인가"다. 무엇을 만들 것인가는 [spec.md](./spec.md)가 정했다. 결정 14건(R1~R14)을 기록한다. 각 항목은 결정 · 근거 · 기각한 대안 순서다.

---

## R1. 초기 렌더는 서버 컴포넌트가 도메인 함수를 직접 호출한다

**결정**: 대시보드·상세·프로필의 첫 화면은 React Server Component에서 `src/lib/posts.ts`·`src/lib/profile.ts`의 함수를 직접 호출해 렌더한다. HTTP(`fetch('/api/posts')`)를 거치지 않는다. 변경 동작(참여·개설·조기 완료)과 실시간 보강 조회만 클라이언트에서 Route Handler를 호출한다.

**근거**: Route Handler는 같은 프로세스 안의 얇은 래퍼이고 로직은 이미 `src/lib/posts.ts`에 모여 있다(Phase 1 설계). RSC에서 자기 서버의 HTTP를 다시 호출하면 직렬화·네트워크 왕복·쿠키 수동 전달이 늘고, Next.js 14에서 상대 경로 `fetch`는 절대 URL이 필요해 `NEXT_PUBLIC_APP_URL` 의존이 생긴다. `getCurrentUser()`는 `cookies()`를 읽으므로 RSC에서 그대로 동작한다.

**기각**: ① 전부 클라이언트에서 `fetch` — 초기 렌더가 빈 화면에서 시작하고 RSC 이점을 버린다(trd §1 "RSC로 초기 렌더링 최적화"). ② 서버 액션으로 변경 동작 처리 — Route Handler가 이미 전부 있고 에러 매핑(`AppError` → HTTP)도 그 경로에 있다. 두 경로를 병행하면 같은 검증이 두 곳에 생긴다.

## R2. 화면 전용 파생값은 순수 모듈로 빼고 CLI와 공유한다

**결정**: `src/lib/display.ts`를 신설해 `remainingLabel`(남은 시간)·`ddayLabel`(D-Day)·`initials`(이니셜 뱃지)·`headcountLabel`(인원)·`cycleLabel`(기간 표기)을 둔다. `src/lib/cli-format.ts`에 private으로 있던 `remainingLabel`·`ddayLabel`을 이 모듈로 옮기고 CLI가 import한다.

**근거**: 같은 문자열을 전광판과 CLI가 함께 쓴다("42분 남음", "D-3"). 두 곳에 같은 계산을 두면 어긋난다. 순수 함수이므로 Vitest로 경계값을 고정할 수 있고(`D-Day`, 1분 미만 올림), 클라이언트 컴포넌트에서도 안전하다(`@/db` 비의존). 기존 CLI 테스트가 출력 문자열을 고정하고 있으므로 이동 중 포맷이 바뀌면 바로 깨진다 — 안전망이 이미 있다.

**기각**: 컴포넌트 안에서 각자 계산 — 전광판과 CLI의 표기가 갈라진다. `cli-format.ts`에서 export만 추가 — 화면 코드가 CLI 포매터를 import하는 역방향 의존이 생긴다.

## R3. 단기 파티 마감 경계는 "KST 당일 끝"으로 저장 시점에 정규화한다

**결정**: `end-date.ts`에 `endOfKstDay(date)`를 추가하고, `createPost`가 `PARTY`의 `endDate`를 그 날짜의 KST 23:59:59.999로 올려 저장한다. 조회 필터와 참여 검증은 `end_date <= now()` 단순 비교만 한다.

**근거**: 입력 검증이 `z.coerce.date()`이므로 달력이 보낸 `2026-10-14`는 `2026-10-14T00:00:00Z`가 된다. 이는 KST 09:00이라 마감일 당일 오전에 이미 "지난 것"이 된다. D-Day 카드를 보여주면서 참여를 막는 모순이 생긴다. 정규 스터디의 `computeStudyEndDate`가 이미 말일 23:59:59.999 KST를 저장하므로 같은 규칙으로 맞추면 두 유형의 의미가 통일된다.

**기각**: 조회할 때마다 KST 당일 끝으로 보정 — 보정 로직이 조회·참여·D-Day 계산 3곳에 흩어지고, 하나라도 빠지면 경계가 어긋난다. 저장 시 한 번 정규화하는 쪽이 불변식을 데이터에 고정한다.

## R4. 마감 필터는 `listPosts` 한 곳에, 참여 차단은 `joinPost` 한 곳에 넣는다

**결정**: `listPosts`의 `where`에 `NOT (type = 'PARTY' AND end_date <= now)` 조건을 더한다. `joinPost`의 상태 검증 뒤에 "`PARTY`이고 `end_date`가 지났으면 `CLOSED`(400)" 검증을 더한다. 상세 조회(`getPostDetail`)는 건드리지 않는다.

**근거**: `listForCli`가 `listPosts`를 호출하므로 대시보드와 CLI가 한 번의 수정으로 같이 맞는다(`src/lib/posts.ts:357`). LIVE 핑 Lazy Filter가 이미 같은 `where`에 같은 모양으로 들어 있어 패턴이 일치한다. 참여 차단을 별도로 둬야 하는 이유는 상태값이 `RECRUITING`으로 남기 때문이다 — 상태 검증만으로는 통과한다(FR-043).

**기각**: 조회 시 상태를 `CLOSED`로 갱신(read-time write) — 조회가 쓰기를 하면 동시 요청에서 경합이 생기고, GET이 부작용을 갖는다. cron 배치 — 운영 인프라와 배포 연결(U4)에 묶이고 LIVE 핑과 처리 방식이 갈라진다.

## R5. 폰트는 디자인 원본이 쓰는 CDN을 그대로 쓴다

**결정**: `src/app/globals.css`에서 두 스타일시트를 `@import`한다 — Pretendard Variable 동적 서브셋(`cdn.jsdelivr.net/gh/orioncactus/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css`)과 Galmuri(`cdn.jsdelivr.net/gh/quiple/galmuri@2.40.4/dist/galmuri.css`). Tailwind `fontFamily`에 `sans`(Pretendard Variable)와 `px`(Galmuri11)를 등록한다. `next/font/local`과 `src/app/fonts/Geist*.woff` 2개는 제거한다.

**근거**: 디자인 원본 HTML이 이미 이 두 URL을 쓰고 있어 화면이 디자인과 1:1로 맞는다. 저장소에 폰트 바이너리를 커밋하지 않아 라이선스 파일 관리와 용량 증가가 없다. Galmuri11은 한글 픽셀 글립을 담아 파일이 크고, Pretendard 동적 서브셋은 사용 글자만 받아 가므로 CDN 쪽이 유리하다. 두 폰트 모두 OFL이다.

**기각**: `next/font/local`로 woff2를 커밋 — `next/font`의 preload·self-host 이점은 있으나, 한글 폰트 전체를 커밋하면 저장소가 수 MB 늘고 서브셋을 직접 관리해야 한다. 지금은 자원 관리 비용이 이득보다 크다. Google Fonts — 두 폰트 모두 없다.

## R6. 디자인 토큰은 Tailwind `theme.extend`에 등록하고 `.nb`만 CSS로 둔다

**결정**: `tailwind.config.ts`의 `theme.extend.colors`에 토큰을 이름으로 등록한다 — `bg`(`#EDEFE0`), `ink`(`#18181b`), `accent`(`#5FB63A`), `accent-hover`(`#6cc546`), `accent-dark`(`#3c7a1e`), `accent-soft`(`#E4F1D4`), `accent-bright`(`#9be06a`), `live`(`#16a34a`), `sidebar`(`#20301C`), `card`(`#fffef7`), `muted`(`#71717a`). `globals.css`에는 `@layer components`의 `.nb`(테두리·하드 섀도우·`:active` 눌림)와 `.px`(Galmuri 타이틀), `pulse` 키프레임, `.hs`(가로 스크롤바)만 남긴다. Next 기본 다크모드 변수와 `font-family: Arial`은 지운다.

**근거**: 색을 이름으로 쓰면 `bg-[#EDEFE0]` 같은 리터럴이 컴포넌트마다 반복되지 않는다. 깊이(`--nb-depth`)와 `:active` 이동은 `interactions.md` §3.1이 CSS 변수 방식을 지정했으므로 그대로 따른다. 다크모드는 디자인에 없으므로 변수를 남기지 않는다.

**색 수가 늘어나는 점에 대한 판단**: anti-ai-slop은 "무채색 + 액센트 1색"을 요구한다. 위 색은 모두 같은 녹색 계열의 명도 단계와 사이드바 배경이며, 상태·위계 표현에만 쓴다(활성 메뉴·액센트 버튼·LIVE·링크). 새 색상군을 추가하는 것이 아니라 디자인 원본이 쓰는 한 계열을 이름 붙이는 작업이다.

**기각**: CSS 변수만 두고 임의값(`bg-[var(--accent)]`) 사용 — Tailwind 자동완성과 타입 이점을 버린다. 인라인 `style`로 원본을 그대로 옮기기 — `:hover`·`:active`를 표현할 수 없다(`interactions.md` §3.3이 명시적으로 금지).

## R7. 모달은 네이티브 `<dialog>`로 만든다

**결정**: 상세 모달과 참여 확인 팝업은 `<dialog>` 엘리먼트와 `showModal()`을 쓴다. 새 UI 의존성을 추가하지 않는다. `::backdrop`은 `rgba(24,24,27,.45)` 단색으로 두고 `backdrop-filter`를 쓰지 않는다.

**근거**: 포커스 트랩·`Esc` 닫기·배경 비활성화를 브라우저가 처리한다. 직접 구현하면 접근성 처리를 재발명하고, 라이브러리(Radix·Headless UI)를 넣으면 이 화면 2개를 위해 의존성이 늘어난다. `backdrop-filter: blur`는 금지 항목이다.

**기각**: `role="dialog"` + 수동 포커스 관리 — 키보드 접근성 버그를 스스로 만든다. 라이브러리 도입 — 지금 필요한 범위를 넘는다.

## R8. 상세 모달은 URL에 상태를 싣는다

**결정**: 상세 모달은 `/dashboard?post=<id>` 쿼리로 열린다. 서버가 그 쿼리를 보고 `getPostDetail`을 호출해 모달 내용을 렌더한다. 확인 팝업은 URL에 싣지 않고 클라이언트 상태로만 둔다.

**근거**: 상세 내용에는 `chat_url` 마스킹 판정이 들어가므로 서버가 그려야 한다(헌법 V). 쿼리에 싣으면 새로고침·뒤로가기·링크 공유가 그대로 동작하고, 참여 성공 후 `router.refresh()`로 서버가 다시 판정해 "참여자 전용 링크"가 자동으로 나타난다. 확인 팝업은 저장되지 않는 중간 상태이므로(spec Key Entities) URL에 남을 이유가 없다.

**기각**: 클라이언트에서 상세를 `fetch`해 모달에 채우기 — 가능하지만 마스킹 판정 결과를 클라이언트 상태로 들고 있어야 하고, 참여 후 재판정을 수동으로 처리해야 한다. 별도 페이지(`/posts/[id]`) — 디자인이 모달이고(prd F4), 뒤에 깔린 피드를 유지해야 한다.

## R9. 새 탭은 사용자 클릭 시점에 미리 열고 응답이 오면 주소를 채운다

**결정**: 확인 팝업의 `[확인]` 핸들러에서 먼저 `window.open('', '_blank')`로 빈 탭을 열고, 참여 응답의 `chatUrl`을 받아 그 탭의 `location`에 넣는다. 탭 열기가 차단되면(반환값이 `null`) 상세 모달에 `[오픈채팅 바로가기 ↗]`를 띄워 두 번째 클릭으로 열 수 있게 한다.

**근거**: 브라우저 팝업 차단은 "사용자 제스처 직후"가 아닌 `window.open`을 막는다. `await fetch(...)` 뒤에 열면 차단된다. 제스처 시점에 탭을 선점하면 정상 경로가 1클릭으로 끝나고, 차단 환경에서도 참여 기록은 이미 남으므로 링크 재열람으로 복구된다(spec Edge Cases).

**기각**: 응답 후 `window.open` — 차단 환경에서 참여는 됐는데 링크를 못 여는 상태가 흔하게 발생한다. 같은 탭 이동(`location.href`) — 대시보드를 잃는다. 참여 전에 링크를 미리 받아 두기 — 비참여자에게 `chat_url`을 주는 것이므로 헌법 V 위반이다.

## R10. 실시간은 브라우저 클라이언트 1개와 훅 1개로 모은다

**결정**: `src/lib/supabase/client.ts`가 `createBrowserClient`(`@supabase/ssr`)로 싱글턴을 만들고, `src/hooks/useRealtimePosts.ts`가 `posts-channel` 하나를 구독한다. 훅은 `postgres_changes`의 `INSERT`·`UPDATE`를 받아 ① `UPDATE`는 해당 카드의 `currentMembers`·`status`·`expiresAt`을 머지하고 ② `INSERT`는 `GET /api/posts?type=LIVE`를 다시 호출해 전광판을 교체한다. 서버 컴포넌트는 초기 데이터를 props로 내려주고, 훅은 그 값을 초기 상태로 받는다.

**근거**: 공개 복제 컬럼이 최소 집합(`id`·`type`·`status`·`current_members`·`max_members`·`expires_at`·`created_at`·`updated_at`)으로 고정돼 있어 `INSERT` payload만으로는 제목·위치를 그릴 수 없다(trd §5). 보강 조회는 Route Handler를 쓰는 편이 마스킹 규칙을 서버에 유지한다. 채널을 1개로 두면 구독 수와 재연결 처리가 한 곳에 모인다.

**기각**: 테이블별·카드별 채널 다중 구독 — 연결 수가 카드 수에 비례한다. `INSERT`에도 payload만 쓰기 — 제목 없는 핑이 전광판에 뜬다. `router.refresh()`로 전체 서버 재렌더 — 1초 기준은 만족하겠지만 모든 이벤트가 전체 페이지 재조회를 유발하고, 스크롤·모달 상태가 흔들린다.

**디렉터리**: `src/hooks/`를 새로 만든다. `CLAUDE.md` §3 디렉터리 규약에 이 경로를 같은 PR에서 추가한다.

## R11. 공개 키 형식과 RLS가 실시간 구독에 미치는 영향은 착수 전에 실측한다

**결정**: `.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 신형 `sb_publishable_` 형식이고 설치된 `@supabase/supabase-js`가 2.117.3이다. 구독을 붙이는 첫 작업에서 실제 연결과 이벤트 수신을 확인한다. 실패하면 Supabase 대시보드의 레거시 anon JWT 키로 교체해 재시도하고, 그 결과를 `docs/next-steps.md` U3에 기록한다.

**근거**: U3 메모가 "구독을 붙일 때 확인한다"로 남겨 둔 항목이다(next-steps §1). 키 형식은 헤더에 실려 나가는 값이라 라이브러리 코드를 읽어서는 서버 수용 여부를 알 수 없다. 실측이 유일한 검증이다.

**전방 위험(이 브랜치 범위 밖)**: Phase 4에서 RLS를 켜면(`FR-017`) `postgres_changes` 구독은 RLS 평가를 받는다. `posts`에 공개 `SELECT` 정책이 없으면 구독이 조용히 이벤트를 받지 못한다. `FR-017` 작업 시 "Realtime 구독용 SELECT 정책"을 함께 점검해야 한다 — `docs/next-steps.md` §4에 항목으로 남긴다.

## R12. 라우트는 4개만 만들고 하위 목록은 섹션 앵커로 처리한다

**결정**: `/dashboard`(피드, `?post=`·`?archive=` 쿼리 수용), `/create`(개설 폼, `?type=` 쿼리로 유형 선택), `/profile`(내 기록), 그리고 `/`는 `/dashboard`로 보낸다. 사이드바의 "정규 스터디"·"단기 파티"·"명예의 전당"은 대시보드 내 섹션 앵커(`#studies`·`#parties`·`#archive`)로 이동한다.

**근거**: 보호 라우트 목록을 `trd.md` §2.2가 `/dashboard`·`/create`로 전제하므로 지금 다른 주소를 쓰면 Phase 4에서 미들웨어와 함께 옮겨야 한다. 유형별 목록 페이지를 따로 만들면 같은 조회를 세 화면이 반복하게 되고, 대시보드가 이미 유형별 섹션을 모두 갖고 있다. 아카이브 탭은 서버가 `kind`에 따라 다른 조회를 하므로 쿼리로 둔다.

**기각**: `/studies`·`/parties`·`/archive` 라우트 신설 — 화면 3개가 늘지만 새 정보는 없다. 탭을 클라이언트 상태로만 두기 — 새로고침에 탭이 초기화되고 공유 링크가 안 된다.

## R13. 프로필 이력은 새 모듈의 조회 1건으로 산출한다

**결정**: `src/lib/profile.ts`에 `getProfile(userId, database?)`를 둔다. `users` 1행과 `participants ⋈ posts` 조회로 이력을 만들고, 각 항목을 다음 규칙으로 분류한다 — 참여 상태가 `COMPLETED`면 **완주**, 글의 리더가 본인이면 **리더**(완주 여부와 중복 표기 가능), 글 상태가 `RECRUITING`·`CLOSED`이고 참여 상태가 `JOINED`면 **진행 중**, 참여 상태가 `INCOMPLETE`이거나 글이 `CANCELLED`면 **종료**로 묶는다. 신규 테이블·컬럼을 만들지 않는다(req FR-019).

**근거**: 이력은 저장된 값이 아니라 파생값이다. 한 번의 조인 조회로 전부 나오고, 분류는 순수 함수로 테스트할 수 있다. `posts.ts`에 더하지 않는 이유는 그 파일이 이미 모집·참여·완주·아카이브를 담아 700줄을 넘었고, 프로필은 쓰기 경로가 없는 읽기 전용 관심사라는 점이다.

**기각**: 세 번의 개별 조회(완주·리더·진행 중) — 같은 조인을 세 번 돌고 분류 규칙이 SQL에 흩어진다. 집계 컬럼 신설 — `FR-019`가 금지한다.

## R14. 컴포넌트 렌더 테스트는 도입하지 않고 파생 로직을 순수 함수로 내려 테스트한다

**결정**: 이 브랜치의 Vitest 대상은 ① `display.ts`의 표기 파생 ② `end-date.ts`의 `endOfKstDay` 경계 ③ `listPosts`·`joinPost`의 단기 파티 마감(TC-PARTY-01·02) ④ `profile.ts`의 이력 분류다. React 컴포넌트 렌더 테스트(`@testing-library/react`·`jsdom`)는 추가하지 않는다. 화면 검증은 [quickstart.md](./quickstart.md)의 수동 시나리오로 한다.

**근거**: 헌법 I이 TDD를 강제하는 대상은 "핵심 도메인 로직(참여 동시성·상태 머신 전이·완주 판정·권한 제어)"이다. 이 브랜치가 그 범주에 더하는 것은 단기 파티 마감 차단뿐이고, 나머지는 표기·분류 파생이다. 렌더 테스트를 도입하면 devDependency 2~3개와 설정이 늘고, 실제로 검증해야 할 것(실시간 1초 반영, 375px 레이아웃, 모달 포커스)은 jsdom에서 확인되지 않는다.

**기각**: `@testing-library/react` 도입 — 비용 대비 잡히는 결함이 적다. 테스트 없이 진행 — 마감 경계와 표기 파생은 경계값 버그가 나기 쉬운 자리다.

---

## 미결 사항

없다. spec.md의 `[NEEDS CLARIFICATION]` 2건은 사양 단계에서 결정됐고(`FR-020` Lazy Filter 채택, `FR-021` 분리), 그 결과가 요구사항 문서에 반영돼 있다.
