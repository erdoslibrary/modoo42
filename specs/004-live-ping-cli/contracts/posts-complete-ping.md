# Contract: LIVE 핑 조기 완료 — `POST /api/posts/:id/complete-ping`

## 인증

로그인 필요. 비로그인 → 403 `FORBIDDEN`. Body 없음.

## 처리 순서

트랜잭션 + `posts` 행 `FOR UPDATE` 후:

1. 글 없음 → 404 `NOT_FOUND`
2. `type !== 'LIVE'` → 400 `BAD_REQUEST`
3. `leader_id !== 요청자` → 403 `FORBIDDEN`
4. `status === 'CLOSED'` → 변경 없이 200 (멱등)
5. `status = 'CLOSED'`, `updated_at = now` 갱신 후 200

만료 시각이 지났어도 `RECRUITING`이면 5단계로 `CLOSED` 전이한다.

## Response `200`

```json
{ "id": "uuid", "status": "CLOSED" }
```

## 테스트 ID

TC-LIVE-03 (작성자 완료 후 목록 제외, 타인 403), 멱등 재호출, 비 LIVE 400, 404.
