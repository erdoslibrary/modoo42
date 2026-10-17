# Feature Specification: 코어 모집 & 참여 루프 (Phase 1)

**Feature Branch**: `002-recruit-join-core`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Phase 1 모집·참여 코어 — docs/requirement.md Phase 1 범위 기반"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 스터디/단기 파티 개설 (Priority: P1)

42 멤버(리더)가 함께할 동료를 모으기 위해 스터디 또는 단기 파티를 개설한다. 유형·제목·정원·외부 채팅 링크·장소를 입력하고, 템플릿 버튼으로 기본 형태를 빠르게 고른다. 개설과 동시에 리더 본인이 첫 참여자로 자동 등록된다.

**Why this priority**: 모집 글이 없으면 참여도 완주도 성립하지 않는다. 플랫폼의 모든 흐름이 여기서 시작하므로 최우선이다.

**Independent Test**: 유효한 정규 스터디 데이터로 개설 요청 → `RECRUITING` 상태 글 생성, `current_members = 1`, 리더의 `JOINED` 참여 레코드 존재 확인. 이것만으로 "모집 글을 만든다"는 가치가 독립적으로 검증된다.

**Acceptance Scenarios**:

1. **Given** 유효한 정규 스터디 입력(제목 ≤40자, 정원 2~10, 허용 `chat_url`), **When** 개설 요청, **Then** 상태 `RECRUITING`, `current_members = 1`, 리더 참여 레코드 `JOINED` 자동 생성. (TC-POST-01)
2. **Given** 제목 41자 입력, **When** 개설 요청, **Then** 400 Bad Request. (TC-POST-02)
3. **Given** 정원 1명 또는 11명 입력, **When** 개설 요청, **Then** 400 Bad Request (허용 2~10). (TC-POST-03)
4. **Given** `https://google.com` 입력, **When** 개설 요청, **Then** 400 차단. `https://open.kakao.com/o/xxx`는 통과. (TC-POST-04)
5. **Given** 1~14일 사이 개설한 정규 스터디, **When** 개설, **Then** `end_date`가 당월 말일로 자동 산출. 15일~말일 개설이면 익월 말일.
6. **Given** 단기 파티 개설, **When** 마감일을 직접 지정, **Then** 지정한 `end_date`로 저장.
7. **Given** 템플릿 버튼(코딩테스트/모각코/책 완독/듀오링고/음악 감상/자유) 클릭, **When** 개설 폼 진입, **Then** 해당 기본 제목/설명 플레이스홀더가 폼에 연동.

---

### User Story 2 - 원클릭 참여 & 동시성 방어 (Priority: P1)

비참여 멤버가 모집 글에 참여한다. 상세 보기로 소개·목표·참여자·장소·플랫폼 배지·참고 링크를 확인하고, `[참여하기]` 확인 팝업 후 확정하면 참여자로 기록되고 외부 채팅방이 새 탭으로 열린다. 다수가 마지막 한 자리에 동시에 몰려도 정원은 초과되지 않는다.

**Why this priority**: 모집의 반대편 핵심 행동. 동시성 정합성(NFR-001)과 링크 가시성 정책이 걸려 있어 US1과 함께 MVP를 구성한다.

**Independent Test**: 1자리 남은 글에 5명 동시 참여 요청 → 정확히 1명 성공, 4명 정원 마감 에러, `current_members`가 `max_members`를 1도 넘지 않음 확인.

**Acceptance Scenarios**:

1. **Given** 모집 중 글, **When** 비참여자가 참여, **Then** `current_members + 1`, `JOINED` 레코드 생성, `chat_url` 반환. (TC-JOIN-01)
2. **Given** 이미 `JOINED`인 유저, **When** 재참여, **Then** 카운트 미증가, 기존 `chat_url` 반환 (멱등성). (TC-JOIN-02)
3. **Given** 마지막 1자리 남은 글, **When** 참여로 정원 도달, **Then** `status = 'CLOSED'` 자동 전이. (TC-JOIN-03)
4. **Given** 정원 1자리, **When** 5명 동시 참여, **Then** 정확히 1명 성공·4명 정원 마감 에러, 초과 0건. (TC-RACE-01)
5. **Given** `CLOSED` 글, **When** 참여 시도, **Then** 400 차단.
6. **Given** 비참여자, **When** 글 상세 조회, **Then** `chat_url`은 응답에서 제외(마스킹), `chat_platform`·`reference_url`은 공개.
7. **Given** 참여자, **When** 글 상세 조회, **Then** `chat_url` 포함.

---

### User Story 3 - 리더 수동 마감 / 재모집 토글 (Priority: P2)

리더가 모집 중 글을 정원 도달 전이라도 수동으로 마감하거나, 마감한 글을 다시 모집 상태로 되돌린다.

