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
  - 로컬 개발용 Mock User 세션 헬퍼 및 플로팅 Mock 모달 (`/api/mock-auth`, `MockAuthModal`) — 모달은 `FR-027`에서 개발자 콘솔에 흡수돼 삭제됨
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
  - 유저 식별 스키마 전환 (`FR-016`: `github_id`/`login` 신설, `campus` nullable, `location_type`에 `OFFLINE_ETC` 추가) — UI 포팅 선행
  - 대시보드, 스터디 개설, 상세보기 모달, 유저 프로필 화면 Next.js React 컴포넌트 포팅
  - Mock Auth 연동 및 대시보드 탭(정규 스터디, 단기 파티, LIVE 핑, 명예의 전당) 렌더링
  - 유저 프로필 스터디 이력 표출 (`FR-019`. 개구리 도감·배지는 §1.3 보류)
  - Supabase Realtime 기반 참여자 수/LIVE 핑 1초 이내 실시간 동기화 (`NFR-004`)
  - 단기 파티 행사 종료일 경과 시 조회 제외 및 참여 차단 (`FR-020`. 상태 전이·cron 없음)
  - 완주 판정·회고 등록 화면 포팅 (`FR-021`. `FR-013` 머지 후 별도 브랜치)
  - 디자인 원본 대비 포팅 정합성 복구 (`FR-026`. 보조 텍스트 색·버튼 픽셀 폰트·랭킹 메달. Phase 3.5보다 앞선다)
* **~~Phase 3.5 (발표용 UI 보강 & 데모 데이터)~~ — §1.3 보류로 이관 (2026-10-18).** 해커톤 마감까지 남은 시간이 Phase 4 인증 연동에 모두 필요하다고 판단해 범위에서 뺐다. `FR-023`·`FR-024`·`FR-025`와 단기 파티 2날짜 모델·정규 스터디 1~14일 개설 차단이 함께 내려갔다.
* **Phase 4 (인증/인가 & 보안·운영 자동화):**
  - GitHub OAuth 2.0 (Authorization Code + `state`) 인증 및 30일 세션 쿠키 연동 (Zero-Click 재접속, 랜딩 게이트, 비로그인 대시보드 접근 차단)
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

Out-of-Scope와 달리 **배제가 아니라 유보**다. 착수 시 `FR-020` 이후 ID를 신설하고, 신규 테이블이 필요하면 `trd.md` §3.2에 함께 정의한다.

* **42 Intra 추가 인증 및 캠퍼스 뱃지** — GitHub 로그인을 1차 인증으로 두고, 그 위에 42 Intra OAuth를 **선택적 2차 인증**으로 연결한다. 범위는 아래까지로 한정한다.
  * 42 인증 성공 시 `users.intra_id`·`users.campus`·`users.intra_verified_at`을 채운다. 컬럼 자체는 `FR-016`에서 nullable로 미리 만들어 둔다 (`trd.md` §3.2).
  * 프로필 화면과 게시글 카드·상세 모달에 `42경산` / `42서울` 뱃지를 표출한다. 디자인 원본은 `docs/designs/myprofile.html`, `docs/designs/about_study.html`.
  * **기수(`2기`) 표기는 범위 밖이다.** 디자인 원본에는 `42경산 · 2기`로 적혀 있으나 기수를 담을 컬럼이 없고 신설하지 않는다. 캠퍼스만 표출한다.
  * **42 인증 유저 전용 기능 게이팅은 범위 밖이다.** 뱃지는 표기일 뿐이고 LIVE 핑을 포함한 모든 기능은 GitHub 인증만으로 쓸 수 있다.
* **개구리 도감 / 무지개 개구리 도감** (`docs/designs/myprofile.html`, `docs/designs/PixelFrog.html`) — 수집 단위, 획득 조건, 저장 스키마 모두 미정.
* **획득 배지** (`docs/designs/myprofile.html`) — 배지 종류, 수여 트리거, 중복 수여 정책 미정.
* **대왕 개구리 소환 게이지** (`docs/designs/Dashboard.html` 상단 배너 우측) — 게이지가 약속하는 "황금 개구리 배지 지급"이 위 획득 배지 보류에 걸린다. 수여 규칙 없이 게이지만 그리면 지키지 못할 약속을 표시하게 되고, 수치를 고정하면 정보를 전달하지 않는 순수 장식이 되어 `.claude/rules/anti-ai-slop.md`에 걸린다. 배지 수여 규칙이 정해질 때 함께 착수한다. 같은 배너의 모집 사이클 알람은 보류가 아니다 (`FR-023`).

* **모집 사이클 알람 배너 (`FR-023`)** — 아래 §2 Phase 3.5 표에 명세가 남아 있으나 착수하지 않는다. 배너가 노출하는 "매월 15일~말일 모집" 규칙 자체가 함께 보류이므로(아래 항목), 규칙을 확정하기 전에 배너만 올리면 서버 동작과 어긋난다.
* **정규 스터디 모집 기간 제한 (`FR-001` 변경분)** — "모집은 매월 15일~말일뿐이고 `end_date`는 항상 익월 말일, KST 1~14일 개설은 400" 규칙은 보류다. **현행 유지**: `computeStudyEndDate`가 1~14일 개설은 당월 말일, 15일~말일 개설은 익월 말일로 산출하고 개설을 차단하지 않는다.
* **단기 파티 행사 기간 2날짜 모델 (`FR-001`·`FR-020` 변경분)** — `posts.start_date` 신설과 `end_date`의 의미 변경(마감일 → 행사 종료일)은 보류다. **현행 유지**: `end_date`는 마감일이고 D-Day·정렬·Lazy Filter가 모두 이 한 날짜를 본다. 유일하게 마이그레이션이 필요한 항목이었다.
* **랭킹 완주율 지표 (`FR-024`)** — 산출 공식은 §2 표에 확정돼 있으나 착수하지 않는다. 상세 모달 리더 통계 2칸(`리더 경험 N회`·`완주율 N%`)도 함께 보류다. 리더 통계는 상세 응답의 리더 타입(`PublicUser`)을 넓혀야 해서 응답 계약 변경을 부른다.
* **발표용 데모 데이터 시드 (`FR-025`)** — 2026-10-18에 한 번 만들었다가 폐기했다. `scripts/seed-demo.ts`·`pnpm seed:demo`·`tsx`가 모두 제거됐고 `demo:*` 행도 정리됐다. 다시 만들 때 재사용할 사실은 `next-steps.md` §3.5에 남겨 뒀다.

프로필 화면 자체와 스터디 이력은 보류가 아니다. `FR-019`로 Phase 3에 포함한다.

---

## 2. 기능 요구사항 (Functional Requirements)

### Phase 0: 기반 인프라 & Mock 인증
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-000** | 로컬 Mock 인증 세션 & UI 모달 | • 개발 환경(`NODE_ENV === 'development'`)에서 동작하는 Mock User 세션 주입 헬퍼 및 화면 우하단 플로팅 `[🛠 Mock Auth]` 모달 제공.<br>• 4종 페르소나(`gs_leader`, `gs_member`, `seoul_member`, `github_only`) 및 로그아웃(`guest`)을 클릭 1번에 쿠키 세팅하고 즉시 페이지 갱신. `github_only`는 42 추가 인증을 하지 않은 유저로 `campus`가 `null`이며, 캠퍼스 뱃지 미렌더와 `OFFLINE_ETC` 파생(`FR-016`)을 검증하는 수단이다.<br>• 상용 배포 환경에서는 UI 및 Mock 엔드포인트 자동 비활성화. | 로컬에서 페르소나 전환 시 쿠키 반영 및 세션 유저 정보 즉시 교체 확인. 상용 빌드 시 비노출. |

