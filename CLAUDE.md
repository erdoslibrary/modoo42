# Modu-42 (모두의 42) Development Guide

42 멤버 대상 스터디 / 단기 파티 / LIVE 핑 모집 및 완주 기록 플랫폼.

**스택:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Drizzle ORM + Supabase (PostgreSQL & Realtime) + Vercel.
**패키지 매니저는 pnpm이다.** `npm`/`npx`를 쓰지 않는다.

---

## 1. 문서 SSOT (단일 진실 공급원)

| 문서 | 역할 | 이 문서가 최종 권위를 갖는 영역 |
| :--- | :--- | :--- |
| `docs/requirement.md` | 요구사항 정의서 | Phase 범위, FR/NFR ID, 인수 테스트 시나리오 |
| `docs/trd.md` | 기술 설계서 | DB 스키마, API 명세, 트랜잭션 구현, CI/CD |
| `docs/prd.md` | 기능 상세 명세 | UX 플로우, 화면 카피, 엣지 케이스, MoSCoW 우선순위 |
| `docs/plan.md` | 기획서 | 프로젝트 배경 및 철학 |
| `docs/speckit-guide.md` | speckit 운영 가이드 | 명령어 체계 및 진행 절차 |
| `docs/designs/interactions.md` | 상호작용 스펙 | 호버·누름 상태 값, `--nb-depth` 구현 지침 |
| `.claude/rules/anti-ai-slop.md` | 디자인 규칙 | 이미지·HTML·SVG 생성 시 금지/강제 사항 |
| `.claude/rules/speckit.md` | SDD 규칙 | 구현 작업의 필수 4단계 루프 |

**다음 작업 순서와 사용자가 직접 수행해야 하는 외부 작업(U1~U7)은 `docs/next-steps.md`에 있다.** 권위 문서가 아니라 운영 체크리스트이므로, 내용이 위 표의 문서와 어긋나면 SSOT를 따르고 `next-steps.md`를 고친다. Phase를 시작하기 전에 해당 Phase의 선행 외부 작업이 끝났는지 이 문서로 확인한다.

**Phase 3 UI 포팅 원본:** `docs/designs/Dashboard.html`, `docs/designs/create_study.html`, `docs/designs/about_study.html`(상세보기 모달), `docs/designs/myprofile.html`(프로필·스터디 이력), `docs/designs/complete.html`, `docs/designs/PixelFrog.html`.

디자인 파일은 **정적으로 렌더된 HTML**이다. 브라우저로 바로 열어 확인한다. 원래는 `sc-for`/`sc-if`/`{{ }}` 바인딩을 쓰는 dc 템플릿이었고, 초기 state 기준으로 전개했다. `sc-if`로 숨겨지는 분기는 별도 파일로 분리해 뒀다.

| 분기 파일 | 원본의 숨은 분기 |
| :--- | :--- |
| `Dashboard_postmortem.html` | 🪦Post-mortem 탭 (`Dashboard.html`은 🏆명예의 전당 탭) |
| `create_study_party.html` | 단기 파티 개설 폼 (`create_study.html`은 정규 스터디) |
| `create_study_live.html` | LIVE 핑 등록 폼 |
| `complete_postmortem.html` | Post-mortem 등록 (`complete.html`은 완주 판정) |

호버·누름 상태(`style-hover`/`style-active`)와 `onClick`은 렌더 과정에서 제거됐다. **제거된 호버·누름 값과 Phase 3 CSS 구현 지침은 `docs/designs/interactions.md`가 SSOT다.** 그 밖의 상호작용 스펙은 `prd.md`를 따른다.

`myprofile.html`의 **개구리 도감·획득 배지 섹션은 포팅하지 않는다.** 수여 규칙과 저장 스키마가 미정이라 `requirement.md` §1.3에 보류로 분류됐다. 프로필 화면과 스터디 이력만 FR-019 범위다.

문서 간 충돌 시 우선순위: `requirement.md` > `trd.md` > `prd.md` > `plan.md`. 충돌을 발견하면 임의로 한쪽을 따르지 말고 문서를 먼저 수정한다.

`.agents`는 `.claude`를 가리키는 심볼릭 링크다 (Antigravity IDE 겸용). 규칙·스킬 파일은 `.claude/` 아래에만 두고 `.agents/`에 중복 생성하지 않는다.

---

## 2. 개발 명령어 (Commands)

