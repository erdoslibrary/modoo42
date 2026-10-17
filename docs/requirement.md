# [요구사항 정의서] 모두의 42 (Modu-42)

* **문서 버전:** v2.0 (Production-Ready)
* **목표:** 서비스 운영 수준의 완성도, SDD(Spec-Driven Development) 및 TDD 기반 단위/통합 테스트·QA 검증 기준서
* **기술 스택:** Next.js (App Router) + TypeScript + Drizzle ORM + Supabase (PostgreSQL & Realtime) + Vercel
* **참조 문서:** [plan.md](./plan.md), [prd.md](./prd.md), [trd.md](./trd.md), [Dashboard.html](./designs/Dashboard.html), [create_study.html](./designs/create_study.html)

---

## 1. 시스템 범위 (Scope)

### 1.1 In-Scope
* **Phase 1 (핵심 비즈니스 도메인 — TDD 대상):** 
  - 스터디/단기 파티/LIVE 핑 CRUD
  - Drizzle 트랜잭션 기반 원클릭 참여 및 정원 초과 방지
  - 자진 참여 취소(Leave) 및 참여자 관리
  - 스터디 중도 취소(Cancel) 및 라이프사이클 관리
  - 리더의 완주/미완주 벌크 판정 및 Post-mortem(실패 회고) 등록
  - 명예의 전당 아카이빙 및 성실 랭킹 집계
  - Supabase Realtime 기반 참여자 수/LIVE 핑 실시간 동기화
  - 터미널 CLI 조회 (`GET /api/list`)
* **Phase 2 (보안, 동시성 및 데이터 무결성):**
  - Drizzle ORM 트랜잭션 격리 (`SELECT FOR UPDATE` 급 동시성 방어)
  - `open.kakao.com`, `discord.gg` URL 정규식 화이트리스트 검증
  - API Rate Limiting (도배 및 스팸 방지)
  - 상태 머신 역전 방지
* **Phase 3 (인증/인가 및 인프라):**
  - 42 Intra OAuth 2.0 PKCE 인증 및 세션 연동
  - 유저 캠퍼스(GS/SEOUL) 파싱 및 프로필 자동 매핑
  - Supabase RLS(Row Level Security) 및 Route Handler 서버 권한 이중 방어

### 1.2 Out-of-Scope (정책적 배제)
* 자체 실시간 채팅 (오픈채팅/디스코드 외부 라우팅 유지)
* 복잡한 가입 승인 결재 플로우 (선 라우팅 후 리더 관리 방식)
* 인앱 결제/예치금 시스템

---

## 2. 기능 요구사항 (Functional Requirements)

### Phase 1: 코어 도메인 로직

