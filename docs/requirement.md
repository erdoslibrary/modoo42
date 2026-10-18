# [요구사항 정의서] 모두의 42 (Modu-42)

* **문서 버전:** v2.1 (Phased Milestone & Production-Ready)
* **목표:** 서비스 운영 수준의 완성도, SDD(Spec-Driven Development) 및 TDD 기반 단위/통합 테스트·QA 검증 기준서
* **개발 방법론:** Spec-Driven Development (`speckit`) + Vitest 기반 TDD
* **기술 스택:** Next.js (App Router) + TypeScript + Drizzle ORM + Supabase (PostgreSQL & Realtime) + Vercel
* **참조 문서:** [speckit-guide.md](./speckit-guide.md), [plan.md](./plan.md), [prd.md](./prd.md), [trd.md](./trd.md)
* **디자인 원본:** [Dashboard.html](./designs/Dashboard.html), [create_study.html](./designs/create_study.html), [about_study.html](./designs/about_study.html), [myprofile.html](./designs/myprofile.html), [complete.html](./designs/complete.html), [PixelFrog.html](./designs/PixelFrog.html)
* **디자인 분기 파일:** [Dashboard_postmortem.html](./designs/Dashboard_postmortem.html), [create_study_party.html](./designs/create_study_party.html), [create_study_live.html](./designs/create_study_live.html), [complete_postmortem.html](./designs/complete_postmortem.html) — 위 원본에서 조건부로 숨겨지는 분기를 따로 렌더한 파일이다.
* **상호작용 스펙:** [interactions.md](./designs/interactions.md) — 정적 렌더에서 제거된 호버·누름 상태 값과 Phase 3 CSS 구현 지침.

---

## 1. 시스템 범위 (Scope)

### 1.1 In-Scope (점진적 5단계 마일스톤)
* **Phase 0 (기반 인프라 & Mock 인증):**
  - Drizzle ORM, Postgres, Vitest 환경 설정 및 DB 스키마 마이그레이션
  - 로컬 개발용 Mock User 세션 헬퍼 및 플로팅 Mock 모달 (`/api/mock-auth`, `MockAuthModal`)
* **Phase 1 (핵심 모집 & 참여 루프 — TDD 대상):** 
  - 스터디/단기 파티 CRUD (기본 폼 필드 및 템플릿 버튼 UI)
  - `open.kakao.com`, `discord.gg` URL 정규식 화이트리스트 검증 (`NFR-002`)
  - Drizzle 트랜잭션 기반 원클릭 참여 및 `SELECT FOR UPDATE` 급 동시성 방어 (`NFR-001`)
  - 정원 자동 마감 (`status = 'CLOSED'`) 및 리더 수동 마감 토글
  - 스터디 개설 취소 (`status = 'CANCELLED'`) 및 리더 게시글 수정
  - 상태 머신 불변성 검증 (`NFR-003`)
* **Phase 2 (완주 라이프사이클 & 서브 도메인):**
  - 모듈형 템플릿 프리셋 고도화 (`template_data` JSONB 플러그인 확장)
  - 리더의 완주/미완주 벌크 판정 및 리더/멤버 카운트 원자적 가산
  - Post-mortem (실패 회고) 수동 등록
  - 명예의 전당 아카이빙 및 성실 랭킹 집계
  - 지금 클러스터 (LIVE 핑) 등록, 1일 1회 제한, 작성자 조기 완료
  - 터미널 CLI 조회 (`GET /api/list`)
* **Phase 3 (UI 결합 & 실시간 동기화):**
  - 대시보드, 스터디 개설, 상세보기 모달, 유저 프로필 화면 Next.js React 컴포넌트 포팅
  - Mock Auth 연동 및 대시보드 탭(정규 스터디, 단기 파티, LIVE 핑, 명예의 전당) 렌더링
  - 유저 프로필 스터디 이력 표출 (`FR-019`. 개구리 도감·배지는 §1.3 보류)
  - Supabase Realtime 기반 참여자 수/LIVE 핑 1초 이내 실시간 동기화 (`NFR-004`)
