<!--
Sync Impact Report
==================
Version change: (template, unratified) → 1.0.0
Rationale: Initial ratification. First time placeholders are replaced with concrete
governance derived from CLAUDE.md, docs/requirement.md, docs/trd.md, docs/prd.md, and
.claude/rules/*. MAJOR bump to 1.0.0 establishes the baseline.

Principles defined:
  I.   사양 주도 · 테스트 우선 (NON-NEGOTIABLE)
  II.  문서 SSOT 우선
  III. 도메인 불변식 고정
  IV.  동시성 · 상태 머신 무결성
  V.   보안 경계 · 링크 가시성

Added sections:
  - 기술 제약 및 디자인 규율 (Section 2)
  - 개발 워크플로우 (Section 3)
  - Governance

Removed sections: none (all template placeholders filled).

Templates / dependents reviewed:
  ✅ .specify/templates/plan-template.md  — Constitution Check gate aligns with Principles I–V
  ✅ .specify/templates/spec-template.md  — no conflict
  ✅ .specify/templates/tasks-template.md — no conflict
  ✅ CLAUDE.md                            — source of all principles; consistent

Deferred TODOs:
  - RATIFICATION_DATE set to 2026-10-18 (first fill date). No earlier adoption date exists
    in repo history; revise if the team records an earlier formal adoption.

NOTE: This HTML comment is scratch material for amendment review. Remove before committing.
-->

# 모두의 42 (Modu-42) Constitution

## Core Principles

### I. 사양 주도 · 테스트 우선 (NON-NEGOTIABLE)

모든 기능·Phase 구현은 사양 주도 개발(SDD) 4단계 루프를 순서대로 거친다:
`speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`.
사용자가 "speckit"을 언급하지 않아도("Phase 1 구현해줘") 직결 구현을 하지 않고
`specs/<phase>/`에 산출물을 먼저 남긴다.

핵심 도메인 로직(참여 동시성, 상태 머신 전이, 완주 판정, 권한 제어)은 TDD를 강제한다:
테스트 작성(Red) → 실패 확인 → 구현(Green) → 리팩터(Refactor). 테스트 커버리지는
90% 이상이어야 하며(NFR-006), `describe`/`it` 제목에 `docs/requirement.md` §3의
인수 테스트 ID(`TC-JOIN-02`, `TC-RACE-01` 등)를 그대로 쓴다.

근거: 플랫폼의 정합성 보장은 사양과 테스트가 코드보다 먼저 존재할 때만 성립한다.
사양 없는 코드와 테스트 없는 도메인 로직은 머지할 수 없다.

### II. 문서 SSOT 우선

각 문서는 고유한 최종 권위 영역을 갖는다: `requirement.md`(Phase 범위·FR/NFR ID·인수
테스트) · `trd.md`(DB 스키마·API 명세·트랜잭션·CI/CD) · `prd.md`(UX·화면 카피·엣지
케이스) · `plan.md`(배경·철학). 전체 범위 기준은 항상 `requirement.md`를 최우선 참조한다.

문서 간 충돌 시 우선순위는 `requirement.md` > `trd.md` > `prd.md` > `plan.md`다.
충돌을 발견하면 임의로 한쪽 코드를 따르지 말고 **문서를 먼저 수정한다.** DB 스키마를
바꿀 때는 `src/db/schema.ts`와 `docs/trd.md` §3.2를 같은 PR에서 함께 고친다.

근거: 진실이 여러 곳에 흩어지면 무엇이 맞는지 다투게 된다. 단일 진실 공급원을 고정하고
불일치를 코드가 아니라 문서에서 해소한다.

### III. 도메인 불변식 고정

입력 제약과 정책 규칙(CLAUDE.md §7)은 새로 만들지 않고 정의된 값을 그대로 쓴다:
`title` 40자 · `description` 300자 · `tags` 최대 3개 · `max_members` 2–10(LIVE는 null) ·
LIVE `text` 50자 · LIVE 핑 1일 1회(KST 자정 기준) · `chat_url` URL 화이트리스트 ·
`end_date` 자동 산출(리더 직접 지정 금지, 단기 파티 제외) · 증빙 URL 선택 ·
명예의 전당/Post-mortem은 정규 스터디(`STUDY`) 전용 · 캠퍼스 필터 미구현 ·
`avatar_url` 미수집(이니셜 뱃지 사용).

서버 측 Zod 검증이 최종 방어선이며 프론트 검증은 보조다. 미사용 스키마 값
(`participant_status`의 `LEFT`/`REMOVED` 등)은 구현하지 않는다.

근거: 불변식이 임의로 늘거나 바뀌면 테스트·UI·DB가 서로 어긋난다. 규칙은 한 곳에서
정의하고 모든 레이어가 그 값을 참조한다.

### IV. 동시성 · 상태 머신 무결성

원클릭 참여는 Drizzle `db.transaction()` 안에서 `posts` 행을 `.for('update')`로 잠근 뒤
중복 확인 → 정원 검증 → `participants` 기록 → 카운트 증가 순으로 처리한다(NFR-001).
이미 `JOINED`인 유저는 카운트를 올리지 않고 기존 `chat_url`을 반환한다(멱등성).
완주 판정의 카운트 가산(리더 `leader_count`, 멤버 `completed_count`)도 단일 트랜잭션에서
원자적으로 처리한다.

상태 전이는 정의된 머신(NFR-003)만 따른다: `RECRUITING ↔ CLOSED`,
`→ COMPLETED`(최종), `→ CANCELLED`(최종). `COMPLETED`/`CANCELLED`는 역전 불가이며
참여·수정·취소 시도는 400으로 차단한다. LIVE 핑 만료는 상태 전이가 아니라 조회
쿼리의 Lazy Filter(`status = 'RECRUITING' AND expires_at > now()`)로 처리하고 cron을 두지 않는다.
Post-mortem 등록은 상태 전이가 아니다.

근거: 정원과 상태는 돈처럼 다뤄야 할 공유 자원이다. 락과 트랜잭션 없이는 경합에서
초과 참여·이중 가산·역전이 발생한다.

### V. 보안 경계 · 링크 가시성

`chat_url`은 참여자에게만 공개한다. `GET /api/posts/:id` 응답에서 비참여자에게는
`chat_url`을 필드에서 제외(마스킹)한다. 플랫폼 종류(`chat_platform`)와 `reference_url`은
전체 공개다.

Mock 인증 엔드포인트(`/api/mock-auth`)와 `MockAuthModal`은 `NODE_ENV === 'development'`
에서만 동작하며 서버·클라이언트 양쪽에서 차단한다 — 상용 노출은 인증 우회다.
인가는 이중으로 건다: Supabase RLS와 Route Handler의
`session.user.id === post.leader_id` 검증(FR-017). `chat_url`은 정규식 화이트리스트
(`open.kakao.com`, `discord.gg`, `discord.com/invite`)만 허용한다(NFR-002).
외부 프로필 이미지(`avatar_url`)는 수집·저장하지 않는다.

근거: 링크 가시성과 인증 경계는 사후에 덧붙일 수 없다. 기본값은 비공개이고, 공개는
명시적 권한에서만 나온다.

## 기술 제약 및 디자인 규율

**스택:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Drizzle ORM +
Supabase (PostgreSQL & Realtime) + Vercel. **패키지 매니저는 pnpm이다** — `npm`/`npx`를
쓰지 않는다. 디렉터리 규약은 CLAUDE.md §3을 따른다.

**디자인:** `.claude/rules/anti-ai-slop.md`가 시각 생성물의 SSOT다. 그라데이션,
글로우·컬러 그림자, `blur ≥ 20px`, `backdrop-filter: blur`, hover `transform`,
장식 모션, 배경 장식은 금지다. 디자인 토큰(배경 `#EDEFE0`, 텍스트/경계선 `#18181b`,
액센트 `#5FB63A`, 테두리 `2.5px`, 하드 드롭 섀도우 blur 0)과 폰트(타이틀 Galmuri11,
본문 Pretendard)를 쓴다. 무채색 blur-0 하드 섀도우와 제품 고유 이모지
(🏆 명예의 전당, 🪦 Post-mortem, 🐸 픽셀 개구리)는 허용된 예외다.

## 개발 워크플로우

- `main`에 직접 커밋하지 않는다. Phase/기능 단위 브랜치에서 PR을 올린다.
- 커밋은 Conventional Commits(`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)를
  따르고 제목은 한국어로 쓴다.
- 문서·주석·UI 카피는 한국어로, 식별자와 코드는 영어로 쓴다.
- CI(GitHub Actions)는 PR에서 `lint` → `typecheck` → `test` → `drizzle-kit check`를
  실행한다. main push 시 `drizzle-kit migrate` 후 Vercel 배포한다.
- API 에러는 모든 Route Handler가 `AppError`를 던지고 공통 핸들러가 HTTP로 매핑한다
  (CLAUDE.md §8 코드 표).
- 테스트 DB는 `.env.local`의 `DATABASE_URL`로 실제 Supabase에 붙고, 격리는 트랜잭션
  롤백으로 한다. 공용 인스턴스이므로 TRUNCATE 하지 않는다.

## Governance

본 Constitution은 다른 모든 개발 관행에 우선한다. 모든 PR과 리뷰는 위 원칙의 준수를
검증해야 한다. 원칙과 충돌하는 구현은 머지할 수 없으며, 복잡도를 추가할 때는 그 정당성을
PR 설명에 밝힌다.

개정 절차: 변경은 PR로 제안하고, 영향 받는 문서(`docs/`, `.claude/rules/`, 본 파일)를
같은 PR에서 함께 갱신한다. 버전은 유의적 버전 규칙을 따른다 — MAJOR: 원칙 제거·역호환
불가 재정의, MINOR: 원칙/섹션 추가·실질적 확장, PATCH: 문구 정리·오타 수정.

런타임 개발 지침은 `CLAUDE.md`를, SDD 세부는 `docs/speckit-guide.md`와
`.claude/rules/speckit.md`를 참조한다. 본 Constitution과 하위 문서가 충돌하면 본
Constitution의 원칙이 우선하되, 충돌을 발견하면 임의 해석 대신 문서를 먼저 정정한다.

**Version**: 1.0.0 | **Ratified**: 2026-10-18 | **Last Amended**: 2026-10-18