```bash
pnpm dev                 # 로컬 개발 서버
pnpm build               # 프로덕션 빌드
pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm test                # Vitest
pnpm drizzle-kit generate  # 스키마 변경 → 마이그레이션 생성
pnpm drizzle-kit migrate   # 마이그레이션 적용
pnpm drizzle-kit check     # 스키마/마이그레이션 정합성 검증
```

CI(GitHub Actions, `.github/workflows/ci.yml`)는 PR에서 `lint` → `typecheck` → `build` → `drizzle-kit check`를 실행하고, main push 시 `drizzle-kit migrate` 후 Vercel 배포한다. `build` 단계는 더미 `DATABASE_URL`로 돌며 실제 자격증명을 쓰지 않는다.

**`pnpm test`는 CI에 없다. PR을 올리기 전 로컬에서 직접 통과시켜야 하는 필수 게이트다.** 테스트가 공용 Supabase 인스턴스(트랜잭션 풀러, 포트 6543)에 붙기 때문에 CI 병렬 run이 커넥션을 재배치해 prepared statement를 깨뜨린다. 전용 테스트 DB 또는 Direct 접속(포트 5432)을 확보한 뒤 Phase 4에서 CI에 편입한다 (NFR-006).

### Phase 0에서 해결 완료

- 의존성 설치됨: `zod`, `vitest`, `dotenv` (vitest/drizzle-kit의 `.env.local` 로드용).
- 설정 생성됨: `drizzle.config.ts`, `vitest.config.ts`. `pnpm test` 스크립트 추가됨.
- 스키마·마이그레이션 생성/적용됨: `src/db/schema.ts`, `drizzle/`, `users`/`posts`/`participants`.
- Mock 인증 구현됨: `src/lib/auth.ts`, `/api/mock-auth`, `MockAuthModal.tsx`.
- `DATABASE_URL`은 `.env.local`에 직접 설정한다 (아래 4장). 커밋하지 않는다.

---

## 3. 디렉터리 규약

```
src/db/schema.ts            # Drizzle 스키마 — 정의 원본은 trd.md §3.2
src/db/index.ts             # postgres 클라이언트 + drizzle 인스턴스
src/lib/auth.ts             # getCurrentUser() 세션 추상화
src/lib/supabase/client.ts  # 브라우저 Supabase 클라이언트 (Realtime 구독 전용)
src/hooks/**                # 클라이언트 전용 훅 ('use client')
src/lib/errors.ts           # AppError 및 HTTP 매핑 (8장)
src/templates/types.ts      # StudyTemplate 인터페이스
src/templates/registry.ts   # 템플릿 플러그인 등록부
src/app/api/**/route.ts     # Route Handlers
src/components/**           # React 컴포넌트
tests/**                    # Vitest 테스트
specs/<phase>/              # speckit 산출물 (spec.md / plan.md / tasks.md)
```

DB 스키마를 바꿀 때는 `src/db/schema.ts`와 `docs/trd.md` §3.2를 **같은 PR에서 함께** 수정한다.

---

## 4. 환경변수 (`.env.local`)

| 키 | 용도 |
| :--- | :--- |
| `DATABASE_URL` | Drizzle 및 Vitest가 쓰는 Supabase PostgreSQL 접속 문자열 (Direct 또는 Pooler) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL (Realtime 구독용) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon 공개 키 |
| `NEXT_PUBLIC_APP_URL` | OAuth 콜백 URL 조립용 앱 베이스 URL |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 자격증명 (Phase 4) |

`.env.local`은 git에 올리지 않는다. 키를 추가하면 `.env.example`도 같이 갱신한다.

Mock 세션 쿠키 이름은 `modoo42_mock_user`다.

---

## 5. 개발 워크플로우 (speckit SDD + TDD)

사용자가 `speckit`을 언급하지 않아도("Phase 1 구현해줘") 직결 구현을 하지 않고 4단계 루프를 순서대로 적용한다.

1. `speckit-specify` — `docs/requirement.md`의 해당 Phase 기반으로 `specs/<phase>/spec.md` 작성
2. `speckit-plan` — 아키텍처 및 구현 설계 `specs/<phase>/plan.md` 수립
3. `speckit-tasks` — 의존성 순서의 체크리스트 `specs/<phase>/tasks.md` 생성
4. `speckit-implement` — TDD(Red-Green-Refactor)로 순차 구현