* **Phase 4 (인증/인가 & 보안·운영 자동화):**
  - 42 Intra OAuth 2.0 PKCE 인증 및 30일 세션 쿠키 연동 (Zero-Click 재접속, 랜딩 게이트)
  - 유저 캠퍼스(GS/SEOUL) 파싱 및 프로필 자동 매핑
  - Supabase RLS 및 Route Handler 서버 권한 이중 방어
  - API Rate Limiting (`NFR-005`: 도배 및 스팸 방지)
  - 미판정 정규 스터디 익월 10일 도과 시 자동 Post-mortem 이관 배치(Cron)
  - 전용 테스트 DB 확보 및 `pnpm test` CI 편입 (`NFR-006`: Phase 3까지는 로컬 게이트로 운용)

### 1.2 Out-of-Scope (정책적 배제)
* 자체 실시간 채팅 (오픈채팅/디스코드 외부 라우팅 유지)
* 복잡한 가입 승인 결재 플로우 (선 라우팅 후 리더 관리 방식)
* 인앱 결제/예치금 시스템
* 자진 참여 취소(Leave) (외부 링크 유출 방지 및 리더의 예측 가능성 확보를 위한 확정 참여 원칙)
* 허수 참여자 강퇴(Kick) (해커톤 스코프 아웃, 완주 판정 시 미완주 처리로 대체)

### 1.3 보류 (향후 고도화, Phase 5+ 범위 미확정)

Out-of-Scope와 달리 **배제가 아니라 유보**다. 디자인 원본은 이미 있으나 수여 규칙·저장 스키마가 정의되지 않아 범위를 확정하지 않는다. 착수 시 `FR-020` 이후 ID를 신설하고 `trd.md` §3.2에 신규 테이블을 함께 정의한다.

* **개구리 도감 / 무지개 개구리 도감** (`docs/designs/myprofile.html`, `docs/designs/PixelFrog.html`) — 수집 단위, 획득 조건, 저장 스키마 모두 미정.
* **획득 배지** (`docs/designs/myprofile.html`) — 배지 종류, 수여 트리거, 중복 수여 정책 미정.

프로필 화면 자체와 스터디 이력은 보류가 아니다. `FR-019`로 Phase 3에 포함한다.

---

## 2. 기능 요구사항 (Functional Requirements)

### Phase 0: 기반 인프라 & Mock 인증
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-000** | 로컬 Mock 인증 세션 & UI 모달 | • 개발 환경(`NODE_ENV === 'development'`)에서 동작하는 Mock User 세션 주입 헬퍼 및 화면 우하단 플로팅 `[🛠 Mock Auth]` 모달 제공.<br>• 3종 페르소나(`gs_leader`, `gs_member`, `seoul_member`) 및 로그아웃(`guest`)을 클릭 1번에 쿠키 세팅하고 즉시 페이지 갱신.<br>• 상용 배포 환경에서는 UI 및 Mock 엔드포인트 자동 비활성화. | 로컬에서 페르소나 전환 시 쿠키 반영 및 세션 유저 정보 즉시 교체 확인. 상용 빌드 시 비노출. |