### Phase 1: 코어 모집 & 참여 루프 (Core Recruitment & Join)
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-001** | 스터디/단기 파티 개설 | • 필수 필드: 유형(`type`), 제목(`title`, ≤40자), 정원(`max_members`, 2~10명, 기본 10명), 장소(`place`: 온/오프라인 상세 장소 직접 입력).<br>• **외부 링크(`chat_url`)는 진행 방식에 따라 조건부 필수다.** 온라인 요소가 있는 모집(`ONLINE`·`HYBRID`)은 필수, 오프라인 전용(`OFFLINE_GS`·`OFFLINE_SEOUL`)은 선택이다. 오프라인 전용은 `chat_url` 없이도 개설된다.<br>• **정규 스터디 모집 기간은 매월 15일~말일이다** (2026-10-18 확정). 그 사이클은 **익월 1일에 시작해 익월 말일에 끝난다.** 종료일(`end_date`)은 항상 익월 말일로 시스템이 고정 산출하고 리더가 지정하지 않는다.<br>• **KST 1~14일의 정규 스터디 개설은 400(`BAD_REQUEST`)으로 거절한다.** 미리 열 필요가 없고, 모집 기간이 길어지면 스터디 유지에 방해가 된다. 이 검증은 시각 의존이라 Zod가 아니라 도메인 함수(`createPost`)가 맡는다.<br>• **모집 대기 기간(KST 1~14일)에는 `/create`의 정규 스터디 폼을 렌더하지 않는다.** 유형 전환 탭(`TypeSwitch`)의 정규 스터디 자리에 "다음 모집 15일 시작" 안내와 개시 D-Day만 표출한다. 채워도 거절될 폼을 입력시키지 않는다. 단기 파티·LIVE 핑 탭은 그 기간에도 정상 동작한다.<br>• **단기 파티는 행사 기간을 두 날짜로 지정한다** (2026-10-18 확정). 컨퍼런스 동행·단기 모임·짧은 스터디가 목적이므로 **당일치기(시작일 = 종료일), 1박 2일, 최장 14일**까지 고를 수 있어야 한다. `posts.start_date`를 신설하고 `end_date`의 의미를 **마감일에서 행사 종료일로 바꾼다.**<br>&nbsp;&nbsp;◦ 시작일: KST 오늘 이후이며 **오늘로부터 1개월 이내**다.<br>&nbsp;&nbsp;◦ 종료일: 시작일 이후이며 **총 기간이 14일을 넘지 않는다**(종료일 ≤ 시작일 + 13일). 당일치기는 시작일 = 종료일이다.<br>&nbsp;&nbsp;◦ 상세 장소는 직접 지정한다. 정규 스터디와 달리 개설 날짜 제한은 없다.<br>• **정원 미달은 파티의 소멸·마감 사유가 아니다.** 정원이 차지 않아도 글은 행사 종료일까지 모집 피드에 남고 참여를 받는다. 자동 마감은 정원 도달 시에만 일어나며(`FR-004`), 그 밖에는 리더의 수동 마감·취소뿐이다.<br>• 외부 링크(`chat_url`)는 입력 시 `https://open.kakao.com/` 및 `https://discord.gg/`(또는 `discord.com/invite/`) 정규식 화이트리스트 검증(Zod).<br>• **개설 시 리더 자동 참여**: 글 생성 시 `current_members: 1`로 초기화되며, `participants` 테이블에 리더 레코드(`status: 'JOINED'`)가 자동 삽입됨. | 유효하지 않은 입력(글자수 초과, 인원 범위 이탈, 허용되지 않은 URL 등) 시 400 Bad Request 및 에러 반환. 온라인·온/오프라인 병행에 `chat_url` 누락 시 400. 오프라인 전용은 `chat_url` 없이 201. |
| **FR-002** | 템플릿 버튼 UI (기본 타입 선택) | • 개설 화면에 템플릿 버튼(코딩테스트, 모각코, 책 완독, 듀오링고, 음악 감상, 자유) 배치.<br>• 현재 단계에서는 버튼 클릭 시 기본 제목/설명 플레이스홀더 폼 연동만 수행 (세부 JSONB 스키마 주입은 Phase 2에서 고도화). | 템플릿 버튼 클릭 시 기본 스터디 형태 선택 및 입력 폼 활성화 확인. |
| **FR-003** | 원클릭 참여 (Join) 및 동시성 락 | • Drizzle ORM `db.transaction()` 및 Postgres 행 레벨 락(`FOR UPDATE`)으로 `current_members + 1` 및 `participants` 생성을 원자적 수행.<br>• 이미 참여한 유저는 카운트 증가 없이 기존 `chat_url` 반환 (멱등성).<br>• 성공 시 새 탭으로 `chat_url` 오픈. `chat_url`이 없는 오프라인 전용 모집은 탭을 열지 않는다. | 동시 병렬 요청 시 정원(`max_members`)을 1명도 초과하지 않음. 중복 참여 시 카운트 미증가. |
| **FR-004** | 정원 자동 마감 및 리더 수동 마감 | • `current_members == max_members` 도달 시 `status = 'CLOSED'` 자동 전이.<br>• 리더는 모집 중 상태에서 수동으로 마감/재모집 토글 가능. | 마감 상태 게시글은 `[참여하기]` 비활성화. |
| **FR-005** | 스터디 중도 취소 (Cancel) | • 시작 전 리더가 스터디 개설 취소 가능.<br>• `status = 'CANCELLED'` 전이, 취소 사유 입력. 참여자에게 취소 상태 표출. | 취소된 스터디는 신규 참여/수정 일체 불가. |
| **FR-006** | 리더 게시글 수정 | • 모집 중(`RECRUITING`) 상태일 때 리더는 제목, 설명, 오픈채팅 링크, 장소(`place`) 정보 수정 가능. | 리더 본인 외 수정 시도 시 403 Forbidden 차단. 수정 즉시 게시글 정보 업데이트 확인. |

### Phase 2: 완주 라이프사이클 & 서브 도메인
| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-007** | 모듈형 템플릿 고도화 & JSONB 특화 데이터 | • 6개 프리셋 선택 시 전용 데이터(`template_data` JSONB) 주입 및 Zod 검증 지원.<br>• 신규 스터디 템플릿을 코드 레벨(PR)로 즉시 확장 가능한 플러그인 아키텍처 제공. | 프리셋별 추가 필드 검증 통과 및 플러그인 템플릿 데이터 정상 저장 확인. |
| **FR-008** | 완주 벌크 판정 | • 진입 조건: 정규 스터디(`STUDY`) 전용. 사이클 종료월 15일부터 익월 10일(Grace Period)까지 리더에게 활성화. 단기 파티는 판정 대상이 아니며 카운트를 가산하지 않는다. 행사 종료일 경과 처리는 `FR-020`의 Lazy Filter를 따른다.<br>• **팀원 완주 판정(필수)**: 리더가 참여자 체크박스로 `COMPLETED`/`INCOMPLETE` 벌크 판정.<br>• **증빙 URL(`proof_url`) 선택**: 결과물 링크는 선택 입력 (없어도 완주 등록 가능).<br>• 판정 완료 시 리더 `leader_count + 1`, 완주자 `completed_count + 1` 동시 가산. | 리더 및 완주자 카운트 원자적 가산 확인. 증빙 URL 없어도 정상 완주 처리 확인. |
| **FR-009** | Post-mortem (실패 회고 수동 등록) | • 목표 미달성 시 리더가 실패 원인/회고(`postmortem_text`) 등록.<br>• 회고 등록 시 리더/완주자 카운트는 가산되지 않음. | 회고 내용 정상 저장 및 미달성 상태 아카이빙 표출 확인. |
| **FR-010** | 명예의 전당 & 성실 멤버 랭킹 | • 완주 완료(`COMPLETED`)된 스터디 카드 목록 표출 및 증빙 URL 외부 링크 연결.<br>• 누적 완주 횟수 내림차순 → 누적 리더 횟수 내림차순 → `login` 오름차순 기준 상위 5명(골드/실버/브론즈) 산출. | 🏆명예의 전당 목록 정상 렌더링 및 랭커 1~5위 집계 쿼리 정합성 확인. |
| **FR-011** | 지금 클러스터 (LIVE 핑) 등록 및 조기 완료 | • 내용(`text`, ≤50자), 위치(`place`), 유효시간(`duration`: 30분/1시간/2시간/3시간) 설정.<br>• **1일 1회 제한**: 매일 KST 자정(00:00) 기준 1일 1회 생성 제한 (도배 방지).<br>• **작성자 조기 완료**: 동료를 찾았을 때 작성자가 `[완료]`를 누르면 `status = 'CLOSED'`로 전이되어 전광판에서 즉시 소멸.<br>• 만료 시간 도달 시 조회 쿼리에서 자동 제외(Lazy Filter: `status = 'RECRUITING' AND expiresAt > now()`). | 작성자 본인 조기 완료 시 목록 즉각 제거 및 1일 2회 이상 생성 시 400 차단 확인. |
| **FR-012** | CLI 터미널 엔드포인트 | • `GET /api/list` 호출 시 ANSI 포맷 텍스트 또는 정돈된 JSON 응답 제공. | `$ curl modoo42.com/api/list` 정상 출력 확인. |

