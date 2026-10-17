# Phase 0 Research — 기반 인프라 & Mock 인증

모든 기술 선택은 `docs/trd.md`와 CLAUDE.md에 이미 확정되어 있다. 이 문서는 그 결정을
확인하고, Phase 0 특유의 열린 지점만 해소한다. NEEDS CLARIFICATION 없음.

## 결정 1: Mock 세션 전달 수단 — 쿠키

- **Decision**: `modoo42_mock_user` 쿠키에 선택 페르소나 문자열을 담는다.
  `/api/mock-auth`가 세팅/삭제하고, `getCurrentUser()`가 서버에서 파싱한다.
- **Rationale**: trd.md §2.1과 CLAUDE.md §6.1이 쿠키 이름까지 확정. Route Handler와 서버
  컴포넌트가 같은 쿠키를 읽어 일관된 세션을 얻는다.
- **Alternatives considered**: localStorage(서버에서 못 읽음 → API 인가 불가), 헤더 주입
  (매 요청 수동 세팅 번거로움). 모두 기각.

## 결정 2: 상용 환경 차단 지점 — 서버 + 클라이언트 이중

- **Decision**: `/api/mock-auth` route와 `MockAuthModal` 모두 `NODE_ENV === 'development'`
  일 때만 동작한다. 서버: route 핸들러가 비개발 환경에서 404/거부. 클라이언트: 모달이
  비개발 환경에서 null 렌더.
- **Rationale**: CLAUDE.md §6.1 — 상용 노출은 인증 우회. 클라이언트만 막으면 엔드포인트
  직접 호출로 뚫린다. 서버만 막으면 UI 잔존. 양쪽 모두 막아야 한다 (FR-004, SC-003).
- **Alternatives considered**: 환경변수 플래그 단일 제어(빌드 설정 실수 시 노출 위험). 기각.
  `NODE_ENV` 직접 비교가 Next.js 표준.

## 결정 3: 페르소나 → 유저 레코드 매핑 — 고정 Seed Upsert

- **Decision**: 세 페르소나(`gs_leader`, `gs_member` → campus `GS`; `seoul_cadet` →
  campus `SEOUL`)를 `users` 테이블에 고정 `intra_id`로 Upsert한다. `guest`는 유저 없음
  (비로그인).
- **Rationale**: trd.md §2.1 "쿠키 파싱 → DB users 테이블 매핑/Upsert". `getCurrentUser()`
  최초 호출 시 Upsert하면 별도 seed 스크립트 없이 레코드가 보장된다.
- **Alternatives considered**: 별도 seed 마이그레이션(마이그레이션에 데이터 삽입은 롤백·
  테스트 격리와 충돌). 기각. 메모리 상수만 사용(참여 FK가 실제 user.id를 요구). 기각.

## 결정 4: 테스트 DB 격리 — 트랜잭션 롤백

- **Decision**: 각 테스트를 트랜잭션으로 감싸고 종료 시 롤백한다. 공용 Supabase
  인스턴스이므로 TRUNCATE·DROP 하지 않는다.
- **Rationale**: CLAUDE.md §9. 실제 DB에 붙어 `FOR UPDATE`와 행 수준 정합성을 Phase 1에서
  검증하려면 실 DB가 필요하고, 공용이라 파괴적 정리는 금지.
- **Alternatives considered**: 테스트용 분리 스키마/DB(설정 비용↑, trd가 단일 인스턴스
  전제). Docker 로컬 PG(CLAUDE.md가 "Docker 없이" 명시). 모두 기각.

## 결정 5: zod/vitest 추가 설치

- **Decision**: `zod`(dependencies), `vitest`(devDependencies)를 pnpm으로 추가. `test`
  스크립트를 package.json에 추가(`vitest`).
- **Rationale**: CLAUDE.md "아직 준비되지 않은 것" — 둘 다 미설치. zod는 FR-001(Phase 1)
  검증 필수지만 `src/templates/types.ts`가 Phase 0 토대로 import하므로 지금 설치.
- **Alternatives considered**: Phase 1로 미룸(templates/types.ts·errors.ts 토대가 zod 참조).
  기각.

## 결정 6: `src/db/index.ts` 클라이언트 구성

- **Decision**: `postgres(DATABASE_URL)` 단일 클라이언트 + `drizzle(client, { schema })`.
  트랜잭션은 `db.transaction()`으로 노출(Phase 1 `FOR UPDATE` 사용처).
- **Rationale**: trd.md §4.1이 `db.transaction()` + `.for('update')`를 전제. 토대에서
  schema를 바인딩해 Phase 1이 바로 쓰게 한다.
- **Alternatives considered**: 요청마다 클라이언트 생성(커넥션 낭비). 기각.