**Why this priority**: 개설·참여가 돌아간 뒤 리더가 모집 흐름을 통제하는 보조 기능. 코어 루프 없이는 의미가 없어 P2.

**Independent Test**: 리더가 `RECRUITING` 글 마감 → `CLOSED`, 다시 토글 → `RECRUITING` 복귀 확인. 비리더 토글은 403.

**Acceptance Scenarios**:

1. **Given** `RECRUITING` 글, **When** 리더가 수동 마감, **Then** `status = 'CLOSED'`, `[참여하기]` 비활성.
2. **Given** `CLOSED` 글(수동 마감), **When** 리더가 재모집 토글, **Then** `status = 'RECRUITING'` 복귀.
3. **Given** 글, **When** 비리더가 마감/재모집 시도, **Then** 403 Forbidden.

---

### User Story 4 - 리더 게시글 수정 (Priority: P2)

리더가 모집 중 글의 제목·설명·채팅 링크·장소를 고친다.

**Why this priority**: 오타·정보 갱신 대응. 코어 루프의 부가 편집 기능이라 P2.

**Independent Test**: 리더가 `RECRUITING` 글의 제목/장소 수정 → 즉시 반영. 비리더 수정은 403.

**Acceptance Scenarios**:

1. **Given** `RECRUITING` 글, **When** 리더가 제목·설명·`chat_url`·`place` 수정, **Then** 즉시 반영. (`chat_url`은 동일 화이트리스트 재검증)
2. **Given** 글, **When** 비리더가 수정 시도, **Then** 403 Forbidden. (TC-LEADER-01)
3. **Given** `CLOSED`/`CANCELLED`/`COMPLETED` 글, **When** 수정 시도, **Then** 400 차단.

---

### User Story 5 - 스터디 중도 취소 (Priority: P2)

리더가 시작 전 스터디를 취소 사유와 함께 취소한다. 취소 후에는 어떤 액션도 받지 않는다.

**Why this priority**: 모집 실패·일정 변경 대응. 코어 루프 종료 경로라 P2.

**Independent Test**: 리더가 글 취소 → `CANCELLED`, 이후 참여·수정 모두 차단 확인.

**Acceptance Scenarios**:

1. **Given** `RECRUITING`/`CLOSED` 글, **When** 리더가 취소 사유와 함께 취소, **Then** `status = 'CANCELLED'`, 사유 저장, 참여자에게 취소 상태 표출. (TC-CANCEL-01)
2. **Given** `CANCELLED` 글, **When** 참여·수정·재취소 시도, **Then** 400 차단.
3. **Given** 글, **When** 비리더가 취소 시도, **Then** 403 Forbidden.

---

### Edge Cases

- 이미 정원이 찬(`CLOSED`) 글에 동시 참여가 들어오면 전부 정원 마감 에러.
- 리더 자신이 자기 글에 다시 참여 → 멱등 처리(카운트 미증가, 기존 `chat_url` 반환).
- 존재하지 않는 글 ID로 참여/수정/취소 → 404.
- `chat_url`이 화이트리스트 형식이나 `http://`(비 HTTPS)인 경우 → 400.
- 정규 스터디 개설 시 리더가 `end_date`를 보내도 무시하고 시스템 산출값으로 고정.
- 정원 범위·제목 길이 등 프론트 통과 후 서버 Zod 검증에서 재차 차단(서버가 최종 방어선).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 시스템은 유형·제목(≤40자)·정원(2~10, 기본 10)·`chat_url`·장소 입력으로 스터디/단기 파티를 개설할 수 있어야 한다. 정규 스터디 `end_date`는 개설일 기준(1~14일→당월 말일, 15일~말일→익월 말일) 자동 산출하고 리더가 지정하지 못한다. 단기 파티는 `end_date`를 직접 지정한다. 개설 시 `current_members = 1`로 초기화하고 리더의 `JOINED` 참여 레코드를 자동 삽입한다.
- **FR-002**: `chat_url`은 `https://open.kakao.com/`, `https://discord.gg/`, `https://discord.com/invite/` 정규식 화이트리스트만 허용한다(서버 Zod 검증, NFR-002). 위반 시 400.
- **FR-003**: 개설 화면에 6종 템플릿 버튼(코딩테스트·모각코·책 완독·듀오링고·음악 감상·자유)을 제공하고, 클릭 시 기본 제목/설명 플레이스홀더를 폼에 연동한다. (세부 JSONB 주입은 Phase 2)
- **FR-004**: 원클릭 참여는 단일 트랜잭션에서 대상 글 행을 잠근 뒤 중복 확인 → 정원 검증 → `JOINED` 레코드 생성 → `current_members + 1` 순으로 원자적 처리한다(NFR-001). 동시 요청에도 정원을 초과하지 않는다.
- **FR-005**: 이미 `JOINED`인 유저의 재참여는 카운트를 올리지 않고 기존 `chat_url`을 반환한다(멱등성).
- **FR-006**: 참여 성공 응답은 `chat_url`을 포함한다. `chat_url`은 참여자에게만 공개하며, 비참여자의 글 상세 응답에서는 마스킹(필드 제외)한다. `chat_platform`과 `reference_url`은 전체 공개다.
- **FR-007**: `current_members == max_members` 도달 시 `status`를 자동으로 `CLOSED`로 전이한다.
- **FR-008**: 리더는 `RECRUITING`↔`CLOSED`를 수동으로 양방향 토글(수동 마감 / 재모집)할 수 있다.
- **FR-009**: 리더는 `RECRUITING` 글의 제목·설명·`chat_url`·장소를 수정할 수 있다. `chat_url`은 화이트리스트로 재검증한다. `RECRUITING`이 아닌 글 수정은 400.
- **FR-010**: 리더는 `RECRUITING`/`CLOSED` 글을 취소 사유와 함께 취소하여 `status = 'CANCELLED'`로 전이할 수 있다.
- **FR-011**: `COMPLETED`·`CANCELLED`는 최종 상태로 역전 불가하며, 해당 글에 대한 참여·수정·취소 시도는 400으로 차단한다(NFR-003). (`COMPLETED` 전이 자체는 Phase 2)
- **FR-012**: 리더/작성자 본인이 아닌 유저의 수정·마감·취소 시도는 403 Forbidden으로 차단한다.
- **FR-013**: 존재하지 않는 글 대상 요청은 404로 응답한다.