### Phase 3: UI 결합 & 실시간 동기화

`FR-016`은 UI 포팅의 **선행 작업**이다. 유저 식별 필드와 캠퍼스 nullable이 확정되지 않은 상태로 화면을 포팅하면 뱃지 조건부 렌더를 두 번 작성해야 한다.

| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-016** | 유저 식별 스키마 전환 (UI 포팅 선행) | • `users`에 `github_id`(불변 식별자, `UNIQUE NOT NULL`)와 `login`(표시용 핸들, `UNIQUE NOT NULL`)을 신설한다. 기존 `intra_id`는 42 추가 인증용으로 `UNIQUE`·nullable로 남긴다.<br>• `users.campus`의 `NOT NULL`을 해제한다. `campus_type` 열거형 값(`GS`/`SEOUL`)은 그대로 보존한다.<br>• `users.intra_verified_at`(nullable)을 신설한다. 42 추가 인증 시점 기록용이며 §1.3 착수 전까지 항상 `null`이다.<br>• `location_type` 열거형에 `OFFLINE_ETC`를 추가한다. LIVE 핑은 작성자 캠퍼스로 `location_type`을 파생시키므로(`FR-011`) `campus`가 `null`인 작성자는 `OFFLINE_ETC`로 기록한다. **캠퍼스 미인증 유저의 LIVE 핑 등록을 차단하지 않는다.**<br>• API 응답에서 `campus`는 nullable이 된다. `GET /api/posts`, `GET /api/posts/:id`, `GET /api/list`, `GET /api/hall-of-fame`, `GET /api/leaderboard` 계약을 함께 갱신한다. | 마이그레이션 적용 후 `pnpm drizzle-kit check` 통과. `campus`가 `null`인 유저의 LIVE 핑이 `location_type = 'OFFLINE_ETC'`로 저장됨을 확인. 기존 `campus` 보유 유저의 `OFFLINE_GS`/`OFFLINE_SEOUL` 파생이 변하지 않음을 확인. |
| **FR-013** | 대시보드 목록 조회 & 뷰 포팅 | • `Dashboard.html`, `create_study.html`, `about_study.html`(상세보기 모달)을 Next.js React 컴포넌트로 포팅.<br>• 정규: 최신순/마감임박순 정렬 / 단기 파티: D-Day 순 정렬 (**기준은 행사 시작일 `start_date`다.** 2026-10-18 확정) / LIVE 핑: 활성 핑 전광판 표출.<br>• 상세보기 모달은 비참여자에게 `chat_url`을 노출하지 않는다 (`GET /api/posts/:id` 마스킹 응답 그대로 렌더링). | 세션 상태에 따른 대시보드 탭별 정렬/필터링 및 UI 렌더링 정상 확인. 비참여자 상세 모달에 외부 채팅 링크 미노출 확인. |
| **FR-014** | Supabase Realtime 실시간 동기화 | • Supabase Realtime 연동. LIVE 핑 등록 및 참여자 수 변동 시 클라이언트 자동 반영. | 새로고침 없이 대시보드 참여자 수 카운트 증가 및 LIVE 핑 즉시 표출 확인. |
| **FR-019** | 유저 프로필 화면 & 스터디 이력 | • `myprofile.html`을 Next.js React 컴포넌트로 포팅.<br>• 표출 항목: `login`, 누적 완주 횟수(`completed_count`), 누적 리더 횟수(`leader_count`), 참여 스터디 이력(완주·리더·진행 중). **완주율은 `FR-024`에서 같은 산출 함수로 추가한다** (Phase 3.5).<br>• **캠퍼스 뱃지는 `campus`가 `null`이 아닐 때만 렌더한다.** GitHub 인증만 한 유저는 캠퍼스가 없으므로 뱃지 영역을 비운다. 캠퍼스를 채우는 42 추가 인증은 §1.3 보류다.<br>• 이력은 기존 `users`/`posts`/`participants` 조회로 산출한다. **신규 테이블·컬럼을 추가하지 않는다.**<br>• `avatar_url`을 쓰지 않고 `login` 앞 2자리 이니셜 뱃지를 쓴다. 영문은 대문자로 올리고, 숫자·하이픈 등 영문이 아닌 문자는 그대로 쓴다(`42-foo` ➔ `42`).<br>• **개구리 도감·획득 배지 섹션은 범위 밖이다** (§1.3 보류). | 완주/리더 카운트가 FR-008 가산 결과와 일치하고, 이력 목록이 실제 `participants` 레코드와 일치함을 확인. `campus`가 `null`인 유저 프로필에 캠퍼스 뱃지가 렌더되지 않음을 확인. |
| **FR-020** | 단기 파티 종료 Lazy Filter | • 단기 파티(`PARTY`)는 **행사 종료일(`end_date`) 경과 시** 상태 전이 없이 조회 결과에서 제외한다. LIVE 핑 만료(`FR-011`)와 같은 Lazy Filter 방식이며 **만료용 cron을 두지 않는다.**<br>• **제외 기준은 행사 종료일뿐이다** (2026-10-18 확정). 정원 미달이나 행사 시작일 도래로는 제외하지 않는다. 행사가 진행 중이고 정원이 남았다면 참여를 계속 받는다(중도 합류).<br>• 조회 조건: `type = 'PARTY'`일 때 `end_date`가 지난 글은 모집 피드에서 제외한다. 상세 조회는 계속 허용하고 종료 상태로 표출한다.<br>• 행사 종료일이 지난 단기 파티에 대한 참여 요청은 400(`CLOSED`)으로 거절한다. 상태값이 `RECRUITING`으로 남아 있으므로 참여 경로에서 별도 검증이 필요하다.<br>• 리더/완주자 카운트는 가산하지 않는다. 명예의 전당·Post-mortem 아카이빙 대상도 아니다 (`FR-010`). | 행사 종료일이 지난 단기 파티가 모집 피드 조회 결과에 0건이고, 그 글에 참여 요청 시 400 차단 확인. 정원 미달이고 행사 시작일이 지난 파티는 피드에 남고 참여가 200으로 처리됨을 확인. 상태값이 임의로 전이되지 않음을 확인. |
| **FR-021** | 리더 기본 액션 결합 및 완주·회고 화면 포팅 | • **007a (리더 기본 액션):** 상세 모달에 리더 전용 기본 액션(수정 `FR-006` · 중도 취소 `FR-005` · 수동 마감/재모집 토글 `FR-004`)을 결합한다. 진입 조건은 리더 본인이며 모집/마감(`RECRUITING`/`CLOSED`) 상태에서 활성화된다(단, 수정은 `RECRUITING`에서만 허용).<br>• **007b (완주 라이프사이클 화면):** `007a` 머지 후 별도 브랜치에서 `complete.html`(완주 판정 `FR-008`)과 `complete_postmortem.html`(Post-mortem 등록 `FR-009`)을 Next.js React 컴포넌트로 포팅하고 상세 모달에 판정 진입을 연결한다. 진입 조건은 정규 스터디(`STUDY`) 전용 + 판정 창(종료월 15일~익월 10일)이다. | 007a: 리더 본인만 수정·취소·마감/재모집 토글을 수행하고 상태별 활성/비활성 및 서버 거절 확인.<br>007b: 리더 본인만 판정·회고 화면에 진입하고 판정 결과가 `FR-008` 가산 결과와 일치함을 확인. |
| **FR-026** | 디자인 원본 대비 포팅 정합성 복구 | • Phase 3에서 포팅한 화면이 `docs/designs/*.html`과 어긋난 지점을 복구한다. 신규 기능이 아니라 **포팅 누락의 사후 복구**다. 브랜치 `008-design-fidelity`에서 수행하며 **Phase 3.5(`FR-023`·`FR-024`)보다 앞선다** — 토큰과 버튼 규칙이 어긋난 상태로 새 UI를 올리면 같은 수정을 두 번 하게 된다.<br>• **보조 텍스트 색을 `#6b705c`로 교정한다.** 구현은 `#71717a`(zinc)이고 원본은 `#6b705c`(올리브, 배경 `#EDEFE0`와 같은 계열)다. `tailwind.config.ts`의 `muted` 토큰 1곳을 고치면 `text-muted` 사용처 51곳이 따라온다. **`CLAUDE.md` §10 디자인 토큰 표를 먼저 고친 뒤에 토큰을 바꾼다** — 구현이 문서를 따랐으므로 문서가 선행이다 (`CLAUDE.md` §1).<br>• **액센트 버튼·탭에 픽셀 폰트(`px` = Galmuri11)를 되돌린다.** 원본의 액센트 버튼·탭은 예외 없이 `px`이고 `font-weight`를 쓰지 않는다. **`font-bold`를 함께 주지 않는다** — Galmuri11에 bold가 없어 합성 굵게가 픽셀을 뭉갠다. 세로 패딩 비대칭(위가 아래보다 2px 큼)도 그대로 따른다. **가르는 선은 "한글 문구냐 숫자·대문자 약어냐"다** — 한글 문구 칩(`모집 중`·`최신순`·`LIVE`·태그)과 본문·라벨은 Pretendard이고, 숫자·이니셜(`D-3`·`HL`·`GH`)은 버튼처럼 `px`다. 이니셜 뱃지만 원본이 `px`와 `font-weight:800`을 함께 쓰므로 그 자리에서만 유지한다.<br>• **랭킹 1·2·3위 메달 색을 보강한다.** `FR-010`이 이미 "골드/실버/브론즈"를 명시하고 있으므로 신규 요구가 아니라 구현 누락이다. 4·5위는 무채 표면색이다.<br>• **값의 SSOT는 `docs/designs/interactions.md` §3.3~3.4다.** 폰트·치수·색의 실제 숫자를 이 표에 적지 않는다.<br>• **선택 상태의 배경색을 제출 버튼과 분리한다.** 원본은 색 역할이 3단이다 — 제출·참여는 `#5FB63A`(`accent`), 세그먼트·탭·메뉴의 선택 상태는 `#9be06a`(`accent-bright`), 카드의 선택 상태는 `#E4F1D4`(`accent-soft`)다. 구현은 선택 상태에도 `bg-accent`를 써서 "확정 버튼"과 "이미 선택된 보기"가 같은 색이다(5곳). **토큰은 이미 셋 다 있으므로 클래스만 바꾼다.** 아카이브 탭은 색과 함께 그림자 유무(`box-shadow:none`)로도 선택을 표시한다. LIVE 개설 폼의 제출 버튼은 `live`(`#16a34a`)다. **정렬 칩(`최신순`·`마감임박순`)만은 녹색을 전혀 쓰지 않고 활성 상태를 검정 바탕·흰 글자로 표시한다** (2026-10-18 사용자 결정).<br>• **레이아웃 골격을 원본에 맞춘다 (2026-10-18 사용자 결정, 화면 확인 후 추가).** 네 가지다. ① `<main>`에 `max-width:1300px`를 되살린다 — 구현에 없어서 넓은 모니터에서 카드가 설계 폭보다 커진다. 루트 `min-width:1280px`를 뺀 것(375px 1열 대응)은 유지하며, 두 값은 서로 독립이다. ② 성실 멤버 랭킹을 스터디 그리드의 사이드바에서 빼내 **아카이브 카드와 같은 행**(`1.5fr : 1fr`)에 두고, CLI 푸터는 **맨 아래 독립 블록**으로 내린다. ③ 스터디 카드에 `min-height:296px`와 하단 스페이서를 넣어 **`[상세보기]`가 항상 카드 바닥에 붙게** 한다 — 지금은 제목 줄 수에 따라 버튼 높이가 제각각이다. ④ 점선 개설 카드를 가로·세로 중앙 정렬하고 **42px 픽셀 개구리 SVG**를 넣는다. 개구리는 `Dashboard.html` 개설 카드가 쓰는 1종만 컴포넌트로 만들며, **개구리 도감(§1.3 보류)과 무관하다.**<br>• **카드 리더 줄을 패널에 담고 `✓`를 붙인다.** 원본은 리더 정보를 `#F4F7E8` 패널에 넣고 우측에 20px 원형 `✓`를 둔다. **`✓`는 42 인증 완료 표시로 쓰고 `campus !== null`일 때만 렌더한다** (2026-10-18 사용자 결정) — 응답 계약을 바꾸지 않고 쓸 수 있는 신호가 `campus`뿐이다. 캠퍼스 뱃지와 정보가 겹치지만 원본도 부제와 `✓`를 함께 둔다. `✓`는 이미 등재된 글리프 6종 안이라 새 예외가 아니다.<br>• **카드 메타는 항목을 바꾸지 않고 배치만 맞춘다.** `모집 현황`만 하단 CTA 왼쪽으로 내리고, 원본의 `사이클`을 더하지 않으며 원본에 없는 `진행 방식`을 빼지 않는다 (2026-10-18 사용자 결정).<br>• **랭킹 행 박스는 채택하지 않는다.** 원본은 1~3위 행에 패널·테두리·그림자를 씌우지만 메달 색만으로 구분한다 (2026-10-18 사용자 결정). 다음 대조에서 누락으로 세지 않는다.<br>• **태그 칩은 첫 칸만 액센트 틴트다.** 원본이 대표 주제를 앞세운다. 구현은 전부 같은 흰 칩이다.<br>• **섹션 제목 옆 건수에서 박스를 뺀다.** 원본은 테두리·배경 없이 `#3c7a1e` 글자만 쓴다. 구현은 흰 바탕 + 검정 테두리 칩을 씌웠다.<br>• **치수는 원본보다 작아진 쪽을 키운다.** 실측 결과 섹션 제목(21→16px)·카드 제목(20→15px)·태그 칩(13→11px) 등 확인한 모든 자리에서 구현이 더 작다. 의도적으로 줄인 근거가 문서 어디에도 없으므로 포팅 누락으로 본다.<br>• **CLI 푸터만 글꼴이 다르다.** 원본은 고정폭 `GalmuriMono`를 쓴다. 구현은 가변폭 `Galmuri11`(`.px`)이라 터미널 느낌이 나지 않는다. CDN 배포명이 `GalmuriMono11`이므로 별칭 `@font-face`를 추가한다.<br>• **대조 범위는 9화면 전수이고 2026-10-18에 끝났다.** 결과는 `specs/008-design-fidelity/findings.md` 2-B절이다(2-5~2-13). 의도적으로 포팅하지 않는 것(주차별 커리큘럼·참여자별 증빙·기간 선택 버튼·개구리 도감)은 2-10에 근거와 함께 분리해 뒀다.<br>• **상세 모달의 리더 통계 블록(`4회`·`92%`)은 범위 밖이다 (2026-10-18 사용자 결정).** 자리도 만들지 않고 `FR-024`(Phase 3.5)가 값과 함께 만든다. 두 수치 모두 데이터가 없다 — `4회`는 `users.leader_count`지만 상세 응답의 리더 타입이 `PublicUser`(`{login, campus}`)여서 내려오지 않고, 필드를 더하면 아래 "응답 계약을 바꾸지 않는다"를 깬다. `92%`는 `FR-024` 산출이다. 자리만 먼저 만들면 완주율이 `-`, 리더 횟수가 빈칸인 블록이 남는다. 리더 이니셜 뱃지 크기(52px)는 치수 교정 범위로 남는다.<br>• **범위에 포함된 도메인 버그 1건:** `getPostDetail()`의 참여자 조회에 `ORDER BY`가 없어 목록 순서가 비결정적이다. `.orderBy(asc(participants.joinedAt), asc(users.login))`으로 고친다. 디자인 작업과 성격이 다르므로 **PR 본문에서 두 덩어리를 나누어 적는다**.<br>• **기능·스키마·API 표면을 바꾸지 않는다.** 색·폰트·치수·레이아웃과 위 정렬 1건으로 한정한다. 레이아웃 복구는 컴포넌트 조립 순서(`RealtimeFeed`의 `aside` prop, `dashboard/page.tsx`)를 바꾸지만 데이터 흐름과 응답 계약은 그대로다. 미등록 색(`#FF4D4F`·표면 틴트 등)의 토큰화는 실제 사용처가 확인된 것만 넣는다. | 5개 화면을 브라우저에서 원본 HTML과 나란히 열어 보조 텍스트 색·버튼 폰트·메달 색·블록 배치가 일치함을 확인. 넓은 화면에서 본문이 1300px를 넘지 않고, 카드 높이가 달라도 `[상세보기]`가 한 줄에 맞음을 확인. `text-[#71717a]`·`#71717a`가 `src/`에 0건임을 확인. 액센트 버튼·탭 클래스에 `px`가 있고 `font-bold`가 없음을 확인. 참여자 목록이 `joined_at` → `login` 순으로 결정적이고 리더가 첫 행임을 확인. `pnpm test`·`pnpm lint`·`pnpm typecheck` 통과 확인. |