### Phase 1: 코어 모집 & 참여 루프 (Core Recruitment & Join)
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-001** | 스터디/단기 파티 개설 | • 필수 필드: 유형(`type`), 제목(`title`, ≤40자), 정원(`max_members`, 2~10명, 기본 10명), 외부 링크(`chat_url`), 장소(`place`: 온/오프라인 상세 장소 직접 입력).<br>• 정규: 종료일(`end_date`)은 개설 시점에 따라 시스템이 당월 말일/익월 말일 자동 고정 산출 / 파티: 마감일(`end_date`) 및 상세 장소 직접 지정.<br>• 외부 링크(`chat_url`)는 `https://open.kakao.com/` 및 `https://discord.gg/`(또는 `discord.com/invite/`) 정규식 화이트리스트 검증(Zod).<br>• **개설 시 리더 자동 참여**: 글 생성 시 `current_members: 1`로 초기화되며, `participants` 테이블에 리더 레코드(`status: 'JOINED'`)가 자동 삽입됨. | 유효하지 않은 입력(글자수 초과, 인원 범위 이탈, 허용되지 않은 URL 등) 시 400 Bad Request 및 에러 반환. |
| **FR-002** | 템플릿 버튼 UI (기본 타입 선택) | • 개설 화면에 템플릿 버튼(코딩테스트, 모각코, 책 완독, 듀오링고, 음악 감상, 자유) 배치.<br>• 현재 단계에서는 버튼 클릭 시 기본 제목/설명 플레이스홀더 폼 연동만 수행 (세부 JSONB 스키마 주입은 Phase 2에서 고도화). | 템플릿 버튼 클릭 시 기본 스터디 형태 선택 및 입력 폼 활성화 확인. |
| **FR-003** | 원클릭 참여 (Join) 및 동시성 락 | • Drizzle ORM `db.transaction()` 및 Postgres 행 레벨 락(`FOR UPDATE`)으로 `current_members + 1` 및 `participants` 생성을 원자적 수행.<br>• 이미 참여한 유저는 카운트 증가 없이 기존 `chat_url` 반환 (멱등성).<br>• 성공 시 새 탭으로 `chat_url` 오픈. | 동시 병렬 요청 시 정원(`max_members`)을 1명도 초과하지 않음. 중복 참여 시 카운트 미증가. |
| **FR-004** | 정원 자동 마감 및 리더 수동 마감 | • `current_members == max_members` 도달 시 `status = 'CLOSED'` 자동 전이.<br>• 리더는 모집 중 상태에서 수동으로 마감/재모집 토글 가능. | 마감 상태 게시글은 `[참여하기]` 비활성화. |
| **FR-005** | 스터디 중도 취소 (Cancel) | • 시작 전 리더가 스터디 개설 취소 가능.<br>• `status = 'CANCELLED'` 전이, 취소 사유 입력. 참여자에게 취소 상태 표출. | 취소된 스터디는 신규 참여/수정 일체 불가. |
| **FR-006** | 리더 게시글 수정 | • 모집 중(`RECRUITING`) 상태일 때 리더는 제목, 설명, 오픈채팅 링크, 장소(`place`) 정보 수정 가능. | 리더 본인 외 수정 시도 시 403 Forbidden 차단. 수정 즉시 게시글 정보 업데이트 확인. |

### Phase 2: 완주 라이프사이클 & 서브 도메인
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-007** | 모듈형 템플릿 고도화 & JSONB 특화 데이터 | • 6개 프리셋 선택 시 전용 데이터(`template_data` JSONB) 주입 및 Zod 검증 지원.<br>• 신규 스터디 템플릿을 코드 레벨(PR)로 즉시 확장 가능한 플러그인 아키텍처 제공. | 프리셋별 추가 필드 검증 통과 및 플러그인 템플릿 데이터 정상 저장 확인. |
| **FR-008** | 완주 벌크 판정 | • 진입 조건: 정규 스터디(`STUDY`) 전용. 사이클 종료월 15일부터 익월 10일(Grace Period)까지 리더에게 활성화. 단기 파티는 판정 없이 `CLOSED`로 단순 종료하며 카운트를 가산하지 않는다.<br>• **팀원 완주 판정(필수)**: 리더가 참여자 체크박스로 `COMPLETED`/`INCOMPLETE` 벌크 판정.<br>• **증빙 URL(`proof_url`) 선택**: 결과물 링크는 선택 입력 (없어도 완주 등록 가능).<br>• 판정 완료 시 리더 `leader_count + 1`, 완주자 `completed_count + 1` 동시 가산. | 리더 및 완주자 카운트 원자적 가산 확인. 증빙 URL 없어도 정상 완주 처리 확인. |
| **FR-009** | Post-mortem (실패 회고 수동 등록) | • 목표 미달성 시 리더가 실패 원인/회고(`postmortem_text`) 등록.<br>• 회고 등록 시 리더/완주자 카운트는 가산되지 않음. | 회고 내용 정상 저장 및 미달성 상태 아카이빙 표출 확인. |
| **FR-010** | 명예의 전당 & 성실 멤버 랭킹 | • 완주 완료(`COMPLETED`)된 스터디 카드 목록 표출 및 증빙 URL 외부 링크 연결.<br>• 누적 완주 횟수 내림차순 → 누적 리더 횟수 내림차순 → `intra_id` 오름차순 기준 상위 5명(골드/실버/브론즈) 산출. | 🏆명예의 전당 목록 정상 렌더링 및 랭커 1~5위 집계 쿼리 정합성 확인. |
| **FR-011** | 지금 클러스터 (LIVE 핑) 등록 및 조기 완료 | • 내용(`text`, ≤50자), 위치(`place`), 유효시간(`duration`: 30분/1시간/2시간/3시간) 설정.<br>• **1일 1회 제한**: 매일 KST 자정(00:00) 기준 1일 1회 생성 제한 (도배 방지).<br>• **작성자 조기 완료**: 동료를 찾았을 때 작성자가 `[완료]`를 누르면 `status = 'CLOSED'`로 전이되어 전광판에서 즉시 소멸.<br>• 만료 시간 도달 시 조회 쿼리에서 자동 제외(Lazy Filter: `status = 'RECRUITING' AND expiresAt > now()`). | 작성자 본인 조기 완료 시 목록 즉각 제거 및 1일 2회 이상 생성 시 400 차단 확인. |
| **FR-012** | CLI 터미널 엔드포인트 | • `GET /api/list` 호출 시 ANSI 포맷 텍스트 또는 정돈된 JSON 응답 제공. | `$ curl modoo42.com/api/list` 정상 출력 확인. |