| ID | 요구사항 명 | 세부 명세 및 제약사항 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-001** | 스터디/파티 개설 | • 필수 필드: 유형(`type`), 제목(`title`, ≤40자), 정원(`max_members`, 기본 10명, 2~10명), 외부 링크(`chat_url`), 장소(`place`: 온라인/오프라인 상세 장소 직접 입력).<br>• 정규: 종료일(`end_date`)은 개설 시점에 따라 시스템이 당월 말일/익월 말일 자동 고정 산출 / 파티: 마감일(`end_date`) 및 상세 장소 직접 지정. | 유효하지 않은 입력 시 400 에러 및 상세 에러 코드 반환. |
| **FR-002** | 모듈형 템플릿 프리셋 & 전용 데이터 주입 | • 5개 프리셋(`코딩테스트`, `모각코`, `책 완독`, `듀오링고`, `음악 감상`) 선택 시 기본 태그, 설명, 권장 증빙 방식 자동 세팅.<br>• 템플릿별 특화 데이터(`template_data` JSONB) 주입 및 Zod 검증 지원.<br>• 신규 스터디 템플릿을 코드 레벨(PR)로 즉시 확장 가능한 플러그인 아키텍처 제공. | 프리셋 클릭 시 폼 필드 자동 완성 및 템플릿별 추가 필드 검증 통과 확인. |
| **FR-003** | 지금 클러스터 (LIVE 핑) 등록 및 조기 완료 | • 내용(`text`, ≤50자), 위치(`place`), 유효시간(`duration`: 30분/1시간/2시간/3시간) 설정.<br>• 유저당 1일 1회 생성 제한 (최근 24시간 또는 당일 기준 1개 제한으로 도배 방지).<br>• 작성자 조기 완료: 동료를 찾았을 때 작성자 본인이 `[완료]`를 눌러 즉시 전광판에서 조기 소멸 가능.<br>• 만료 시간 도달 시 조회 쿼리에서 자동 제외(Lazy/Filter) 및 Realtime 알림. | 작성자 본인 조기 완료 시 목록 즉각 제거 및 1일 2회 이상 생성 시 400 차단 확인. |
| **FR-004** | 대시보드 목록 조회 | • 로그인 인증 세션 필수 (미인증 시 `/login` 소개 랜딩으로 리다이렉트).<br>• 정규: 최신순/마감임박순 정렬 / 단기 파티: D-Day 순 정렬 / LIVE 핑: 활성 핑 표출. | 비로그인 접근 시 307 리다이렉트 및 로그인 후 정상 데이터 반환 확인. |
| **FR-005** | 원클릭 참여 (Join) | • Drizzle 트랜잭션으로 `participants` 생성 및 `current_members + 1` 원자적 수행.<br>• 이미 참여한 유저는 카운트 증가 없이 기존 `chat_url` 반환.<br>• 성공 시 새 탭으로 `chat_url` 오픈. | 동시 요청 시 정원(`max_members`)을 1명도 초과하지 않음. |
| **FR-006** | 정원 자동 마감 및 수동 마감 | • `current_members == max_members` 도달 시 `status = 'CLOSED'` 자동 전이.<br>• 리더는 마감 전 수동 토글 가능. | 마감 상태 게시글은 `[참여하기]` 비활성화. |
| **FR-007** | *(제외 — 확정 참여 원칙)* 자진 참여 취소 | • 참여 전 확인 팝업을 거치므로 참여 후 자진 취소 불가 (외부 링크 유출 방지 및 리더의 예측 가능성 확보). 참여 완료 시 언제든 오픈채팅 바로가기만 노출. | - |
| **FR-008** | *(제외 — 해커톤 스코프 아웃)* 허수 참여자 강퇴 | • 심플한 유저 플로우 유지를 위해 해커톤 스코프에서 제외 (자진 취소 및 완주 판정 시 이탈자 체크 해제로 대체). | - |
| **FR-009** | 스터디 중도 취소 (Cancel) | • 시작 전 리더가 스터디 개설 취소 가능.<br>• `status = 'CANCELLED'` 전이, 취소 사유 입력. 참여자에게 취소 상태 표출. | 취소된 스터디는 신규 참여/수정 일체 불가. |
| **FR-010** | 완주 벌크 판정 | • 진입 조건: 정규 스터디는 매월 15일~30일(말일), 단기 파티는 마감일 도래 시 리더에게 활성화.<br>• **팀원 완주 판정(필수)**: 리더가 참여자 체크박스로 `COMPLETED`/`INCOMPLETE` 벌크 판정.<br>• **증빙 URL(`proof_url`) 선택**: 결과물 링크는 선택 입력 (없어도 완주 등록 가능).<br>• 판정 완료 시 리더 `leader_count + 1`, 완주자 `completed_count + 1` 동시 가산. | 리더 `leader_count + 1`, 완주자 `completed_count + 1` 가산 및 증빙 URL 없어도 정상 완주 처리 확인. |
| **FR-011** | Post-mortem (실패 회고 & 미달성 자동 분류) | • 수동: 목표 미달성 시 리더가 실패 원인/회고(`postmortem_text`) 등록.<br>• 자동: 정규 스터디 사이클 종료 후 익월 10일까지 판정 미완료 시 시스템이 자동으로 목표 미달성으로 분류하여 Post-mortem 목록 노출 (리더/완주자 카운트 미가산). | 익월 10일 도과 미판정 스터디의 자동 Post-mortem 이관 확인. |
| **FR-012** | 명예의 전당 아카이빙 | • 완주 완료된 스터디 카드 목록 표출.<br>• 증빙 URL 클릭 시 새 탭 이동. | 🏆명예의 전당 탭에서 완주 결과물 확인. |
| **FR-013** | 성실 멤버 랭킹 집계 | • 완주율 및 누적 리더 횟수 기준 상위 5명 산출. | 상위 랭커 1~5위 골드/실버/브론즈 배지 노출. |
| **FR-014** | CLI 터미널 엔드포인트 | • `GET /api/list` 호출 시 ANSI 포맷 텍스트 또는 정돈된 JSON 응답. | `$ curl modoo42.com/api/list` 정상 출력. |
| **FR-015** | 리더 게시글 수정 | • 모집 중 상태일 때 리더는 제목, 설명, 오픈채팅 링크, 장소(`place`) 정보 수정 가능. | 수정 즉시 상세 모달 및 카드 표출 정보 업데이트 확인. |