### ~~Phase 3.5: 발표용 UI 보강 & 데모 데이터~~ — §1.3 보류 (2026-10-18)

**아래 3건은 착수하지 않는다.** 명세는 재개할 때 그대로 쓰려고 남겨 둔다. 보류 사유와 "현행 유지" 범위는 §1.3이 SSOT다.

| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-023** | 모집 사이클 알람 배너 | • `Dashboard.html` 상단 배너 좌측(D-Day 칩 + 안내 문구 + `[+ 스터디 개설하기]`)을 포팅한다. 같은 배너 우측의 대왕 개구리 게이지는 §1.3 보류이므로 넣지 않는다.<br>• **배너는 `FR-001`의 모집 기간(매월 15일~말일)을 크게 노출한다.** 상태는 둘뿐이다 — **모집 중(KST 15일~말일):** "{익월}월 사이클 모집 중" + 모집 마감 D-Day(당월 말일까지의 KST 일수 차) + 사이클 기간(익월 1일~익월 말일). **모집 대기(KST 1~14일):** "다음 모집 15일 시작" + 개시 D-Day(당월 15일까지의 KST 일수 차). 이 기간에는 개설 버튼을 비활성화한다 — 서버가 400으로 거절하므로(`FR-001`) 활성 버튼은 거짓 약속이 된다.<br>• 산출은 `src/lib/end-date.ts`의 순수 함수로 두고 `computeStudyEndDate`와 같은 KST 경계 규칙을 공유한다. 서버 컴포넌트가 계산해 넘긴다.<br>• **디자인 원본의 `D-7`·`10월 19일 23:59`은 장식값이므로 쓰지 않는다.** 원본 자체가 D-7과 10/19이 서로 맞지 않는다.<br>• 배너는 개설 기한만 말한다. 사이클이 시작된 뒤에도 `RECRUITING`이고 정원이 남으면 중도 합류가 되므로(2026-10-18 확정, 현행 유지) **참여 마감 기한을 주장하지 않는다.**<br>• 비로그인 상태에도 배너를 표출한다. 개설 버튼은 `FR-022`의 로그인 유도로 바뀐다. | KST 14일/15일/말일/1일 및 12월 말(연도 롤오버) 경계에서 배너 상태·사이클 기간·D-Day가 규칙과 일치함을 확인. 모집 대기 기간에 개설 버튼이 비활성이고 서버 거절과 어긋나지 않음을 확인. 참여 마감을 주장하는 문구가 없음을 확인. |
| **FR-024** | 랭킹 완주율 지표 | • `성실 멤버 랭킹`에 완주율을 추가한다. 현재는 누적 완주·리더 횟수만 표출한다.<br>• **신규 테이블·컬럼을 추가하지 않는다.** `participants.status`의 `COMPLETED`/`INCOMPLETE`가 `FR-008` 판정 시 기록되므로(`posts` 조인) 조회 시점에 산출한다.<br>• 산출 대상은 **정규 스터디(`STUDY`) 참여만**이다. 완주 판정이 `STUDY` 전용이므로 단기 파티·LIVE 핑 참여를 분모에 넣으면 영원히 미완주로 깔린다.<br>• **본인이 리더인 글도 분모에 포함한다** (2026-10-18 확정). `createPost`가 리더의 `participants` 행을 `JOINED`로 넣고(`src/lib/posts.ts:92`) 판정 성공 시 `COMPLETED`로 올리므로, 리더로 연 스터디의 성패가 그대로 완주율에 반영된다. **리더가 완주 체크를 하지 않으면 그 행은 `JOINED`로 남아 미완주로 집계된다** — Post-mortem 등록과 `FR-018` 자동 이관 모두 리더 행을 `COMPLETED`로 올리지 않는다. 의도된 동작이다.<br>• **공식 (전체 참여 횟수 기준, 2026-10-18 확정):** 분자는 `participants.status = 'COMPLETED'` 건수, 분모는 `participants.status IN ('JOINED','COMPLETED','INCOMPLETE')` 건수다. **진행 중(`JOINED`) 참여도 분모에 든다** — 새 스터디에 참여하는 순간 완주율이 내려간다. 이는 의도된 동작이다. `LEFT`/`REMOVED`는 미사용 값이므로 세지 않는다 (`CLAUDE.md` §6.2).<br>• **`CANCELLED` 스터디는 분모에서 제외한다.** 리더의 중도 취소(`FR-005`)는 멤버가 완주할 기회 자체를 없애므로, 분모에 남기면 타인의 결정이 멤버 지표를 영구히 깎는다. 그 외 상태는 전부 분모에 넣는다.<br>• 반올림은 소수점 없이 내림한다(`Math.floor`). 분모가 0인 유저는 퍼센트 대신 `-`를 표출한다. 0으로 나누지 않는다.<br>• **같은 산출 함수를 프로필 화면(`FR-019`)의 요약 영역에도 쓴다.** 랭킹과 프로필이 같은 유저에게 다른 숫자를 보이면 안 되므로 공식을 두 번 구현하지 않는다. 프로필은 본인 기준이므로 분모·분자 건수도 함께 표출한다(예: `완주율 50% (3/6)`).<br>• **상세 모달의 리더 통계 블록(`리더 경험 4회`·`완주율 92%`)도 이 요구에서 만든다** (2026-10-18 사용자 결정, `FR-026`에서 이관). 디자인 원본은 `about_study.html:2551~2552`에서 두 수치를 `#F4F7E8` 패널 2칸(`px` 18px·`#3c7a1e`)으로 둔다. `FR-026`은 자리도 만들지 않았다 — 완주율은 이 요구의 산출 함수가 필요하고, 리더 횟수는 **상세 응답의 리더 타입(`PublicUser` = `{login, campus}`)에 없어 응답 계약을 넓혀야 하기 때문이다.** 따라서 이 요구에서 리더 필드 확장과 두 수치를 함께 처리한다. 응답 계약을 넓히는 것이 이 요구의 범위에 들어오므로 `PublicUser`를 바꿀지 상세 응답에만 리더 통계 필드를 더할지는 Phase 3.5 설계에서 정한다. | 완주·미완주·진행 중 참여가 섞인 유저의 완주율이 공식과 일치함을 확인. 분모 0인 유저가 `-`로 렌더되고 랭킹 순서가 기존과 동일함을 확인. 상세 모달 리더 통계 2칸이 원본 서식(`px` 18px·`#3c7a1e`)으로 값과 함께 렌더됨을 확인. |
| **FR-025** | 발표용 데모 데이터 시드 | • `pnpm seed:demo`로 `Dashboard.html` 수준의 데이터를 주입한다. 수량은 디자인 실측과 맞춘다 — 정규 스터디 4, 단기 파티 5, LIVE 핑 3, 완주 아카이브 4, Post-mortem 아카이브, 랭킹 5명.<br>• **기존 도메인 함수를 거쳐 생성한다.** 직접 `INSERT`로 불변식을 우회하지 않는다. 과거 사이클 아카이브를 만들기 위해 `createPost`에 `now` 주입 파라미터를 추가한다 (`createLivePing`·`completePost`·`postmortemPost`는 이미 받는다).<br>• **날짜는 전부 실행 시각 기준 상대 계산**이다. 디자인의 고정 날짜를 쓰면 단기 파티가 `FR-020` Lazy Filter에 걸려 피드에서 사라진다.<br>• LIVE 핑 3건은 1일 1회 제한(`FR-011`) 때문에 서로 다른 작성자 3명이 필요하다. 유효시간은 열거값 4종(30/60/120/180분) 안에서만 쓴다 — 디자인의 "4시간 남음"은 표현할 수 없다.<br>• 데모 유저의 `github_id` 접두는 `demo:`다. Mock 백필 유저(`mock:`)와 섞지 않는다 — 정리 대상이 달라진다 (`next-steps.md` U9).<br>• `--reset` 삭제 순서는 `participants` → `posts` → `users`다. `posts.leader_id`가 `onDelete: 'restrict'`다.<br>• **상용 DB 주입을 `NODE_ENV`로만 막지 않는다.** 배포본 시연에는 데모 데이터가 필요하므로 명시 플래그로 허용하고, 시드 자체는 멱등으로 둔다. | 시드 후 대시보드 전 섹션이 빈 상태 없이 렌더됨을 확인. 재실행 시 중복 행이 생기지 않음을 확인. `--reset` 후 `demo:` 행만 사라지고 `mock:` 행과 실데이터가 남음을 확인. `pnpm test` 통과 확인. |