### Phase 3: UI 결합 & 실시간 동기화
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-013** | 대시보드 목록 조회 & 뷰 포팅 | • `Dashboard.html`, `create_study.html`, `about_study.html`(상세보기 모달)을 Next.js React 컴포넌트로 포팅.<br>• 정규: 최신순/마감임박순 정렬 / 단기 파티: D-Day 순 정렬 / LIVE 핑: 활성 핑 전광판 표출.<br>• 상세보기 모달은 비참여자에게 `chat_url`을 노출하지 않는다 (`GET /api/posts/:id` 마스킹 응답 그대로 렌더링). | 세션 상태에 따른 대시보드 탭별 정렬/필터링 및 UI 렌더링 정상 확인. 비참여자 상세 모달에 외부 채팅 링크 미노출 확인. |
| **FR-014** | Supabase Realtime 실시간 동기화 | • Supabase Realtime 연동. LIVE 핑 등록 및 참여자 수 변동 시 클라이언트 자동 반영. | 새로고침 없이 대시보드 참여자 수 카운트 증가 및 LIVE 핑 즉시 표출 확인. |
| **FR-019** | 유저 프로필 화면 & 스터디 이력 | • `myprofile.html`을 Next.js React 컴포넌트로 포팅.<br>• 표출 항목: `intra_id`, 캠퍼스 뱃지, 누적 완주 횟수(`completed_count`), 누적 리더 횟수(`leader_count`), 참여 스터디 이력(완주·리더·진행 중).<br>• 이력은 기존 `users`/`posts`/`participants` 조회로 산출한다. **신규 테이블·컬럼을 추가하지 않는다.**<br>• `avatar_url`을 쓰지 않고 `intra_id` 앞 2자리 영문 대문자 이니셜 뱃지를 쓴다.<br>• **개구리 도감·획득 배지 섹션은 범위 밖이다** (§1.3 보류). | 완주/리더 카운트가 FR-008 가산 결과와 일치하고, 이력 목록이 실제 `participants` 레코드와 일치함을 확인. |