---

### Phase 2: 비기능 요구사항 (NFR)

| ID | 분류 | 세부 명세 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **NFR-001** | 동시성 및 트랜잭션 | • Drizzle ORM `db.transaction()`과 Postgres 행 레벨 락을 통해 참여/취소 시 데이터 정합성 보장. | 10개 병렬 Join 요청 테스트 시 정원 초과 0건 검증. |
| **NFR-002** | 실시간 동기화 | • Supabase Realtime Engine 연동. LIVE 핑 등록 및 참여자 수 변동 시 1초 이내 클라이언트 자동 반영. | 별도 새로고침 없이 대시보드 카운트 자동 증가 확인. |
| **NFR-003** | 외부 URL 무결성 | • `chat_url`은 `https://open.kakao.com/` 및 `https://discord.gg/` (또는 `discord.com/invite/`) 정규식 화이트리스트만 허용. | 피싱/악성 URL 입력 시 서버 레벨 400 Bad Request 차단. |
| **NFR-004** | 상태 머신 불변성 | • `RECRUITING` ↔ `CLOSED` (정원 증감 시)<br>• `CLOSED` → `COMPLETED` / `CANCELLED` (최종 상태, 역전 불가). | `COMPLETED` 상태 글에 참여/취소/수정 시 400 에러 차단. |
| **NFR-005** | API Rate Limiting | • 게시글/LIVE 핑 생성: 유저당 1분 5회 제한.<br>• 참여/취소: 유저당 1초 2회 제한. | 한도 초과 시 429 Too Many Requests 반환. |
| **NFR-006** | 자동화 테스트 커버리지 | • 핵심 도메인 로직(Join, Leave, Kick, Complete, Status Machine) Vitest 단위/통합 테스트 커버리지 90% 이상 유지. | CI 파이프라인에서 자동 실행 및 통과 필수. |

---

### Phase 3: 인증 및 보안 (Auth & Security)

| ID | 요구사항 명 | 세부 명세 | 검증 기준 (QA/Test) |
| :--- | :--- | :--- | :--- |
| **FR-015** | 42 Intra OAuth & 게이트 | • `commitplease` 스타일 서비스 소개 랜딩(`/login`) 표출.<br>• `[42 Intra로 로그인하기]` ➔ 42 API v2 토큰 교환 ➔ 30일 장기 세션 쿠키 발급 ➔ `/dashboard` 이동.<br>• 인증 유저 재접속 시 랜딩 건너뛰고 `/dashboard`로 0초 만에 자동 직행(Zero-Click).<br>• 미인증 상태로 대시보드 접근 시 `/login` 리다이렉트. | 30일 세션 유지 검증, 재접속 시 자동 직행 및 미로그인 상태 대시보드 접근 차단 검증. |
| **FR-016** | 캠퍼스 및 기수 파싱 | • 42 프로필의 `campus_users`에서 주 캠퍼스(`GS`/`SEOUL`) 파싱하여 유저 프로필 자동 매핑. | 경산/서울 뱃지 자동 부여 확인. |
| **FR-017** | RLS 및 서버 인가 이중화 | • Supabase RLS로 direct DB 쿼리 방어.<br>• Next.js Route Handler에서 `session.user.id == post.leader_id` 이중 검증. | 타인이 타인의 글 수정/삭제/완주 판정 시 403 Forbidden 차단. |

---

## 3. TDD 인수 테스트 시나리오 (Acceptance Test Suites)

### Test Suite 1: 게시글 생성 및 유효성 (FR-001, NFR-003)
* **TC-POST-01 (정상 생성):** 유효한 정규 스터디 데이터 입력 시 `id`와 상태 `RECRUITING` 생성.
* **TC-POST-02 (글자수 제한):** 제목 41자 이상 입력 시 400 Bad Request.
* **TC-POST-03 (인원 범위):** 정원 1명 또는 31명 입력 시 400 Bad Request.
* **TC-POST-04 (URL 도메인 검증):** `https://google.com` 입력 시 400 차단, `https://open.kakao.com/o/xxx` 통과.

### Test Suite 2: 참여 및 동시성 제어 (FR-005, FR-006, NFR-001)
* **TC-JOIN-01 (정상 참여):** 참여 시 `current_members + 1`, `participants` 레코드 생성, `chat_url` 반환.
* **TC-JOIN-02 (중복 참여 멱등성):** 동일 유저 재참여 시 중복 카운트 없이 기존 `chat_url` 반환.
* **TC-JOIN-03 (자동 마감):** 마지막 1자리 참여 시 `status = 'CLOSED'` 전이.
* **TC-RACE-01 (동시 참여 방어):** 정원 1자리 남았을 때 5명 동시 참여 요청 시 정확히 1명만 성공하고 4명은 정원 마감 에러 반환.