### Phase 4: 인증/인가 & 보안·운영 자동화

**Phase 4의 첫 작업은 `FR-027`·`FR-028` 개발자 콘솔이다 (`010-dev-console`).** `FR-018` Grace Period 자동 이관과 `FR-008` 판정창은 달이 바뀌기를 기다리지 않고는 검증할 수 없으므로, 시각 주입 하네스를 먼저 깐 뒤 나머지 항목을 진행한다.

| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-015** | GitHub OAuth & 세션 게이트 | • `commitplease` 스타일 서비스 소개 랜딩(`/login`) 표출.<br>• `[GitHub으로 로그인]` ➔ GitHub OAuth 2.0 Authorization Code 토큰 교환 ➔ 30일 장기 세션 쿠키 발급 ➔ `/dashboard` 이동.<br>• **PKCE를 쓰지 않는다.** GitHub OAuth App은 PKCE를 지원하지 않으므로 `state` 파라미터 검증과 서버 보관 `client_secret`으로 방어한다.<br>• GitHub 프로필의 `id`(불변 숫자 식별자)와 `login`(표시용 핸들)을 `users`에 Upsert한다. `id` 기준으로 매칭하므로 유저가 GitHub 핸들을 변경해도 계정이 유지된다.<br>• 인증 유저 재접속 시 랜딩 건너뛰고 `/dashboard`로 0초 만에 자동 직행(Zero-Click).<br>• **미인증 상태의 대시보드·개설·프로필 접근은 차단한다.** 루트(`/`) 진입 시 `/login`으로 리다이렉트하고, `/dashboard`·`/create`·`/profile` 접근 시 로그인 안내(`LoginRequired`)를 표출하며 대시보드 데이터를 노출하지 않는다. | 30일 세션 유지 검증, 재접속 시 자동 직행 검증. 비로그인 시 대시보드 차단 확인. `state` 불일치 콜백 거부 확인. GitHub `login` 변경 후 재로그인 시 동일 `users` 레코드에 매칭됨을 확인. |
| **FR-017** | RLS 및 서버 인가 이중화 | • Supabase RLS로 direct DB 쿼리 방어.<br>• Next.js Route Handler에서 `session.user.id == post.leader_id` 이중 검증. | 타인이 타인의 글 수정/삭제/완주 판정 시 403 Forbidden 차단. |
| **FR-018** | 미판정 스터디 자동 Post-mortem 이관 | • 정규 스터디 사이클 종료 후 익월 10일까지 판정 미완료 시 시스템이 자동으로 목표 미달성으로 분류하여 Post-mortem 목록 이관(리더/완주자 카운트 미가산). | Cron 트리거 시 기한 도과 미판정 스터디의 자동 Post-mortem 이관 확인. |
| **FR-027** | 개발자 콘솔 — 시간 여행 & 페르소나 전환 | • 개발 환경 전용 플로팅 패널. 기존 `MockAuthModal`을 흡수해 **인증 · 시계 · 시나리오** 3섹션으로 확장한다. **`MockAuthModal`은 삭제하고 페르소나 전환까지 콘솔 게이트 뒤로 넣는다** — 게이트를 `NODE_ENV`와 환경변수 둘로 두지 않는다 (2026-10-19 사용자 결정). 로컬에서도 `DEV_CONSOLE_PASSWORD` 설정과 1회 로그인이 필요하다.<br>• **서버 시각 단일 소스 `serverNow()`를 도입한다** (`src/lib/clock.ts`). 도메인 함수의 `now` 기본값(`new Date()`)을 제거해 호출부가 반드시 주입하게 하고, 유일한 비주입 함수인 `createPost`에 `now` 인자를 신설한다.<br>• **시계 모델은 오프셋이다.** 쿠키 `modoo42_dev_clock`에 `offsetMs` 정수 1개를 담는다. 음수(과거)를 허용하고 범위 제한을 두지 않는다. 패널 입력은 절대 시각(KST)이고 제출 시 `입력 − 실제 now`로 환산한다. **점프 후에도 시계는 흐른다** — LIVE 핑 카운트다운과 만료 전이를 재현하기 위함이다. 고정(freeze) 모드는 만들지 않는다.<br>• **세션 검증만 실제 시각을 쓴다.** `src/lib/session.ts`의 `verifySessionToken`은 `realNow()`를 받는다. 미래로 31일 이상 점프했을 때 30일 세션이 만료 판정되어 콘솔에서 쫓겨나는 것을 막는다.<br>• **시나리오 프리셋:** 모집창 시작(당월 15일) · 모집창 밖(당월 3일) · 판정창 열림(`end_date` 월 15일) · Grace 만료(익월 11일) · 파티 종료 직후 · LIVE 만료 직전/직후 · 다음 KST 자정(LIVE 1일 1회 리셋).<br>• **`created_at`·`joined_at`은 유효 시각으로 명시 삽입한다** (2026-10-19 승인). `src/db/schema.ts:27`·`60`·`72`가 `defaultNow()`라 과거를 **볼 수는 있어도 과거에 쓸 수는 없고**, 그러면 과거 사이클 스터디를 만들 수 없어 아카이브·명예의 전당 검증이 막힌다. 컬럼 기본값은 그대로 두므로 **마이그레이션이 없다.** 지점은 `created_at` 2곳·`joined_at` 2곳(+재참여 갱신 1곳)·도메인 `updated_at` 4곳이다. 실제 시각을 유지하는 자리는 세션 검증(`session.ts`)과 유저 생성·로그인 갱신(`auth.ts`)뿐이다.<br>• **클라이언트 시계도 오프셋을 받는다.** `LivePingBoard`의 1초 인터벌과 `LeaderActions`가 자체 `new Date()`로 판단하지 않는다.<br>• **상용 차단은 `clock.ts` 한 곳에서 한다.** 호출부마다 게이트를 두지 않는다. `DEV_CONSOLE_PASSWORD`가 설정되지 않았거나 유효한 `modoo42_dev_console` 서명 쿠키가 없으면 `serverNow()`가 오프셋 쿠키를 **읽지 않고** 실제 시각을 반환한다 — 시계는 콘솔 세션에 종속된다. | 프리셋별 시각 산출 단위 테스트 통과. 상용 빌드에서 패널 미렌더 및 콘솔 라우트 404 확인. 오프셋 쿠키를 위조해도 상용에서 서버 시각이 변하지 않음을 확인. 콘솔 세션 없이 오프셋 쿠키만 보냈을 때 시각이 변하지 않음을 확인. 페르소나 엔드포인트가 `NODE_ENV`가 아니라 콘솔 게이트를 따름을 확인. |
| **FR-028** | 개발 샌드박스 격리 및 콘솔 게이트 | • **격리 범위는 브라우저 단위 앱 전체다** (2026-10-19 사용자 결정). 유효한 `modoo42_dev_console` 쿠키를 들고 있는 동안 그 브라우저의 모든 읽기·쓰기가 `dev_sandbox`를 본다. 콘솔 화면만 격리하면 샌드박스에 쓴 글이 피드·상세에 보이지 않아 `FR-008`·`FR-018`·`FR-020` 검증이 성립하지 않는다. 현재 유저 해석(`src/lib/auth.ts`)도 샌드박스에서 읽으며, 쿠키 삭제가 운영 복귀 경로다.<br>• **쓰기를 `dev_sandbox` 스키마로 격리한다.** 운영 테이블(`public`)을 변경하지 않는다. 도메인 함수가 이미 받는 `database` 인자에 샌드박스 핸들을 주입한다 (`src/lib/posts.ts` 전 함수가 `database: Database = defaultDb`).<br>• **진입 시 초기화한다.** `dev_sandbox`를 비우고 `public`에서 스냅샷을 복사한다. 삭제 순서는 `participants` → `posts` → `users`다 (`posts.leader_id`가 `onDelete: 'restrict'`). 세션 사이로 데이터가 넘어가지 않으므로 누적이 없다. 나올 때의 정리는 보조 수단이고, 탭 종료·쿠키 만료·서버 재시작에서 실행되지 않으므로 보장은 진입 쪽에 둔다.<br>• **스냅샷은 `chat_url`을 플랫폼 보존 더미 링크로 치환한다** (`https://open.kakao.com/o/dev-sandbox` · `https://discord.gg/dev-sandbox`, 원래 `null`은 `null`). 실제 초대 링크를 콘솔 사용자에게 노출하지 않는다 (`CLAUDE.md` §6.2, 마이그레이션 `0003`). **전건 `NULL`로 하지 않는다** — `chatPlatform`이 컬럼이 아니라 `chat_url`에서 파생되기 때문이다(`src/lib/posts.ts:297`). 전건 `NULL`로 만들면 플랫폼 배지가 사라지고 참여 확인 카피가 모든 글을 오프라인 전용으로 본다 (`specs/010-dev-console/contracts/sandbox-isolation.md` S4).<br>• **살아 있는 세션 표식이 있으면 초기화를 건너뛴다.** `dev_sandbox`에 시작 시각 + TTL 표식 행을 두고, 유효하면 기존 샌드박스에 합류한다. `NFR-004` 2창 검증에서 두 번째 창의 진입이 첫 창의 작업을 지우는 것을 막는다.<br>• **게이트는 환경변수 유무다.** `DEV_CONSOLE_PASSWORD`가 설정된 환경에서만 콘솔 라우트를 등록한다. Vercel Production 스코프에는 설정하지 않으므로 운영 도메인에서는 라우트가 존재하지 않는다. 별도 Vercel 프로젝트나 별도 Supabase 프로젝트를 만들지 않는다.<br>• 비밀번호 비교는 `timingSafeEqual`로 하고, admin 세션은 `modoo42_dev_console` HMAC 서명 쿠키로 발급한다. 평문 플래그 쿠키를 쓰지 않는다.<br>• **파괴적 문장은 스키마를 명시한다.** `TRUNCATE dev_sandbox.participants, dev_sandbox.posts, dev_sandbox.users`처럼 항상 스키마 수식어를 붙이고, `search_path`에 의존하지 않는다. 실행 전 대상 스키마 이름을 상수와 대조해 단정한다.<br>• **Realtime도 샌드박스를 본다.** `ALTER PUBLICATION supabase_realtime ADD TABLE dev_sandbox.posts`와 `0003`의 컬럼 단위 SELECT 권한 복제가 필요하고, 구독은 `schema: 'dev_sandbox'`로 연다.<br>• **동시 샌드박스는 1개다.** 스키마가 하나이므로 운영자 2명 이상은 지원하지 않는다. | 콘솔 세션에서 만든 글이 `public` 테이블에 0건임을 확인. 스냅샷 후 `dev_sandbox.posts.chat_url`에 운영 값이 0건임을 확인. `DEV_CONSOLE_PASSWORD` 미설정 환경에서 콘솔 라우트 404 확인. 초기화 대상 스키마 단정이 `public`을 거부함을 확인. |

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

