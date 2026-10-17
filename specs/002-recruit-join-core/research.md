# Phase 0 Research: 코어 모집 & 참여 루프

NEEDS CLARIFICATION 없음. 설계 결정만 기록한다.

## R1. 도메인 로직 배치 — Route Handler vs 서비스 함수

- **Decision**: 도메인 로직을 `src/lib/posts.ts` 순수 함수로 분리. Route Handler는 인증(`getCurrentUser`)·입력 파싱(Zod)·`toErrorResponse` 매핑만.
- **Rationale**: trd §4.1 `joinStudy(postId, userId)` 시그니처가 이미 함수 분리형. Vitest가 함수를 직접 호출해 트랜잭션 롤백으로 격리 테스트 가능(`auth.ts`의 `DbLike` 주입 선례). Route 레이어는 Next 런타임 의존이라 단위 테스트가 어렵다.
- **Alternatives**: Route Handler에 로직 인라인 → 테스트 어렵고 커버리지 90% 달성 난망. 기각.

## R2. 동시성 Join — trd §4.1 그대로 채택

- **Decision**: `db.transaction()` 안에서 `posts` 행을 `.for('update')`로 잠그고 순서: 조회→상태검증(`RECRUITING` 아니면 `CLOSED` 에러)→중복확인(멱등)→정원검증(`FULL`)→participants insert/update→`currentMembers+1` 및 도달 시 `CLOSED` 전이. trd §4.1 코드를 구현 기준으로 삼는다.
- **Rationale**: 헌법 IV·NFR-001 직접 대응. SSOT(trd)에 구현 원본 존재.
- **Alternatives**: 낙관적 락(버전 컬럼) → 스키마에 버전 없음, 재시도 로직 추가 복잡. 기각. `SELECT ... FOR UPDATE` 없이 CHECK 제약 → 정원 초과 레이스 못 막음. 기각.
- **테스트 주의**: TC-RACE-01(5개 동시 요청)은 각각 **독립 커넥션/트랜잭션**이어야 락 경합이 재현된다. 롤백 격리 헬퍼와 별도로, 레이스 테스트는 실제 커밋 후 수동 정리(해당 글/참여 삭제)하거나 전용 임시 데이터로 수행.

## R3. `chat_url` 화이트리스트 검증

- **Decision**: Zod `.refine()`로 정규식 화이트리스트: `^https://open\.kakao\.com/`, `^https://discord\.gg/`, `^https://discord\.com/invite/`. `src/lib/validation.ts`에 상수로 둔다. `reference_url`은 `^https://`만.
- **Rationale**: NFR-002·헌법 III/V. `http://`·타 도메인 전부 400. 서버가 최종 방어선.
- **Alternatives**: URL 파서로 host 비교 → `discord.com/invite` 경로 구분이 추가 로직 필요, 정규식이 명세와 1:1. 기각.

## R4. 정규 스터디 `end_date` 자동 산출

- **Decision**: `src/lib/end-date.ts`에 순수 함수. 개설일 `day`가 1~14면 당월 말일, 15~말일이면 익월 말일. KST 기준. 리더 입력 `end_date`는 STUDY에서 무시. PARTY는 입력값 사용.
- **Rationale**: CLAUDE.md §7.2·헌법 III. 순수 함수라 경계값(1·14·15·말일, 12월→익년 1월) 단위 테스트 용이.
- **Alternatives**: DB 기본값/트리거 → 로직이 DB에 숨어 테스트·이식 어려움. 기각.

## R5. FR-004 수동 마감/재모집 토글 엔드포인트 (⚠️ 문서 보강)

- **Decision**: `POST /api/posts/:id/status` 신설. body `{ status: 'CLOSED' | 'RECRUITING' }`, 리더 전용. `RECRUITING↔CLOSED`만 허용하고 `COMPLETED`/`CANCELLED` 대상이면 400. trd §4 행 액션 패턴(join/cancel/complete)과 일관.
- **Rationale**: requirement FR-004는 토글을 요구하나 trd §4 표에 엔드포인트가 없다(gap). PUT은 제목·설명·링크·장소 전용이라 상태 전이와 책임이 다르다. 헌법 II(문서 SSOT)에 따라 **같은 PR에서 trd §4 표에 이 행을 추가**한다.
- **Alternatives**: PUT에 `status` 필드 흡수 → 수정과 상태전이 책임 혼재, 부분 업데이트 검증 복잡. 기각. 별도 `/close`+`/reopen` 2개 → 토글 1개로 충분. 기각.
- **Action item**: tasks.md에 "trd §4 표에 `POST /api/posts/:id/status` 행 추가" 포함.

## R6. 테스트 격리 전략

- **Decision**: 공용 Supabase 인스턴스. 기본 테스트는 서비스 함수에 `tx`를 주입해 `tx.rollback()`으로 격리(TRUNCATE 금지, 헌법·CLAUDE.md §9). 동시성 테스트(R2)만 예외적으로 실제 커밋 + 명시적 정리.
- **Rationale**: CLAUDE.md §9 그대로. 공용 인스턴스 오염 방지.
- **Alternatives**: Docker 로컬 PG → 프로젝트 정책상 미사용. 기각.

## R7. 상세 조회 `chat_url` 마스킹

- **Decision**: `getPostDetail(postId, viewerId)`가 참여 여부를 조회해 비참여자면 반환 객체에서 `chatUrl` 키 자체를 제외. 리스트(`GET /api/posts`)도 `chatUrl` 미포함.
- **Rationale**: 헌법 V·CLAUDE.md §6.2. 기본 비공개.
- **Alternatives**: `chatUrl: null`로 치환 → 키 존재가 정보 누출 여지. 키 제외가 더 안전. 채택.