Phase 구성: Phase 0 기반 인프라 & Mock 인증 / Phase 1 모집·참여 코어 / Phase 2 완주 라이프사이클 & 서브 도메인 / Phase 3 UI 결합 & Realtime / Phase 4 GitHub OAuth & 보안·운영 자동화.

**예외:** CI/CD 워크플로, 설정 파일, PR·이슈 템플릿, 문서 동기화, 의존성 변경은 `specs/` 아티팩트 없이 `chore:` 커밋으로 직결 처리한다. 단 도메인 로직·DB 스키마·API 표면을 바꾸지 않을 때만이다. 전문은 `.claude/rules/speckit.md`의 "예외 — chore 직결 처리"가 SSOT다.

---

## 6. 아키텍처 원칙

### 6.1 인증

- Phase 0~3: 로컬 Mock 인증. `/api/mock-auth`가 `modoo42_mock_user` 쿠키에 페르소나(`gs_leader`, `gs_member`, `seoul_member`, `guest`)를 기록하고, `getCurrentUser()`가 쿠키를 파싱해 `users` 레코드를 반환한다.
- Mock 엔드포인트와 `MockAuthModal`은 `NODE_ENV === 'development'`에서만 동작한다. 상용 빌드에서 노출되면 인증 우회가 되므로 서버·클라이언트 양쪽에서 차단한다.
- Phase 4: GitHub OAuth 2.0 Authorization Code + 30일 세션 쿠키 (`HttpOnly`, `Secure`, `SameSite=Lax`). **PKCE를 쓰지 않는다** — GitHub OAuth App이 지원하지 않으므로 `state` 검증으로 CSRF를 막는다. `users` Upsert 충돌 기준은 `github_id`다 (`login`은 유저가 변경할 수 있어 매칭 키로 쓰지 않는다).
- 42 Intra 인증은 **선택적 2차 인증**이며 `requirement.md` §1.3 보류다. 범위는 `intra_id`·`campus`·`intra_verified_at` 채우기와 캠퍼스 뱃지 표출까지다. 42 인증 유저 전용 기능 게이팅은 만들지 않는다.

### 6.2 참여 플로우와 링크 가시성 (중요)

신청-승인 결재 플로우는 없지만 **무조건 즉시 참여는 아니다.**

1. 카드의 `[상세보기]` → 상세 모달. 비참여자도 소개·목표·참여자 목록·`place`·`chat_platform` 배지·`reference_url`을 본다.
2. `[참여하기]` → 확인 팝업("참여 후에는 취소가 불가능하며 오픈채팅방으로 이동합니다").
3. 확정 시 `participants` Insert(`JOINED`) + `current_members + 1` + `window.open(chat_url, '_blank')`. `chat_url`이 없는 오프라인 전용 모집은 탭을 열지 않고 확인 팝업 카피도 "오픈채팅방으로 이동" 문구를 뺀다 (§7.1 chat_url 조건부 필수).

**`chat_url`은 참여자에게만 공개한다.** `GET /api/posts/:id` 응답에서 비참여자에게는 `chat_url`을 마스킹(필드 제외)해야 한다. 플랫폼 종류(`chat_platform`)와 `reference_url`은 전체 공개다.

자진 참여 취소(Leave)와 강퇴(Kick)는 정책상 없다. `participant_status`의 `LEFT`/`REMOVED`는 스키마에만 남은 미사용 값이므로 구현하지 않는다.

### 6.3 동시성 및 정원 관리

원클릭 참여는 Drizzle `db.transaction()` 안에서 `posts` 행을 `.for('update')`로 잠근 뒤 중복 확인 → 정원 검증 → `participants` 기록 → 카운트 증가 순으로 처리한다 (NFR-001). 이미 `JOINED`인 유저는 카운트를 올리지 않고 기존 `chat_url`을 반환한다 (멱등성). 구현 원본은 `trd.md` §4.1.

### 6.4 상태 머신 (NFR-003)

```
RECRUITING  <-->  CLOSED        정원 도달 시 자동 CLOSED, 리더 수동 마감/재모집 토글 (FR-004). 양방향.
RECRUITING | CLOSED  ->  COMPLETED    완주 벌크 판정 (FR-008). 최종.
RECRUITING | CLOSED  ->  CANCELLED    리더의 중도 취소 (FR-005). 최종.
```