### Test Suite 5: 유저 식별 스키마 (FR-016) — Phase 3 대상
* **TC-IDENT-01 (식별자 제약):** `github_id`와 `login`은 `NOT NULL`·`UNIQUE`다. 같은 `github_id` 또는 같은 `login`으로 두 번째 유저를 만들면 거부된다. `intra_id`·`campus`·`intra_verified_at`이 모두 `null`인 유저로 글 작성·참여가 성공한다.
* **TC-IDENT-02 (캠퍼스 없는 LIVE 핑):** `campus`가 `null`인 작성자의 LIVE 핑이 차단 없이 생성되고 `location_type = 'OFFLINE_ETC'`로 저장된다. `campus`가 `GS`/`SEOUL`인 작성자의 `OFFLINE_GS`/`OFFLINE_SEOUL` 파생은 변하지 않는다.
* **TC-IDENT-03 (전환 데이터 보존):** 마이그레이션 적용 후 기존 `users`·`posts`·`participants` 건수가 유지되고, `github_id`·`login`이 `null`인 행이 0건이며, 기존 글의 리더 연결이 끊기지 않는다.
* **TC-IDENT-04 (응답 유저 투영):** `GET /api/posts`, `GET /api/posts/:id`, `GET /api/list`, `GET /api/hall-of-fame`, `GET /api/leaderboard`의 유저 표기가 `login`이고 `campus`는 `null`일 수 있다. 어떤 응답도 `intra_id`·`intra_verified_at`을 포함하지 않는다. 랭킹 동률 정렬 키는 `login` 오름차순이다.
* **TC-IDENT-05 (Mock 페르소나 4종):** 페르소나 4종이 해석되고 `github_only`의 `campus`가 `null`이다. 같은 페르소나를 두 번 해석해도 `users` 행은 1건이다(`github_id` 기준 멱등). `guest`·미지값은 비로그인(`null`)이다.