### Phase 4: 인증/인가 & 보안·운영 자동화
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-015** | 42 Intra OAuth & 세션 게이트 | • `commitplease` 스타일 서비스 소개 랜딩(`/login`) 표출.<br>• `[42 Intra로 로그인하기]` ➔ 42 API v2 토큰 교환 ➔ 30일 장기 세션 쿠키 발급 ➔ `/dashboard` 이동.<br>• 인증 유저 재접속 시 랜딩 건너뛰고 `/dashboard`로 0초 만에 자동 직행(Zero-Click).<br>• 미인증 상태로 대시보드 접근 시 `/login` 리다이렉트. | 30일 세션 유지 검증, 재접속 시 자동 직행 및 미로그인 상태 대시보드 접근 차단 검증. |
| **FR-016** | 캠퍼스 및 기수 파싱 | • 42 프로필의 `campus_users`에서 주 캠퍼스(`GS`/`SEOUL`) 파싱하여 유저 프로필 자동 매핑. | 경산/서울 뱃지 자동 부여 확인. |
| **FR-017** | RLS 및 서버 인가 이중화 | • Supabase RLS로 direct DB 쿼리 방어.<br>• Next.js Route Handler에서 `session.user.id == post.leader_id` 이중 검증. | 타인이 타인의 글 수정/삭제/완주 판정 시 403 Forbidden 차단. |
| **FR-018** | 미판정 스터디 자동 Post-mortem 이관 | • 정규 스터디 사이클 종료 후 익월 10일까지 판정 미완료 시 시스템이 자동으로 목표 미달성으로 분류하여 Post-mortem 목록 이관(리더/완주자 카운트 미가산). | Cron 트리거 시 기한 도과 미판정 스터디의 자동 Post-mortem 이관 확인. |

---

### 비기능 요구사항 (NFR)

| ID | 분류 | 세부 명세 | 대응 Phase | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-001** | 동시성 및 트랜잭션 격리 | • Drizzle ORM `db.transaction()`과 Postgres 행 레벨 락(`FOR UPDATE`)을 통해 참여 시 데이터 정합성 보장. | Phase 1 | 10개 병렬 Join 요청 테스트 시 정원 초과 0건 검증. |
| **NFR-002** | 외부 URL 무결성 | • `chat_url`은 `https://open.kakao.com/` 및 `https://discord.gg/` (또는 `discord.com/invite/`) 정규식 화이트리스트만 허용. | Phase 1 | 피싱/악성 URL 입력 시 서버 레벨 400 Bad Request 차단. |
| **NFR-003** | 상태 머신 불변성 | • `RECRUITING` ↔ `CLOSED` (정원 증감 시)<br>• `CLOSED` → `COMPLETED` / `CANCELLED` (최종 상태, 역전 불가). | Phase 1 | `COMPLETED` 상태 글에 참여/취소/수정 시 400 에러 차단. |
| **NFR-004** | 실시간 동기화 성능 | • Supabase Realtime Engine 연동. LIVE 핑 등록 및 참여자 수 변동 시 1초 이내 클라이언트 자동 반영. | Phase 3 | 별도 새로고침 없이 대시보드 카운트 1초 내 자동 증가 확인. |
| **NFR-005** | API Rate Limiting | • 게시글/LIVE 핑 생성: 유저당 1분 5회 제한.<br>• 참여: 유저당 1초 2회 제한. | Phase 4 | 한도 초과 시 429 Too Many Requests 반환. |
| **NFR-006** | 자동화 테스트 커버리지 | • 핵심 도메인 로직(Join, Cancel, Complete, Status Machine) Vitest 단위/통합 테스트 커버리지 90% 이상 유지.<br>• **CI 편입 범위:** CI(`.github/workflows/ci.yml`)는 `lint` → `typecheck` → `drizzle-kit check`만 실행한다. `pnpm test`는 공용 Supabase 인스턴스(트랜잭션 풀러, 포트 6543)에 접속하므로 CI 병렬 run이 커넥션을 재배치해 prepared statement를 무효화한다. 따라서 **PR 제출 전 로컬 필수 게이트**로 운용하고, 전용 테스트 DB 또는 Direct 접속(포트 5432) 확보 후 Phase 4에서 CI에 편입한다. | 전 Phase (CI 편입은 Phase 4) | PR 제출 전 로컬 `pnpm test` 전건 통과 필수. CI는 `lint`·`typecheck`·`drizzle-kit check` 자동 실행 및 통과 필수. |

---

## 3. TDD 인수 테스트 시나리오 (Acceptance Test Suites)

