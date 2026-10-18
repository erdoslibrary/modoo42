# Research: LIVE 핑 & CLI 조회 (Phase 2 B)

Technical Context에 NEEDS CLARIFICATION 없음. 아래는 설계 결정 기록이다.

## R1. 1일 1회 제한의 동시성 방어

- **Decision**: `createLivePing` 트랜잭션 안에서 작성자 `users` 행을 `.for('update')`로 잠근 뒤, 같은 KST 날짜 범위(`[dayStart, dayStart + 24h)`)에 생성된 작성자의 LIVE 글 수를 세고, 0건일 때만 insert한다.
- **Rationale**: 동시 요청 2건이 모두 "0건"을 읽고 둘 다 insert하는 경합을 직렬화로 막는다. 참여(Join)가 `posts` 행을 잠그는 것과 같은 패턴이라 새 개념이 없다. 잠긴 행에서 `campus`도 함께 읽어 `location_type` 결정에 쓴다(R4).
- **Alternatives considered**:
  - 부분 유니크 인덱스 `(leader_id, (created_at AT TIME ZONE 'Asia/Seoul')::date) WHERE type = 'LIVE'`: DB가 최종 보증하지만 마이그레이션이 필요하다. 또 `AT TIME ZONE` 식이 인덱스에 쓸 수 있는 IMMUTABLE 조건을 만족하는지 확인해야 한다. 스키마 변경 비용 대비 이득이 작아 기각.
  - `pg_advisory_xact_lock(hashtext(user_id))`: 동작은 같지만 잠금 키가 코드에만 존재해 추적이 어렵다. 이미 있는 행 잠금으로 충분하므로 기각.
  - Rate Limit(NFR-005)로 대체: Phase 4 범위이고, 분당 제한은 일일 제한과 의미가 다르다.

## R2. KST 날짜 경계 계산

- **Decision**: `src/lib/end-date.ts`에 `kstDayRange(now: Date): { start: Date; end: Date }`를 추가한다. 기존 `KST_OFFSET_MS` 벽시계 환산 방식을 재사용한다. `createLivePing`은 `now`를 주입받고, `created_at`과 `expires_at`을 모두 이 `now`로 계산해 저장한다.
- **Rationale**: KST 시간 계산은 이미 이 파일이 맡고 있다. `now` 주입은 Phase 2 A 판정 창 테스트(`completePost(..., now)`)와 같은 방식이고, 23:59/00:00 경계 테스트를 결정적으로 만든다. `created_at`을 DB `now()`에 맡기면 주입한 `now`와 어긋나 경계 테스트가 깨진다.
- **Alternatives considered**: SQL에서 `date_trunc('day', now() AT TIME ZONE 'Asia/Seoul')` 사용. 시각 주입이 불가해 기각.

## R3. LIVE 핑 저장 매핑 (마이그레이션 없음)

- **Decision**: 기존 `posts` 컬럼에 매핑한다.

  | LIVE 개념 | 컬럼 | 값 |
  | :--- | :--- | :--- |
  | 내용(≤50자) | `title` | 입력값 (DB 길이 제약 없음, Zod가 50자 검증) |
  | 위치 | `place` | 입력값 (필수) |
  | 유효시간 | `expires_at` | `now + durationMinutes` |
  | 정원 / 채팅 링크 | `max_members` / `chat_url` | `null` |
  | 태그 | `tags` | `[]` (NOT NULL 컬럼) |
  | 템플릿 | `template_id` / `template_data` | `null` |

- **Rationale**: trd §3.2 스키마가 이미 LIVE를 전제로 설계됐다(`expires_at`, `posts_live_ping_idx`, `max_members`/`chat_url` nullable). 마이그레이션이 없다.
- **Alternatives considered**: 별도 `text` 컬럼 추가. 의미 중복이고 스키마·trd 동시 변경이 필요해 기각.

## R4. `location_type` 값

- **Decision**: 작성자 캠퍼스에 따라 `OFFLINE_GS` 또는 `OFFLINE_SEOUL`로 자동 설정한다. 입력으로 받지 않는다.
- **Rationale**: LIVE 핑은 클러스터 "찾아가기" 용도라 항상 오프라인이다. 캠퍼스는 R1에서 잠근 `users` 행에 이미 있다. 캠퍼스는 표기용일 뿐이고 필터에 쓰지 않는다(CLAUDE.md §7.2).
- **Alternatives considered**: 클라이언트가 지정. 입력 필드가 늘고 잘못된 값(ONLINE)을 막는 검증이 추가로 필요해 기각.

## R5. 리더 자동 참여 레코드

- **Decision**: LIVE 핑 생성 시 `participants` 행을 만들지 않는다. `current_members`는 컬럼 기본값 1을 그대로 둔다.
- **Rationale**: LIVE에는 참여 개념이 없다(spec Edge Cases). 리더 자동 참여(req FR-001)는 스터디·파티 규칙이다. 참여자 행이 없으면 상세 조회의 `participants`는 빈 배열이고, `chatUrl`이 `null`이라 마스킹에도 영향이 없다.

## R6. LIVE에 대한 기존 쓰기 동작 차단