### Test Suite 6: 단기 파티 마감 Lazy Filter (FR-020) — Phase 3 대상
* **TC-PARTY-01 (종료 조회 제외):** 행사 종료일(`end_date`)이 지난 `RECRUITING` 단기 파티는 상태 전이 없이 모집 피드 조회 결과에서 제외된다. 종료일이 남은 파티와 정규 스터디는 영향을 받지 않는다.
* **TC-PARTY-02 (종료 참여 차단):** 행사 종료일이 지난 단기 파티에 참여 요청 시 400(`CLOSED`)으로 거절되고 `current_members`가 증가하지 않는다. 상세 조회는 200으로 계속 허용된다.
* ~~**TC-PARTY-03 (행사 기간 검증):**~~ **§1.3 보류 (2날짜 모델 전제).** 시작일이 과거이거나 오늘로부터 1개월을 넘기면 400이다. 종료일이 시작일보다 앞서거나 총 기간이 14일을 넘기면 400이다. 시작일 = 종료일(당일치기)과 총 14일은 201이다.
* ~~**TC-PARTY-04 (정원 미달 유지):**~~ **§1.3 보류 (2날짜 모델 전제).** 정원이 차지 않고 행사 시작일이 지난 파티가 모집 피드에 남고, 그 글의 참여 요청이 200으로 처리되며 `current_members`가 증가한다.

### ~~Test Suite 7: 발표용 UI 보강 (FR-023, FR-024)~~ — §1.3 보류 (2026-10-18)
* **TC-BANNER-01 (상태 경계):** KST 14일에는 모집 대기 상태(D-1, 개설 버튼 비활성), 15일에는 모집 중 상태로 전환된다. 말일에는 모집 마감 D-0이고, 1일에는 다시 모집 대기 D-14다.
* **TC-BANNER-02 (연도 롤오버):** KST 12월 15일~31일의 대상 사이클이 익년 1월 1일~1월 31일로 산출되고 D-Day가 음수가 되지 않는다. 2월이 28일인 해와 29일인 해에서 말일이 각각 맞게 나온다.
* **TC-CREATE-WINDOW-01 (모집 기간 외 개설 차단):** KST 1~14일의 정규 스터디 생성 요청이 400(`BAD_REQUEST`)으로 거절되고 `posts` 행이 생기지 않는다. 같은 시각의 단기 파티·LIVE 핑 생성은 영향을 받지 않는다.
* **TC-CREATE-WINDOW-02 (`end_date` 고정 산출):** KST 15일~말일에 개설한 정규 스터디의 `end_date`가 **항상 익월 말일 23:59:59.999 KST**다. 12월 개설 시 익년 1월 말일로 연도가 넘어간다.
* **TC-RATE-01 (완주율 산출):** 완주 3건·미완주 1건·회고 종결 1건·진행 중 1건에 참여한 유저의 완주율이 50%다. 진행 중 참여가 분모에 포함됨을 확인한다.
* **TC-RATE-02 (제외 규칙):** 단기 파티·LIVE 핑 참여와 `CANCELLED` 스터디가 분자·분모 모두에서 제외된다. 본인이 리더인 글은 분모에 포함되고, 판정하지 않아 `JOINED`로 남은 리더 행이 미완주로 집계된다.
* **TC-RATE-03 (분모 0):** 정규 스터디 참여가 0건인 유저의 완주율이 `null`로 산출되고 0으로 나누기가 발생하지 않는다. 랭킹 정렬 순서는 완주율 도입 전과 동일하다.
* **TC-RATE-04 (랭킹·프로필 일치):** 같은 유저의 완주율이 랭킹 사이드바와 프로필 화면에서 같다. 프로필은 분자/분모 건수를 함께 표출한다.

