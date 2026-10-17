# Quickstart: 코어 모집 & 참여 루프 검증

Phase 1이 end-to-end로 동작함을 증명하는 실행 가이드. 구현 코드는 tasks.md/구현 단계에서.

## Prerequisites
- `.env.local`에 `DATABASE_URL`(Supabase) 설정.
- `pnpm install` 완료, Phase 0 마이그레이션 적용됨(`users`/`posts`/`participants` 존재).
- 이 Phase에서 `cancel_reason` 컬럼을 추가하므로 `pnpm drizzle-kit generate && pnpm drizzle-kit migrate` 선행.

## 자동 검증 (Vitest, 1차 기준)
```bash
pnpm test
```
통과해야 하는 스위트:
- `tests/posts-create.test.ts` — TC-POST-01~04
- `tests/posts-join.test.ts` — TC-JOIN-01~03, TC-RACE-01
- `tests/posts-leader.test.ts` — TC-LEADER-01, TC-CANCEL-01, 상태 머신 차단

커버리지:
```bash
pnpm test -- --coverage   # 핵심 도메인 로직 90%+ (NFR-006)
```

## 수동 검증 (로컬 서버)
```bash
pnpm dev
```
Mock 인증은 개발 모드 플로팅 모달 또는:
```bash
curl -i -X POST localhost:3000/api/mock-auth -H 'content-type: application/json' -d '{"persona":"gs_leader"}'
# Set-Cookie: modoo42_mock_user=gs_leader 확인, 아래 호출에 쿠키 전달
```

1. **개설** (리더):
   ```bash
   curl -X POST localhost:3000/api/posts -b 'modoo42_mock_user=gs_leader' \
     -H 'content-type: application/json' \
     -d '{"type":"STUDY","title":"코테","tags":["코딩테스트"],"locationType":"ONLINE","maxMembers":2,"chatUrl":"https://open.kakao.com/o/abc"}'
   # 기대: 201, status RECRUITING, currentMembers 1
   ```
2. **비참여자 상세** → `chatUrl` 키 없음 확인 (`gs_member` 쿠키로 조회).
3. **참여** (gs_member) → 정원 2 도달 → 응답에 `chatUrl` 포함, 글 `status CLOSED` 자동 전이.
4. **동시성**: 정원 1자리 글에 동시 요청(아래) → 1건만 200, 나머지 `FULL`.
   ```bash
   for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{http_code}\n" \
     -X POST localhost:3000/api/posts/$POST_ID/join -b "modoo42_mock_user=p$i" & done; wait
   ```
5. **권한**: 비리더가 `PUT /api/posts/:id`·`/cancel`·`/status` → 403.
6. **최종 상태**: 리더 `/cancel` → `CANCELLED`, 이후 `/join` → 400.

## URL 화이트리스트 스팟체크
```bash
# 차단되어야 함 (400)
curl -X POST localhost:3000/api/posts -b 'modoo42_mock_user=gs_leader' \
  -H 'content-type: application/json' \
  -d '{"type":"STUDY","title":"x","tags":["a"],"locationType":"ONLINE","chatUrl":"https://google.com"}'
```

## 참조
- 엔드포인트: [contracts/](./contracts/)
- 엔티티·상태 머신: [data-model.md](./data-model.md)
- 설계 결정: [research.md](./research.md)