- `COMPLETED`와 `CANCELLED`는 최종 상태다. 역전 불가이며, 이 상태에서 참여·수정·취소 시도는 400으로 차단한다.
- Post-mortem 등록은 **상태 전이가 아니다.** `postmortem_text`만 기록되고 상태는 `CLOSED`로 유지되며, 리더/완주자 카운트도 가산되지 않는다 (FR-009).
- 단기 파티(`PARTY`)는 `end_date` 도래 시 판정 대상이 아니다. 종료는 상태 전이가 아니라 **Lazy Filter**다 (FR-020) — 모집 피드 조회에서 `end_date`가 지난 파티를 제외하고 참여 요청을 400(`CLOSED`)으로 거절하며, 만료용 cron을 두지 않는다. 상태값은 `RECRUITING`으로 남으므로 참여 경로에 별도 검증을 둔다.
- LIVE 핑(`LIVE`)은 작성자 조기 완료 시에만 `CLOSED`로 전이한다. 유효시간 만료는 상태 전이가 아니라 **Lazy Filter**다 — 조회 쿼리에 `status = 'RECRUITING' AND expires_at > now()`를 걸어 제외하며, 만료용 cron을 두지 않는다.

### 6.5 책장/플러그인 템플릿

플랫폼은 스터디 수명주기(모집·참여·완주)만 제공하고, 세부 유형은 `src/templates/registry.ts`의 플러그인으로 분리한다. 템플릿 특화 데이터는 `posts.template_data` JSONB에 담아 DB 마이그레이션 없이 TypeScript 정의 PR 1건으로 확장한다.

기본 프리셋 6종: 코딩테스트, 모각코, 책 완독, 듀오링고, 음악 감상, 자유.

### 6.6 실시간 동기화 (NFR-004)

`posts` 테이블을 `supabase_realtime` publication에 등록하고, 클라이언트 훅(`useRealtimePosts`)이 `supabase.channel('posts-channel')`을 구독한다. `UPDATE`는 `current_members`/`status` 갱신, `INSERT`는 신규 LIVE 핑 재조회. 1초 이내 무새로고침 반영이 기준이다. 채널은 전역 1개만 열고, 구독이 끊겨도 서버 렌더 결과를 유지한다(화면을 비우지 않는다).

**페이로드에서 `chat_url`을 막는 것은 publication 컬럼 목록이 아니라 `anon`/`authenticated`의 컬럼 단위 SELECT 권한이다.** Realtime은 복제 슬롯을 `wal2json`으로 읽어 publication 컬럼 목록을 적용하지 않는다(2026-10-18 실측). 권한은 마이그레이션 `drizzle/0003_revoke_anon_chat_url.sql`에 있고, 공개 컬럼 8개는 publication 목록과 같게 유지한다. 둘 중 하나만 고치면 막히지 않는다 — 근거와 검증 절차는 `docs/trd.md` §5가 SSOT다.

---

## 7. 도메인 불변식

새로 만들지 말고 아래 값을 그대로 쓴다. 서버 측 Zod 검증이 최종 방어선이며, 프론트 검증은 보조다.

### 7.1 입력 제약

| 필드 | 제약 |
| :--- | :--- |
| `title` | 최대 40자 (필수) |
| `description` | 최대 300자 (선택) |
| `tags` | 최대 3개 (필수) |
| `max_members` | 2~10, 기본 10. 리더 포함이므로 개설 시 `current_members = 1`. LIVE는 `null` |
| `chat_url` | `https://open.kakao.com/`, `https://discord.gg/`, `https://discord.com/invite/` 정규식 화이트리스트만 허용 (NFR-002). **진행 방식에 따라 조건부 필수:** 온라인 요소가 있는 모집(`ONLINE`·`HYBRID`)은 필수, 오프라인 전용(`OFFLINE_GS`·`OFFLINE_SEOUL`)은 선택. 미입력 시 `null`. LIVE도 `null`. 조건부 강제는 `createPostRequestSchema`의 `superRefine`이 맡는다 |
| `reference_url` | `https://` 검증만 (선택, 전체 공개) |
| LIVE `text` | 최대 50자 |
| LIVE `duration` | 30분 / 1시간 / 2시간 / 3시간 중 택1 (API 필드는 `durationMinutes`: `30`/`60`/`120`/`180`) |

### 7.2 정책 규칙

