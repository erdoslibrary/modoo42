# Research: 완주 라이프사이클 (Phase 2 A)

Technical Context에 NEEDS CLARIFICATION은 없다. 아래는 설계 중 내린 결정 기록이다.

## R1. 완주 판정 동시성 — 글 행 잠금

- **Decision**: `completePost`는 `db.transaction()` 안에서 대상 `posts` 행을 `.for('update')`로 먼저 잠근 뒤 상태·창·참여자 검증 → 참여자 상태 갱신 → 카운트 가산 → 글 `COMPLETED` 전이 순으로 처리한다. trd.md §4.2 예시 코드에 같은 잠금을 추가한다.
- **Rationale**: trd §4.2 원본은 잠금 없이 `select`만 해서, 같은 글에 판정 2건이 동시에 들어오면 둘 다 `CLOSED`를 읽고 카운트를 두 번 올린다(SC-001 위반). Join(trd §4.1)과 같은 잠금 방식을 쓰면 판정·참여가 같은 행에서 직렬화되어 spec Edge Case(판정과 참여 동시 발생)도 함께 해결된다.
- **Alternatives considered**: `UPDATE posts SET status='COMPLETED' WHERE id=? AND status IN (...) RETURNING` 조건부 갱신을 선점 토큰으로 쓰는 방식 — 참여자 검증이 갱신 전에 필요해 결국 잠금이 필요하므로 기각. Advisory lock — 기존 패턴과 달라 기각.

## R2. 판정 창 계산

- **Decision**: `src/lib/end-date.ts`에 `computeVerdictWindow(endDate: Date): { opensAt: Date; closesAt: Date }`를 추가한다. `end_date`가 속한 KST 달의 15일 00:00 KST가 `opensAt`, 익월 10일 23:59:59.999 KST가 `closesAt`. 판정은 `opensAt ≤ now ≤ closesAt`, 회고는 `opensAt ≤ now`.
- **Rationale**: 기존 `computeStudyEndDate`와 같은 KST 벽시계 환산 방식을 재사용해 한 파일이 사이클 날짜 규칙을 모두 소유한다. 정규 스터디 `end_date`는 항상 말일 23:59:59.999 KST라 그 달이 곧 사이클 종료월이다.
- **Alternatives considered**: `created_at` 기준 재계산 — `end_date`가 이미 사이클을 대표하므로 중복. DB 쿼리에서 계산 — 단위 테스트가 어려워 기각.

## R3. 시각 주입

- **Decision**: `completePost`/`postmortemPost`는 마지막 인자로 `now: Date = new Date()`를 받는다.
- **Rationale**: 판정 창 경계(14일/15일, 10일/11일) 테스트를 시스템 시계 조작 없이 결정적으로 수행한다. `database` 주입 패턴과 같은 결이다.
- **Alternatives considered**: `vi.useFakeTimers()` — postgres 드라이버 타이머와 충돌 위험이 있어 기각.

## R4. 판정 목록 검증

- **Decision**: 잠금 후 리더를 제외한 `JOINED` 참여자 집합을 읽어, 요청 `evaluations[].userId` 집합과 정확히 일치(누락·중복·추가 없음)하는지 확인한다. 불일치·리더 포함·완주 0명이면 `BAD_REQUEST`. Zod는 형태만(`userId` uuid, `isCompleted` boolean, 배열 1개 이상) 검증한다.
- **Rationale**: 집합 일치 검증은 DB 상태가 필요해 서비스 계층 책임이다. 잠금 안에서 검증해야 판정 중 신규 참여가 끼어드는 경합이 없다.

## R5. 리더 참여 행 처리

- **Decision**: 판정 확정 시 리더의 `participants` 행도 `COMPLETED`로 갱신한다. 카운트는 `leader_count + 1`만, `completed_count`는 올리지 않는다(spec Assumptions).
- **Rationale**: 참여자 목록에서 리더가 `JOINED`로 남으면 명예의 전당 "완주 멤버" 표시가 어긋난다. 카운트는 역할별로 분리해 랭킹 이중 집계를 막는다.

## R6. 템플릿 특화 데이터 검증