### Test Suite 3: 리더 권한 및 완주 라이프사이클 (FR-009, FR-010, FR-011, NFR-004)
* **TC-LEADER-01 (권한 검증):** 비리더가 스터디 취소/완주 호출 시 403 Forbidden 차단.
* **TC-CANCEL-01 (스터디 취소):** 리더가 스터디 취소 시 `status = 'CANCELLED'` 전이 및 신규 액션 차단.
* **TC-COMPLETE-01 (완주 처리):** 리더가 참여자 체크박스 판정 완료 시(증빙 URL 유무 무관) `status = 'COMPLETED'`, 완주 멤버 `completed_count + 1`, 리더 `leader_count + 1` 동시 가산 확인.
* **TC-COMPLETE-02 (사후 수정 불가):** `COMPLETED` 완료 후 참여/취소/정보 수정 시도 시 400 차단.

---

## 4. 데이터베이스 및 스키마 명세 (Drizzle ORM)

```typescript
// src/db/schema.ts
import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core';

export const campusEnum = pgEnum('campus_type', ['GS', 'SEOUL']);
export const postTypeEnum = pgEnum('post_type', ['STUDY', 'PARTY', 'LIVE']);
export const postStatusEnum = pgEnum('post_status', ['RECRUITING', 'CLOSED', 'COMPLETED', 'CANCELLED']);
export const locationTypeEnum = pgEnum('location_type', ['ONLINE', 'OFFLINE_GS', 'OFFLINE_SEOUL', 'HYBRID']);
export const participantStatusEnum = pgEnum('participant_status', ['JOINED', 'LEFT', 'REMOVED', 'COMPLETED', 'INCOMPLETE']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  intraId: text('intra_id').unique().notNull(),
  campus: campusEnum('campus').notNull(),
  completedCount: integer('completed_count').default(0).notNull(),
  leaderCount: integer('leader_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  leaderId: uuid('leader_id').references(() => users.id).notNull(),
  type: postTypeEnum('type').notNull(),

  // [책장/플러그인 아키텍처] 템플릿 식별자 ('cote', 'commit', 'reading', 'duolingo', 'music', 'custom')
  templateId: text('template_id'),

  // [책장/플러그인 아키텍처] 템플릿 전용 특화 데이터 (JSONB)
  // - 새로운 스터디 아이디어(백준 티어, 깃허브 커밋 수, 플레이리스트 등) 추가 시
  //   DB 스키마 마이그레이션 없이 TypeScript 정의 PR만으로 확장 지원
  templateData: jsonb('template_data').$type<Record<string, unknown>>(),

  title: text('title').notNull(),
  tags: text('tags').array().notNull(),
  locationType: locationTypeEnum('location_type').notNull(),
  maxMembers: integer('max_members').notNull(),
  currentMembers: integer('current_members').default(0).notNull(),
  cycle: text('cycle'),
  endDate: timestamp('end_date', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // LIVE 핑 만료용
  chatUrl: text('chat_url').notNull(),
  description: text('description'),
  status: postStatusEnum('status').default('RECRUITING').notNull(),
  proofType: text('proof_type'),
  proofUrl: text('proof_url'),
  postmortemText: text('postmortem_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const participants = pgTable('participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: participantStatusEnum('status').default('JOINED').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

## 5. 실행 계획 및 마일스톤

1. **Step 1: ORM & 테스트 인프라 구성**
   - `drizzle-orm`, `drizzle-kit`, `postgres`, `vitest` 설치 및 설정.
   - Drizzle 스키마 및 마이그레이션 생성.
2. **Step 2: 핵심 비즈니스 도메인 TDD 구현**
   - Test Suite 1, 2, 3 테스트 코드 작성 (Red).
   - Drizzle 트랜잭션 기반 Service 및 Route Handlers 구현 (Green).
   - 상태 머신 및 동시성 락 검증 (Refactor).
3. **Step 3: Supabase Realtime & UI 결합**
   - `Dashboard.html`, `create_study.html` 화면을 Next.js React 컴포넌트로 포팅.
   - Realtime 구독 훅 붙여 실시간 참여자 수 및 LIVE 핑 동기화.
4. **Step 4: 42 OAuth & RLS 보안 강화**
   - 42 OAuth PKCE 연동 및 RLS 정책 활성화.