- **정규 스터디 `end_date` 자동 산출:** 1~14일에 개설하면 당월 말일, 15일~말일에 개설하면 익월 말일. 리더가 직접 지정하지 않는다. 단기 파티만 Datepicker로 직접 지정한다.
- **LIVE 핑 1일 1회:** KST 자정(00:00) 기준으로 유저당 하루 1건. 초과 시 400.
- **명예의 전당과 Post-mortem은 정규 스터디(`STUDY`) 전용**이다. 단기 파티는 아카이빙 대상이 아니다.
- **완주 판정 진입 조건:** 정규 스터디 전용. 사이클 종료월 15일부터 익월 10일(Grace Period)까지 리더에게 활성화. 단기 파티는 판정 대상이 아니다.
- **Grace Period:** 정규 스터디 사이클 종료 후 익월 10일까지 판정이 없으면 시스템이 자동으로 목표 미달성 처리하여 Post-mortem으로 이관한다. 리더/완주자 카운트는 가산하지 않는다 (FR-018, Cron).
- **증빙 URL은 선택이다.** `proof_url` 없이도 완주 등록이 되어야 한다.
- **카운트 가산:** 완주 판정 성공 시 리더 `leader_count + 1`, 완주 판정된 멤버 `completed_count + 1`을 단일 트랜잭션에서 원자적으로 처리한다.
- **Rate Limit (NFR-005, Phase 4):** 게시글·LIVE 핑 생성 유저당 1분 5회, 참여 유저당 1초 2회. 초과 시 429.
- **`avatar_url`을 수집·저장하지 않는다.** 외부 프로필 이미지 대신 `login` 앞 2자리 이니셜 뱃지를 쓴다. 영문은 대문자로 올리고 숫자·하이픈은 그대로 쓴다(`42-foo` → `42`).
- **유저 식별자는 3개다.** `github_id`는 불변 매칭 키(`NOT NULL`), `login`은 화면에 표시하는 GitHub 핸들(`NOT NULL`, 변경 가능), `intra_id`는 42 추가 인증 전까지 `null`이다. 랭킹 타이브레이커와 CLI 출력은 `login`을 쓴다.
- **`campus`는 nullable이다.** GitHub 인증만 한 유저는 `null`이다. 캠퍼스를 참조하는 UI는 `null` 분기를 반드시 둔다. LIVE 핑의 `location_type` 파생은 `null`일 때 `OFFLINE_ETC`로 기록하며, **등록을 차단하지 않는다**.
- **캠퍼스로 피드를 분리하거나 필터링하지 않는다.** GS/SEOUL은 뱃지 표기용일 뿐이고, 모든 글은 단일 통합 피드에 올라간다. 캠퍼스 필터 UI를 만들지 않는다.

---

## 8. API 및 에러 규약

엔드포인트 전체 목록은 `docs/trd.md` §4를 따른다. 모든 Route Handler는 `AppError`를 던지고 공통 핸들러가 HTTP로 매핑한다.

| AppError 코드 | HTTP | 쓰임 |
| :--- | :--- | :--- |
| `BAD_REQUEST` | 400 | Zod 검증 실패, 상태 머신 위반, LIVE 1일 1회 초과 |
| `CLOSED` | 400 | 모집이 마감된 글에 참여 시도 |
| `FULL` | 400 | 정원 초과 |
| `FORBIDDEN` | 403 | 리더/작성자 본인이 아닌 유저의 수정·취소·판정 시도 |
| `NOT_FOUND` | 404 | 게시글 없음 |
| `RATE_LIMITED` | 429 | Rate Limit 초과 |

인가는 이중으로 건다: Supabase RLS(direct 쿼리 방어)와 Route Handler의 `session.user.id === post.leader_id` 검증(FR-017).

---

## 9. 테스트

- **러너:** Vitest. **DB:** Docker 없이 `.env.local`의 `DATABASE_URL`로 실제 Supabase PostgreSQL에 붙어 `FOR UPDATE` 락과 행 수준 정합성을 검증한다.
- 테스트 간 격리는 트랜잭션 롤백으로 한다. 공용 인스턴스이므로 테이블을 TRUNCATE 하지 않는다.
- 핵심 도메인 로직(참여 동시성, 상태 머신 전이, 완주 판정, 권한 제어) 커버리지 90% 이상 (NFR-006).
- 테스트 케이스는 `requirement.md` §3의 ID를 `describe`/`it` 제목에 그대로 쓴다 (`TC-JOIN-02`, `TC-RACE-01` 등).
- 구현 전 테스트를 먼저 작성한다(Red → Green → Refactor).