- **Decision**: 각 템플릿의 `dataSchema`는 `z.object({...}).strict()`로 정의한다. `src/lib/templates.ts`의 `resolveTemplate(type, templateId, templateData)`가 (1) `templateData`만 있고 `templateId` 없음 → 400, (2) `PARTY`에 `templateId` → 400, (3) 미등록 ID → 400, (4) `dataSchema` 없는 템플릿(`free`)에 비어 있지 않은 데이터 → 400, (5) `dataSchema.safeParse` 실패 → 400을 처리하고, 통과 시 `{ templateId, templateData, proofType: template.defaultProofType }`를 반환한다. `createPost`가 이를 호출한다.
- **Rationale**: 템플릿 검증은 등록부 조회가 필요해 정적 `createPostSchema`만으로는 못 한다. `.strict()`로 미정의 항목을 거부해 JSONB에 쓰레기가 쌓이지 않게 한다. 등록부는 순수 데이터로 남겨 신규 템플릿이 정의 1건 추가로 끝나게 한다(FR-004).
- **Alternatives considered**: `createPostSchema`를 템플릿별 discriminated union으로 생성 — 템플릿 추가 시 validation.ts도 고쳐야 해 FR-004 위반으로 기각.

## R7. 명예의 전당 / Post-mortem 조회

- **Decision**: `GET /api/hall-of-fame?kind=completed|postmortem`(기본 `completed`) 하나로 두 목록을 제공한다. `completed`는 `type='STUDY' AND status='COMPLETED'`, `postmortem`은 `type='STUDY' AND postmortem_text IS NOT NULL AND status <> 'CANCELLED'`. 정렬은 `updated_at DESC`. 완주 멤버는 `participants.status='COMPLETED'` 행.
- **Rationale**: 두 목록은 같은 아카이브 탭의 두 면이고 필드 대부분이 같다. 완료 시각 전용 컬럼이 없으므로 판정·회고 시 갱신하는 `updated_at`을 완료 시각으로 쓴다(마이그레이션 회피). `CANCELLED`는 회고 등록이 막혀 있지만 방어적으로 제외한다.
- **Alternatives considered**: `GET /api/posts?status=COMPLETED` 재사용 — 완주 멤버·증빙 URL·회고 본문이 필요해 응답 형태가 달라 기각. `completed_at` 컬럼 추가 — 이번 범위에서 이득 대비 마이그레이션 비용이 커 기각.

## R8. 랭킹 쿼리

- **Decision**: `users`에서 `completed_count > 0 OR leader_count > 0`, `ORDER BY completed_count DESC, leader_count DESC, intra_id ASC LIMIT 5`. 순위는 결과 순서 1~5(마지막 정렬 키 `intra_id`가 유일하므로 공동 순위 없음).
- **Rationale**: 카운트는 판정 트랜잭션이 이미 비정규화해 둔 값이라 집계 조인이 필요 없다. 2026-10-18 결정(완주 횟수 우선)을 그대로 반영.

## R9. Post-mortem 과 완주의 배타성

- **Decision**: `completePost`는 `postmortem_text IS NOT NULL`이면 400. `postmortemPost`는 `status IN ('COMPLETED','CANCELLED')`이면 400. 회고 덮어쓰기는 허용한다.
- **Rationale**: spec Assumptions(회고 등록 = 실패 확정). 둘 다 같은 행 잠금 안에서 검사해 경합 없이 배타성을 보장한다.

## R10. TC-COMPLETE-02 (사후 수정 불가)

- **Decision**: 신규 차단 코드 없이 테스트로만 검증한다. Phase 1의 `joinPost`(`status !== 'RECRUITING'` → `CLOSED`), `updatePost`(`!== 'RECRUITING'` → 400), `cancelPost`(`COMPLETED` → 400), `toggleStatus`(최종 상태 → 400)가 이미 `COMPLETED`를 막는다.
- **Rationale**: 기존 동작을 재사용하고, 회귀 방지를 위해 `COMPLETED` 상태 대상 테스트만 추가한다. 참여 시도는 `CLOSED` 코드지만 HTTP 400이라 requirement 기준을 만족한다.