### Test Suite 1: 게시글 생성 및 유효성 (FR-001, NFR-002) — Phase 1 대상
* **TC-POST-01 (정상 생성):** 유효한 정규 스터디 데이터 입력 시 `id`와 상태 `RECRUITING` 생성.
* **TC-POST-02 (글자수 제한):** 제목 41자 이상 입력 시 400 Bad Request.
* **TC-POST-03 (인원 범위):** 정원 1명 또는 11명 입력 시 400 Bad Request (허용: 2~10명).
* **TC-POST-04 (URL 도메인 검증):** `https://google.com` 입력 시 400 차단, `https://open.kakao.com/o/xxx` 통과.

### Test Suite 2: 참여 및 동시성 제어 (FR-003, FR-004, NFR-001) — Phase 1 대상
* **TC-JOIN-01 (정상 참여):** 참여 시 `current_members + 1`, `participants` 레코드 생성, `chat_url` 반환.
* **TC-JOIN-02 (중복 참여 멱등성):** 동일 유저 재참여 시 중복 카운트 없이 기존 `chat_url` 반환.
* **TC-JOIN-03 (자동 마감):** 마지막 1자리 참여 시 `status = 'CLOSED'` 전이.
* **TC-RACE-01 (동시 참여 방어):** 정원 1자리 남았을 때 5명 동시 참여 요청 시 정확히 1명만 성공하고 4명은 정원 마감 에러 반환.

### Test Suite 3: 리더 권한 및 완주 라이프사이클 (FR-005, FR-008, FR-009, NFR-003) — Phase 1 & 2 대상
* **TC-LEADER-01 (권한 검증):** 비리더가 스터디 취소/완주 호출 시 403 Forbidden 차단.
* **TC-CANCEL-01 (스터디 취소):** 리더가 스터디 취소 시 `status = 'CANCELLED'` 전이 및 신규 액션 차단.
* **TC-COMPLETE-01 (완주 처리):** 리더가 참여자 체크박스 판정 완료 시(증빙 URL 유무 무관) `status = 'COMPLETED'`, 완주 멤버 `completed_count + 1`, 리더 `leader_count + 1` 동시 가산 확인.
* **TC-COMPLETE-02 (사후 수정 불가):** `COMPLETED` 완료 후 참여/취소/정보 수정 시도 시 400 차단.

### Test Suite 4: LIVE 핑 및 CLI (FR-011, FR-012) — Phase 2 대상
* **TC-LIVE-01 (정상 생성):** 내용 50자 이하·유효시간 4종 중 하나로 LIVE 핑 생성 시 `RECRUITING`, `expires_at = 생성 시각 + 유효시간`, `max_members`·`chat_url`은 `null`. 내용 51자 또는 허용 외 유효시간은 400.
* **TC-LIVE-02 (1일 1회 제한):** 같은 유저가 같은 KST 날짜(00:00 기준)에 두 번째 LIVE 핑 생성 시 400. 조기 완료·만료된 핑도 당일 1회로 센다. 동시 요청 시에도 1건만 생성.
* **TC-LIVE-03 (조기 완료):** 작성자가 `[완료]` 시 `status = 'CLOSED'` 전이 및 활성 목록에서 즉시 제외. 작성자 외 호출은 403.
* **TC-LIVE-04 (Lazy Filter 만료):** `expires_at`이 지난 `RECRUITING` 핑은 상태 전이 없이 조회 결과에서 제외.
* **TC-CLI-01 (CLI 조회):** 비로그인 `GET /api/list`가 200과 함께 모집 중 글·활성 LIVE 핑을 텍스트(기본) 또는 JSON으로 반환하고, `chat_url`을 포함하지 않는다.

---

## 4. 데이터베이스 및 스키마 명세

상세 데이터베이스 물리 ERD, Drizzle ORM 테이블 스키마 코드(`src/db/schema.ts`), 인덱스 및 외래키 제약조건은 기술 설계서의 단일 진실 공급원(SSOT)을 참조한다:

