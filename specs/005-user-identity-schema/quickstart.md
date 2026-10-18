# Quickstart: 유저 식별 스키마 전환 검증 (005)

전환이 실제로 동작하는지 확인하는 절차다. 구현 세부는 [tasks.md](./tasks.md)가, 스키마 정의는 [data-model.md](./data-model.md)가, 응답 형태는 [contracts/](./contracts/)가 갖는다.

## 사전 조건

- `.env.local`에 `DATABASE_URL`이 설정돼 있다 (개발용 Supabase).
- 패키지 매니저는 `pnpm`이다. `npm`/`npx`를 쓰지 않는다.
- 이 전환에 선행하는 외부 작업(U1~U8)은 없다.

## 1. 전환 전 상태 기록

전환 후 데이터 보존을 비교할 기준값이다. 적용 전에 반드시 남긴다.

```bash
pnpm vitest run tests/identity-schema.test.ts -t 'TC-IDENT-03'
```

이 테스트는 `users`·`posts`·`participants` 건수와 `github_id`·`login`의 `null` 건수를 검사한다. 전환 전에는 실패(Red)하고, 마이그레이션 적용 후 통과한다.

## 2. 마이그레이션 생성·편집·적용

```bash
pnpm drizzle-kit generate   # 생성물 확인 (아직 적용 아님)
```

생성된 `drizzle/0002_*.sql`을 [data-model.md §4](./data-model.md#4-마이그레이션-적용-순서-단일-파일-단일-트랜잭션)의 5단 순서로 편집한다. 편집 없이 적용하면 다음 오류로 실패한다.

```text
column "github_id" of relation "users" contains null values
```

`drizzle/meta/*.json` 스냅샷은 생성물을 그대로 둔다. 편집 대상은 SQL 본문뿐이다.

```bash
pnpm drizzle-kit migrate    # 적용
pnpm drizzle-kit check      # 스키마 ↔ 스냅샷 정합성
```

## 3. 자동 검증

```bash
pnpm test        # 전체. PR 전 필수 게이트 (CI에 없다, NFR-006)
pnpm typecheck
pnpm lint
```

인수 테스트 ID 매핑:

| ID | 내용 | 위치 |
| :--- | :--- | :--- |
| TC-IDENT-01 | `github_id`·`login` 필수·유일, 42 컬럼 3개는 비어 있음 | `tests/identity-schema.test.ts` |
| TC-IDENT-02 | 캠퍼스 `null` → `OFFLINE_ETC`, `GS`/`SEOUL` 파생 불변 | `tests/posts-live.test.ts` |
| TC-IDENT-03 | 백필 후 데이터 보존 (건수 유지, `null` 0건) | `tests/identity-schema.test.ts` |
| TC-IDENT-04 | 응답 5건의 유저 투영이 `login`, `campus` nullable | `tests/posts-list.test.ts`·`posts-detail.test.ts`·`api/cli-list.test.ts`·`hall-of-fame.test.ts`·`leaderboard.test.ts` |
| TC-IDENT-05 | 페르소나 4종, `github_only`의 `campus`가 `null`, 멱등 | `tests/lib/auth.test.ts` |

## 4. 수동 확인 (개발 서버)

```bash
pnpm dev
```

1. 우하단 `[🛠 Mock Auth]` 모달을 연다 → 버튼이 **5개**다 (페르소나 4종 + 로그아웃).
2. `GitHub 전용 (캠퍼스 없음)`을 고른다.
3. LIVE 핑을 1건 등록한다 → 생성 성공. DB에서 그 행의 `location_type`이 `OFFLINE_ETC`다.
4. 터미널에서 CLI 응답을 본다.

```bash
curl -s localhost:3000/api/list | cat          # 텍스트: 작성자가 (github_only)로 보인다
curl -s 'localhost:3000/api/list?format=json'  # JSON: leader가 { "login": …, "campus": null }
```

기대값: 작성자 라벨에 `·` 구분자나 빈 괄호가 남지 않는다. 응답 어디에도 `chat_url`과 `intraId`가 없다.

5. `GS 리더`로 전환해 같은 절차를 반복한다 → 라벨이 `(gs_leader·GS)`, LIVE 핑은 `OFFLINE_GS`다.

## 5. 문서 동기화 확인 (같은 PR)

- `docs/requirement.md` — FR-000의 페르소나 수(3종 → 4종), §3에 `TC-IDENT-01~05` 신설
- `docs/trd.md` — §2.1 페르소나 목록 4종 (§3.2는 이미 목표 상태)
- `docs/next-steps.md` — Phase 3 진행 상태 갱신, 백필로 남는 Mock 데이터 수동 정리 항목 추가

## 되돌리기

`location_type`의 `OFFLINE_ETC` 추가는 **되돌릴 수 없다**(열거형 전진 전용). 되돌려야 하면 값을 제거하는 대신 쓰지 않는다. `users`의 컬럼 추가·제약 완화는 역마이그레이션으로 되돌릴 수 있지만, 백필된 `github_id`·`login` 값은 복원 대상이 아니다.