**범위 밖(이 Phase 비대상):** 완주 벌크 판정·카운트 가산(FR-008 req), Post-mortem, 명예의 전당, LIVE 핑, CLI 엔드포인트, Realtime, 42 OAuth, Rate Limit, 자진 참여 취소(Leave)/강퇴(Kick).

### Key Entities

- **Post (게시글)**: 모집 단위. 유형(STUDY/PARTY), 제목, 설명, 정원(`max_members`), 현재 인원(`current_members`), 상태(`RECRUITING`/`CLOSED`/`CANCELLED`/`COMPLETED`), 리더(`leader_id`), `chat_url`, `chat_platform`, `place`, `reference_url`, `end_date`, 취소 사유. 리더와 1:N 참여자를 가진다.
- **Participant (참여자)**: Post와 User를 잇는 참여 기록. 상태 `JOINED`(Phase 1에서 유일하게 쓰는 값). 글당 유저 1건(중복 불가).
- **User (유저)**: Mock 인증 페르소나. 리더/참여자로 글과 연결.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 정원 1자리에 10개 병렬 참여 요청을 보내도 정원 초과 참여가 0건이다. (NFR-001 / TC-RACE-01)
- **SC-002**: 허용되지 않은 `chat_url`(피싱/비 HTTPS/타 도메인) 입력은 100% 서버에서 400으로 차단된다. (NFR-002)
- **SC-003**: 최종 상태(`CANCELLED`) 글에 대한 참여·수정·취소 시도는 100% 400으로 차단된다. (NFR-003)
- **SC-004**: 비리더의 수정·마감·취소 시도는 100% 403으로 차단된다.
- **SC-005**: 비참여자의 글 상세 응답에 `chat_url`이 단 한 번도 노출되지 않는다.
- **SC-006**: 핵심 도메인 로직(참여 동시성, 상태 머신 전이, 권한 제어) 테스트 커버리지 90% 이상. (NFR-006)

## Assumptions

- 인증은 Phase 0의 Mock 세션(`getCurrentUser()`, `modoo42_mock_user` 쿠키)을 그대로 재사용한다. 42 OAuth는 Phase 4.
- 테스트는 Docker 없이 `.env.local`의 `DATABASE_URL`로 실제 Supabase PostgreSQL에 붙어 트랜잭션 롤백으로 격리한다(테이블 TRUNCATE 금지).
- DB 스키마(`users`/`posts`/`participants`)는 Phase 0에서 생성된 것을 사용한다. Phase 1에서 신규 컬럼이 필요하면 `src/db/schema.ts`와 `docs/trd.md` §3.2를 같은 PR에서 함께 수정한다.
- 참여자 수/상태의 실시간(무새로고침) 반영은 Phase 3 범위이며, Phase 1은 요청-응답 정합성까지만 책임진다.
- 자진 참여 취소·강퇴는 정책상 없으므로 `participant_status`의 `LEFT`/`REMOVED`는 구현하지 않는다.
