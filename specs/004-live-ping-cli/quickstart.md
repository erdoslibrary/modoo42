# Quickstart: LIVE 핑 & CLI 조회 검증

## 사전 조건

- `.env.local`에 `DATABASE_URL` 설정 (CLAUDE.md §4)
- `pnpm install` 완료, 마이그레이션 변경 없음 (`pnpm drizzle-kit check` 통과)

## 자동 검증

```bash
pnpm test tests/posts-live.test.ts tests/lib/cli-format.test.ts tests/api/cli-list.test.ts tests/api/posts-complete-ping.test.ts
pnpm test          # 기존 Phase 0~2 A 회귀 포함 전체
pnpm typecheck && pnpm lint
```

기대: TC-LIVE-01~04, TC-CLI-01 및 기존 스위트 전부 통과.

## 수동 검증 (개발 서버)

```bash
pnpm dev
```

1. Mock 로그인 (`gs_leader`):
   ```bash
   curl -s -c /tmp/c.txt -X POST localhost:3000/api/mock-auth -H 'content-type: application/json' -d '{"persona":"gs_leader"}'
   ```
2. LIVE 핑 생성 → 201, `expiresAt` = 지금 + 30분 ([계약](./contracts/posts-create-live.md)):
   ```bash
   curl -s -b /tmp/c.txt -X POST localhost:3000/api/posts -H 'content-type: application/json' \
     -d '{"type":"LIVE","text":"philosopher 데드락 헬프","place":"클러스터 2층","durationMinutes":30}'
   ```
3. 같은 명령 재실행 → 400 (1일 1회).
4. CLI 조회 → `[LIVE 핑]` 섹션에 방금 핑이 보이고 `open.kakao.com` 등 링크가 없음 ([계약](./contracts/cli-list.md)):
   ```bash
   curl -s localhost:3000/api/list
   curl -s 'localhost:3000/api/list?format=json'
   ```
5. 조기 완료 → 200 `CLOSED`, 다시 `curl localhost:3000/api/list` 하면 핑이 사라짐 ([계약](./contracts/posts-complete-ping.md)):
   ```bash
   curl -s -b /tmp/c.txt -X POST localhost:3000/api/posts/<id>/complete-ping
   ```

수동 검증으로 만든 데이터는 공용 DB에 남는다. 확인 후 해당 행을 직접 정리한다.