👉 **[기술 요구사항 명세서(TRD) - 3. 데이터베이스 스키마 및 ERD 명세](./trd.md#3-데이터베이스-스키마-및-erd-명세-drizzle-orm)**

---

## 5. 실행 계획 및 마일스톤 (speckit SDD 워크플로우)

### 5.1 speckit 기반 사양 주도 개발 (SDD) 원칙
본 프로젝트의 모든 마일스톤(Phase 0 ~ Phase 4) 및 신규 기능 구현은 **speckit(Spec Kit)** 기반의 사양 주도 개발(SDD) 절차를 필수로 준수한다.
**사용자가 프롬프트에서 `speckit`을 명시적으로 언급하지 않더라도(예: "Phase 0 구현해줘"), AI 에이전트는 직결 구현을 지양하고 아래 4단계 루프를 순서대로 자동 실행해야 한다:**

1. **`speckit-specify`**: `docs/requirement.md`의 해당 Phase 요구사항을 바탕으로 `specs/<phase>/spec.md` 명세서 작성
2. **`speckit-plan`**: Drizzle ORM, Next.js App Router, Vitest 등 기술 스택에 맞춘 `specs/<phase>/plan.md` 아키텍처 및 구현 계획 수립
3. **`speckit-tasks`**: 의존성 순서의 실행 가능한 체크리스트 `specs/<phase>/tasks.md` 생성
4. **`speckit-implement`**: TDD(Red-Green-Refactor) 원칙에 따라 `tasks.md` 항목 순차 구현 및 테스트 검증

> 세부 명령어 체계 및 진행 가이드는 [speckit-guide.md](./speckit-guide.md)를 표준 지침으로 삼는다.

### 5.2 단계별 실행 마일스톤

1. **Phase 0: 기반 인프라 & Mock 인증 환경 구축**
   - `drizzle-orm`, `drizzle-kit`, `postgres`, `vitest` 설치 및 설정.
   - Drizzle 스키마 및 마이그레이션 생성 (`users`, `posts`, `participants`).
   - 로컬 Mock 세션 헬퍼 및 플로팅 Mock 모달 UI (`MockAuthModal.tsx`, `/api/mock-auth`) 구현.
2. **Phase 1: 핵심 모집 & 원클릭 참여 TDD 구현 (Core Domain)**
   - Test Suite 1, 2 테스트 코드 작성 (Red).
   - 스터디/단기 파티 개설 CRUD 및 외부 URL 화이트리스트 Zod 검증 구현.
   - Drizzle 트랜잭션 + Postgres 행 락(`FOR UPDATE`) 기반 원클릭 참여 및 정원 마감 구현 (Green).
   - 상태 머신 역전 방지 및 스터디 취소/게시글 수정 로직 검증 (Refactor).
3. **Phase 2: 완주 라이프사이클 & 서브 도메인 구현**
   - Test Suite 3 작성 및 리더의 팀원 완주 벌크 판정 / 카운트 원자적 가산 구현.
   - Post-mortem 수동 등록, 명예의 전당 & 성실 랭킹 집계 쿼리 구현.
   - 지금 클러스터 (LIVE 핑) 등록/조기완료 및 CLI (`/api/list`) 엔드포인트 구현.
   - 모듈형 템플릿 프리셋 고도화 (플러그인 아키텍처 및 `template_data` JSONB 스키마 주입).
4. **Phase 3: Supabase Realtime & UI 결합**
   - `Dashboard.html`, `create_study.html`, `about_study.html`(상세보기 모달), `myprofile.html`(프로필·스터디 이력) 화면을 Next.js React 컴포넌트로 포팅.
   - 대시보드 탭별 조회(정규, 파티, LIVE 핑, 명예의 전당) 및 Mock Auth 상태 결합.
   - Supabase Realtime 구독 훅 연결해 참여자 수 및 LIVE 핑 실시간 동기화.
5. **Phase 4: 42 OAuth 실연동 & RLS 보안·운영 자동화**
   - 42 Intra OAuth 2.0 PKCE 연동 및 30일 세션 쿠키 발급, 소개 랜딩(`/login`) 게이트 처리.
   - 주 캠퍼스(GS/SEOUL) 파싱 및 유저 프로필 자동 매핑.
   - Supabase RLS 정책 활성화 및 Route Handler 서버 권한 이중 방어.
   - API Rate Limiting 적용 및 미판정 스터디 자동 Post-mortem 이관 Cron 배치 연동.
   - 전용 테스트 DB(또는 Direct 접속 포트 5432) 확보 후 `pnpm test`를 CI 파이프라인에 편입 (`NFR-006`).