### Test Suite 9: 디자인 원본 정합성 (FR-026) — `008-design-fidelity` 대상

**검증 수단의 한계를 먼저 못박는다.** `vitest.config.ts`의 `environment`가 `node`이고 jsdom·testing-library가 설치돼 있지 않다. 컴포넌트를 렌더해 계산된 스타일을 단정할 수 없으므로, 아래 `TC-DESIGN-*`은 **설정값과 소스 문자열에 대한 정적 단정**으로 구현한다. 색의 시각적 일치는 브라우저 수동 대조로 확인한다 (`FR-026` 검증 기준). 렌더 단정을 위해 jsdom을 새로 넣지 않는다.

* **TC-DESIGN-01 (토큰 값):** `tailwind.config.ts`의 `muted`가 `#6b705c`다. 랭킹 메달 3색이 토큰으로 존재한다. `#71717a`가 `src/` 전체에 0건이다.
* **TC-DESIGN-02 (버튼·탭 픽셀 폰트):** 액센트 버튼·탭 컴포넌트의 클래스 문자열에 `px`가 있고 `font-bold`가 없다. Tailwind 가로 패딩 유틸(`px-3` 등)을 폰트 클래스 `px`로 오인해 세지 않는다.
* **TC-DESIGN-03 (칩·라벨 제외):** 정렬 칩·상태 칩·라벨에는 `px`가 없다. 버튼 규칙을 칩까지 넓히지 않았음을 확인한다.
* **TC-DESIGN-04 (레이아웃 골격):** `AppShell`의 `<main>` 클래스 문자열에 본문 최대 폭 제한이 있다. `globals.css`에 `GalmuriMono` `@font-face`가 선언돼 있고 `CliFooter`가 그 글꼴을 쓴다. 블록 배치 자체는 정적으로 단정하지 않고 브라우저 수동 대조로 확인한다.
* **TC-DETAIL-01 (참여자 정렬 결정성):** `getPostDetail()`의 참여자 목록이 `joined_at` 오름차순 → `login` 오름차순으로 정렬된다. 리더가 항상 첫 행이고, 참여 행이 늘어도 순서가 바뀌지 않는다.

### Test Suite 10: 개발자 콘솔 및 샌드박스 (FR-027, FR-028) — `010-dev-console` 대상

* **TC-DEV-01 (프리셋 산출):** 각 시나리오 프리셋이 KST 경계 기준의 기대 시각을 반환한다. 모집창 시작은 당월 15일 00:00 KST 이후, Grace 만료는 `end_date` 월 기준 익월 11일 00:00 KST 이후다.
* **TC-DEV-02 (오프셋 왕복):** 절대 시각 입력을 오프셋으로 환산한 뒤 `serverNow()`로 복원한 값이 입력과 일치한다. 과거 방향(음수 오프셋)도 같다.
* **TC-DEV-03 (상용 차단):** `DEV_CONSOLE_PASSWORD`가 설정되지 않은 환경에서 `serverNow()`가 `modoo42_dev_clock` 쿠키를 무시하고 실제 시각을 반환한다. 콘솔 라우트는 404를 반환하고 패널은 렌더되지 않는다.
* **TC-DEV-04 (세션 면제):** 시계를 미래로 31일 이상 옮긴 상태에서 `verifySessionToken`이 유효 판정을 유지한다. 세션 만료는 dev 시계를 따르지 않는다.
* **TC-DEV-05 (스냅샷 마스킹):** 스냅샷 직후 `dev_sandbox.posts`에 운영 `chat_url` 값이 0건이고 전부 `dev-sandbox` 더미 또는 `NULL`이다. 파생 `chat_platform`이 원본과 같고 `reference_url`은 복사된다.
* **TC-DEV-06 (대상 스키마 단정):** 초기화 대상 스키마가 `dev_sandbox`가 아니면 `TRUNCATE`를 실행하기 전에 거부한다.
* **TC-DEV-07 (세션 표식):** 유효한 표식이 있는 동안의 재진입은 초기화를 수행하지 않는다. TTL이 지난 뒤의 진입은 초기화한다.
* **TC-DEV-08 (`createPost` now 주입):** 과거 시각을 `now`로 넘겨 만든 정규 스터디의 `end_date`가 그 시점 기준으로 산출된다. 호출부가 `now`를 생략할 수 없다.
* **TC-DEV-09 (운영 테이블 불변):** 샌드박스 핸들로 수행한 생성·참여·판정 후 `public` 테이블의 행 수가 변하지 않는다.
* **TC-DEV-10 (시계는 콘솔 세션 종속):** 유효한 `modoo42_dev_console` 쿠키 없이 `modoo42_dev_clock`만 보낸 요청에서 서버 유효 시각이 실제 시각과 같다. 페르소나 엔드포인트도 `NODE_ENV`가 아니라 콘솔 게이트로 거절한다.
* **TC-DEV-11 (샌드박스 범위):** 콘솔 세션 쿠키가 있는 요청의 피드·상세 조회가 `dev_sandbox` 행을 반환하고, 쿠키가 없는 동시 요청은 `public` 행을 반환한다. 현재 유저 해석도 같은 스키마에서 이뤄진다.
* **TC-DEV-12 (생성 시각 명시 삽입):** 과거 시각으로 이동한 상태에서 만든 글의 `created_at`과 참여 행의 `joined_at`이 그 과거 시각이다. 컬럼 기본값에 의존하지 않는다.

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
   - 유저 식별 스키마 전환(`FR-016`)을 **먼저** 머지한다. 화면 포팅보다 앞선다.
   - `Dashboard.html`, `create_study.html`, `about_study.html`(상세보기 모달), `myprofile.html`(프로필·스터디 이력) 화면을 Next.js React 컴포넌트로 포팅.
   - 대시보드 탭별 조회(정규, 파티, LIVE 핑, 명예의 전당) 및 Mock Auth 상태 결합.
   - Supabase Realtime 구독 훅 연결해 참여자 수 및 LIVE 핑 실시간 동기화.
   - 포팅이 끝난 뒤 5개 화면을 원본 HTML과 전수 대조해 정합성을 복구(`FR-026`, 브랜치 `008-design-fidelity`). **Phase 3.5 착수 전에 끝낸다** — 토큰·버튼 규칙이 어긋난 상태로 새 UI를 올리면 같은 수정을 두 번 한다.
5. **~~Phase 3.5: 발표용 UI 보강 & 데모 데이터~~ — §1.3 보류 (2026-10-18).** `FR-023`·`FR-024`·`FR-025`를 함께 내렸다. Phase 3(`FR-026`) 머지 직후 Phase 4로 건너뛴다.
6. **Phase 4: GitHub OAuth 실연동 & RLS 보안·운영 자동화**
   - GitHub OAuth 2.0 Authorization Code 연동(`state` 검증, PKCE 미사용) 및 30일 세션 쿠키 발급, 루트(`/`) 진입 시 소개 랜딩(`/login`) 표출 및 비로그인 대시보드 접근 차단.
   - Supabase RLS 정책 활성화 및 Route Handler 서버 권한 이중 방어.
   - API Rate Limiting 적용 및 미판정 스터디 자동 Post-mortem 이관 Cron 배치 연동.
   - 전용 테스트 DB(또는 Direct 접속 포트 5432) 확보 후 `pnpm test`를 CI 파이프라인에 편입 (`NFR-006`).