- **Decision**: `joinPost`·`updatePost`·`cancelPost`·`toggleStatus`에 `post.type === 'LIVE'`면 `BAD_REQUEST`를 던지는 가드를 추가한다. 위치는 `NOT_FOUND` 직후, 권한 검사 전이다. `completePost`·`postmortemPost`는 이미 `type !== 'STUDY'`로 막혀 있어 변경하지 않는다.
- **Rationale**: 특히 `toggleStatus`가 `CLOSED` 핑을 `RECRUITING`으로 되돌리면 1일 1회·조기 완료 의미가 깨진다. 유형 위반은 권한과 무관한 요청 자체의 오류라 403보다 먼저 400으로 답한다.

## R7. 조기 완료 처리 순서

- **Decision**: `completeLivePing(postId, userId)` = 트랜잭션 + `posts` 행 `.for('update')` → 없으면 404 → `type !== 'LIVE'`면 400 → 작성자 아니면 403 → 이미 `CLOSED`면 변경 없이 현재 상태 반환 → 아니면 `CLOSED`로 갱신.
- **Rationale**: 행 잠금은 동시 완료 요청과 상태 판정 사이 경합을 막는다. 멱등 성공은 spec Assumptions 결정이다. LIVE 핑은 `RECRUITING`/`CLOSED` 외 상태가 될 수 없다(R6에서 취소 차단).

## R8. Lazy Filter 적용 위치

- **Decision**: `listPosts`의 WHERE에 항상 `NOT (type = 'LIVE') OR (status = 'RECRUITING' AND expires_at > now)`를 추가한다. `ListFilter.type`에 `'LIVE'`를 허용한다. `now`는 주입 가능하게 한다. 응답 항목에 `expiresAt`을 추가한다.
- **Rationale**: 만료·완료 핑이 "어떤 목록에도" 나오지 않아야 한다(spec FR-004). 필터를 함수 한 곳에 두면 웹 목록과 CLI가 같은 규칙을 공유한다. `posts_live_ping_idx (type, status, expires_at)`가 이 조건을 받친다.

## R9. CLI 응답 형식

- **Decision**: `GET /api/list?format=ansi|plain|json`, 기본 `ansi`.
  - `ansi`/`plain`: `Content-Type: text/plain; charset=utf-8`. 섹션 순서는 LIVE 핑 → 단기 파티 → 정규 스터디. ANSI는 섹션 제목·남은 시간·D-Day 강조에만 쓴다.
  - `json`: `{ generatedAt, pings, parties, studies }`.
  - 허용되지 않은 `format` 값 → 400.
- **Rationale**: `curl` 기본 사용에 ANSI가 가장 읽기 좋다. 쿼리 파라미터는 curl에서 가장 쓰기 쉽다(`Accept` 헤더 협상보다 간단). 섹션 순서는 "지금 당장" 정보가 위로 오도록 휘발성 순으로 둔다.
- **Alternatives considered**: `User-Agent`가 curl이면 텍스트, 아니면 JSON. 암묵적 동작이라 디버깅이 어려워 기각.

## R10. CLI 데이터 수집과 도메인 경계

- **Decision**: `src/lib/posts.ts`에 `listForCli(database, now)`를 추가한다. 이 함수는 기존 `listPosts`를 유형별로 호출해 `{ pings, parties, studies }`로 묶는다. 렌더링은 순수 함수 모듈 `src/lib/cli-format.ts`의 `renderCliText(data, { color, now })`가 맡는다.
- **Rationale**: Lazy Filter·`chat_url` 제외 규칙을 `listPosts` 한 곳에서 재사용한다. `listPosts` 응답에는 이미 `chatUrl`이 없다. 텍스트 렌더링은 DB와 무관한 순수 함수라 단위 테스트가 쉽다.
- **정렬**: 핑은 만료 임박순, 파티는 `end_date` 오름차순(D-Day), 스터디는 최신순.

## R11. 터미널 제어 문자 주입 방어

- **Decision**: `renderCliText`는 사용자 입력 문자열(제목·위치·태그·intra ID)에서 C0 제어 문자(`\x00-\x1F`, 탭·줄바꿈 포함), `\x7F`, C1 제어 문자(`\x80-\x9F`)를 제거한 뒤 출력한다. ANSI 이스케이프는 렌더러가 직접 붙인 것만 존재한다.
- **Rationale**: 제목에 `\x1b]...` 같은 시퀀스를 넣으면 공개 엔드포인트를 `curl`하는 사람의 터미널 상태를 조작할 수 있다. 줄바꿈도 제거해 한 항목이 한 줄을 넘어 다른 항목처럼 보이는 위장을 막는다.

## R12. 공개 엔드포인트 노출 범위 (보안 메모)

- **Decision**: spec FR-009 옵션 A. 작성자 intra ID와 장소/위치를 노출하고, `chat_url`·`description`·`reference_url`·`template_data`는 노출하지 않는다. 캐시는 `Cache-Control: no-store`.
- **Rationale**: 사용자 결정(2026-10-18). `chat_url`은 헌법 V에 따라 비참여자에게 비공개다. 나머지 필드는 터미널 한 줄 요약에 불필요해 최소 노출로 둔다.
- **잔여 위험**: 비인증 엔드포인트라 Phase 4 Rate Limit 전까지는 무제한 스크래핑이 가능하다. LIVE 위치는 최대 3시간 휘발 정보로 한정된다.
