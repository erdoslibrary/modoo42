# Contract 변경: 게시글 목록 — `GET /api/posts`

Phase 1 계약에 대한 증분이다. 바뀌는 부분만 적는다.

## Query

- `type`: `STUDY | PARTY | LIVE` (`LIVE` 추가). 생략 시 전체 유형.

## Lazy Filter (항상 적용)

```
type <> 'LIVE' OR (status = 'RECRUITING' AND expires_at > now)
```

만료되었거나 `CLOSED`인 LIVE 핑은 `status` 쿼리 값과 무관하게 어떤 목록에도 나오지 않는다.

## Response 항목 추가 필드

- `expiresAt`: LIVE 핑은 만료 시각, 그 외 `null`.

기존 필드는 그대로이며 `chatUrl`은 여전히 포함하지 않는다.

## 상세 조회 — `GET /api/posts/:id`

`expiresAt` 필드를 추가한다. 만료·완료 LIVE 핑도 ID로 조회된다. LIVE 핑의 `participants`는 빈 배열이다.

## LIVE에 대한 기존 쓰기 엔드포인트

`POST /api/posts/:id/join`, `PUT /api/posts/:id`, `POST /api/posts/:id/cancel`, `POST /api/posts/:id/status` → LIVE 핑이면 400 `BAD_REQUEST`. 이 검사는 권한(403) 검사보다 먼저 한다.

## 테스트 ID

TC-LIVE-04 (만료 핑 제외, 상태는 `RECRUITING` 유지), TC-LIVE-03 (완료 핑 제외).