---

## 10. 디자인 & UI

**금지·강제 규칙 전문은 `.claude/rules/anti-ai-slop.md`가 SSOT다.** 이미지·HTML·SVG·컴포넌트를 만들기 전에 그 파일을 읽는다. 아래는 이 프로젝트에만 해당하는 결정 사항이다.

### 디자인 토큰

| 항목 | 값 |
| :--- | :--- |
| 배경 | `#EDEFE0` |
| 텍스트 / 경계선 | `#18181b` |
| 포인트(액센트 1색) | `#5FB63A` |
| 보조 텍스트 | `#71717a` |
| 테두리 | `2.5px solid #18181b` |
| 그림자 | 하드 드롭 섀도우 `3~4px`, 색 `#18181b`, **blur 0** |

### 폰트

- 타이틀·로고: **Galmuri11**. 42 클러스터의 터미널·레트로 게임 정서를 그대로 쓰기 위한 한글 지원 픽셀 폰트다.
- 본문: **Pretendard**. 한글 본문 가독성과 숫자 정렬이 필요해 선택했다.
- 현재 `src/app/layout.tsx`는 기본 Geist 폰트를 쓰고 있다. UI 작업 시 위 두 폰트로 교체한다.

### 규칙 해석 (충돌 지점 명시)

- **하드 섀도우는 허용된 예외다.** anti-ai-slop의 그림자 금지는 *색 들어간 그림자*와 *`blur ≥ 20px`*를 겨냥한다. 여기 쓰는 섀도우는 무채색 `#18181b`에 blur 0이므로 위반이 아니다. 네오브루탈리즘 톤은 의도된 선택이니 "그림자 규칙 위반"으로 보고 제거하지 않는다.
- **이모지:** 🏆명예의 전당, 🪦Post-mortem, 🐸픽셀 개구리는 제품 고유 기호이므로 유지한다. 그 외 불릿·장식·강조용 이모지는 금지다.
- **`:active`의 `transform: translate`는 허용된 예외다.** anti-ai-slop이 금지하는 것은 *hover 시* `transform`이다. 누름 상태의 이동은 "클릭이 먹었다"는 피드백을 전달하는 기능적 상태이고, 하드 섀도우와 한 쌍으로 동작한다(그림자 offset만큼 이동하고 `box-shadow: none`). 이동 거리는 `box-shadow` offset과 반드시 같게 둔다. `:hover`에 `transform`을 쓰는 것은 여전히 금지다. 값과 구현은 `docs/designs/interactions.md`를 따른다.
- **상태 표시 `pulse` 키프레임은 허용된 예외다.** anti-ai-slop의 모션 금지는 *장식* 모션을 겨냥한다. LIVE 핑의 활성 표시 점은 "이 핑이 지금 유효하다"는 상태 정보를 전달하므로 장식이 아니다. 허용 조건은 아래 4개를 **전부** 충족할 때로 한정한다.
  - 대상은 지름 10px 이하의 상태 인디케이터 점뿐이다. 텍스트·카드·버튼·레이아웃에는 쓰지 않는다.
  - 변경 속성은 `opacity`와 `transform: scale`만. 색·위치·크기 외 속성은 건드리지 않는다.
  - 주기는 1.4s 이하, `infinite` 허용. (현재 디자인 원본: `animation:pulse 1.4s infinite`)
  - 그 점이 사라지면 상태를 알 수 없어야 한다. 점을 지워도 정보가 그대로면 장식이므로 제거한다.
- 그라데이션, 글로우, 컬러 그림자, `backdrop-filter: blur`, hover 시 `transform`, 로드 시 fade/stagger, `shimmer`·`float`·`glow` 키프레임, 배경 장식(워터마크·그리드·광선)은 예외 없이 금지다. 위 `pulse` 예외는 상태 인디케이터에만 적용되고 다른 모션으로 확장되지 않는다.

---

## 11. 작성 규약

- 문서·주석·UI 카피는 한국어로 쓴다. 식별자와 코드는 영어로 쓴다.
- 커밋은 Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)를 따르고 제목은 한국어로 쓴다.
- `main`에 직접 커밋하지 않는다. Phase/기능 단위 브랜치에서 PR을 올린다.
- PR 본문 생성 시 항상 `.github/pull_request_template.md` 구조(📌 Summary, 🛠️ Key Changes, 🧪 Verification, 🔗 Related Specs)를 따른다.
