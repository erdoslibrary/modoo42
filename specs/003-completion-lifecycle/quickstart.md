# Quickstart: 완주 라이프사이클 검증 (Phase 2 A)

Phase 2 A가 end-to-end로 동작함을 증명하는 실행 가이드. 구현 코드는 tasks.md/구현 단계에서.

## Prerequisites
- `.env.local`에 `DATABASE_URL`(Supabase) 설정, `pnpm install` 완료.
- 마이그레이션 없음(필요 컬럼은 Phase 0 스키마에 존재).

## 자동 검증 (Vitest, 1차 기준)
```bash
pnpm test
```
통과해야 하는 스위트:
- `tests/posts-complete.test.ts` — TC-COMPLETE-01, TC-COMPLETE-02, TC-LEADER-01(판정), 판정 창 경계, 목록 불일치, 동시 판정 1회 가산
- `tests/posts-postmortem.test.ts` — 회고 저장·덮어쓰기·상태/카운트 불변·배타성·권한
- `tests/hall-of-fame.test.ts` — 완주/회고 목록 필터, `chatUrl` 미노출
- `tests/leaderboard.test.ts` — 정렬 규칙, 0건 유저 제외, 5명 컷
- `tests/templates.test.ts` — 6종 프리셋 통과/위반, 미등록 ID, PARTY 차단

판정 창은 시각 주입(`now` 인자, research R3)으로 테스트한다. 시스템 시계는 건드리지 않는다.

커버리지:
```bash
pnpm test -- --coverage   # 완주 판정·상태 머신·권한 90%+ (NFR-006)
```

## 수동 검증 (로컬 서버)
```bash
pnpm dev
```
오늘 개설한 정규 스터디는 판정 창이 아직 열리지 않는다(창은 사이클 종료월 15일부터). 그래서 수동 검증은 **창 밖 차단과 조회 계약**만 확인하고, 판정 성공 경로는 Vitest가 담당한다.

1. **템플릿 목록**: `GET /api/templates` → 6종, `dataSchema` 미노출.
   ```bash
   curl -s localhost:3000/api/templates -b 'modoo42_mock_user=gs_leader'
   ```
2. **템플릿 개설**: `book` + `bookTitle` → 201. `bookTitle` 누락 → 400. `type=PARTY` + `templateId` → 400.
   ```bash
   curl -s -w ' %{http_code}\n' -X POST localhost:3000/api/posts -b 'modoo42_mock_user=gs_leader' \
     -H 'content-type: application/json' \
     -d '{"type":"STUDY","templateId":"book","templateData":{"bookTitle":"클린 코드"},"title":"책 완독","tags":["책 완독"],"locationType":"ONLINE","maxMembers":3,"chatUrl":"https://open.kakao.com/o/abc"}'
   ```
3. **창 밖 판정 차단**: 위 글에 `gs_member` 참여 후 리더가 `POST /api/posts/$POST_ID/complete` → 400.
   API는 참여자 `userId`를 노출하지 않으므로 판정 body에 넣을 `gs_member` id는 DB에서 조회한다.
   같은 body로 `gs_member`가 호출해 403이 나오면 Zod는 통과한 것이므로, 리더의 400은 판정 창 차단이다.
   ```bash
   GMID=$(node -e "require('dotenv').config({path:'.env.local',quiet:true});const p=require('postgres')(process.env.DATABASE_URL);p\`select id from users where intra_id='gs_member'\`.then(r=>{console.log(r[0].id);p.end()})")
   ```
4. **권한**: `gs_member`가 `/complete`·`/postmortem` → 403.
5. **조회**: `GET /api/hall-of-fame`, `GET /api/hall-of-fame?kind=postmortem`, `GET /api/leaderboard` → 200, 응답에 `chatUrl` 없음. `kind=foo` → 400.
6. **정리**: 리더 `/cancel`로 수동 검증 글을 `CANCELLED` 처리(공용 DB).

## 참조
- 엔드포인트: [contracts/](./contracts/)
- 엔티티·상태 머신·판정 창: [data-model.md](./data-model.md)
- 설계 결정: [research.md](./research.md)
