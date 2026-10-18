# Contract: LIVE 핑 생성 — `POST /api/posts` (`type: "LIVE"`)

기존 개설 엔드포인트를 `type`으로 분기한다. `STUDY`/`PARTY` 요청 형식은 변하지 않는다.

## 인증

로그인 필요. 비로그인 → 403 `FORBIDDEN`.

## Request

```json
{
  "type": "LIVE",
  "text": "philosopher 데드락 30분 헬프 구합니다",
  "place": "클러스터 2층",
  "durationMinutes": 30
}
```

| 필드 | 규칙 |
| :--- | :--- |
| `type` | `"LIVE"` |
| `text` | 문자열 1~50자 |
| `place` | 문자열 1자 이상 |
| `durationMinutes` | `30`, `60`, `120`, `180` 중 하나 |

`STUDY`/`PARTY` 전용 필드(`title`, `tags`, `maxMembers`, `chatUrl` 등)를 함께 보내면 무시하지 않고 400으로 거부한다(strict).

## 처리 순서

1. Zod 검증 실패 → 400 `BAD_REQUEST`
2. 트랜잭션 시작, 작성자 `users` 행 `FOR UPDATE`
3. 작성자의 오늘(KST) LIVE 생성 수 ≥ 1 → 400 `BAD_REQUEST` ("LIVE 핑은 하루에 한 번만 올릴 수 있습니다.")
4. `posts` insert ([data-model.md](../data-model.md) 매핑), `participants` insert 없음

## Response `201`

```json
{ "id": "uuid", "status": "RECRUITING", "expiresAt": "2026-10-18T05:30:00.000Z" }
```

## 테스트 ID

TC-LIVE-01 (정상·50자/51자·허용 외 유효시간), TC-LIVE-02 (같은 날 2회, KST 경계, 동시 요청).
