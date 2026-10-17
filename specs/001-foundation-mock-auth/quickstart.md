# Phase 0 Quickstart — 검증 가이드

Phase 0 산출물이 끝에서 끝까지 동작함을 증명하는 실행 시나리오. 구현 상세는 `plan.md`·
`tasks.md`를 본다. 패키지 매니저는 pnpm 전용.

## 전제

- `.env.local`에 `DATABASE_URL` 설정 (Supabase PostgreSQL 접속 문자열).
- 의존성 설치 완료: `pnpm install` (zod, vitest 추가 포함).

## 1. 스키마 마이그레이션 적용 (US3 / SC-004)

```bash
pnpm drizzle-kit generate   # schema.ts → 마이그레이션 생성
pnpm drizzle-kit migrate    # 마이그레이션 적용
pnpm drizzle-kit check      # 스키마/마이그레이션 정합성 검증
```

**기대**: `users`/`posts`/`participants` 테이블과 enum·인덱스가 생성되고, `check`가
정합성 통과. 두 번째 `migrate`는 재적용 없이 통과(Edge Case).

## 2. 테스트 러너 동작 (US3 / SC-005)

```bash
pnpm test
```

**기대**: Vitest가 `DATABASE_URL`로 실제 DB에 붙어 실행. `src/lib/auth.ts`·
`/api/mock-auth` 테스트가 트랜잭션 롤백 격리 하에 통과. TRUNCATE 미발생.

## 3. Mock 페르소나 전환 (US1 / SC-001, SC-002)

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000` 접속 후:

1. 우하단 `[🛠 Mock Auth]` 모달을 연다.
2. `gs_leader` 클릭 → 페이지 갱신, 로그인 유저가 GS 리더로 표시. (계약: `contracts/mock-auth.md`)
3. `gs_member`, `seoul_member` 각각 클릭 → 해당 유저로 즉시 전환.
4. 로그아웃(`guest`) 클릭 → 비로그인 상태로 복귀.

**기대**: 4개 상태 전환 모두 1회 클릭으로 성공 (전환 성공률 100%).

## 4. 상용 차단 (US2 / SC-003) — 보안 필수

상용 모드로 구동해 Mock 경로가 닫혀 있는지 확인한다. 이 검증은 인증 우회 방지를 위해
반드시 수행한다.

```bash
pnpm build && pnpm start      # NODE_ENV=production
```

1. 아무 화면을 열어 `[🛠 Mock Auth]` 모달이 **보이지 않음**을 확인한다.
2. Mock 세션 주입을 직접 호출해 거부되는지 확인한다:

   ```bash
   curl -i -X POST http://localhost:3000/api/mock-auth \
     -H 'Content-Type: application/json' \
     -d '{"persona":"gs_leader"}'
   ```

**기대**: 모달 비노출. `curl`은 `404`를 반환하고 세션은 바뀌지 않는다.

## 통과 기준 요약

| 시나리오 | 성공 기준 | 연결 |
| :--- | :--- | :--- |
| 1 | 세 테이블 생성 + `check` 통과 | SC-004 |
| 2 | 테스트 러너가 실 DB로 통과 | SC-005 |
| 3 | 4개 페르소나 상태 전환 100% | SC-001, SC-002 |
| 4 | 상용 모달 비노출 + 엔드포인트 404 | SC-003 |
