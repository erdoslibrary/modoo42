# Contract: POST /api/posts/:id/status — 수동 마감/재모집 토글

**인증**: 리더 본인. **대응**: FR-004. ⚠️ **trd §4 표에 신규 추가 필요(research R5)**.

## Request (JSON)

```jsonc
{ "status": "CLOSED" }   // "CLOSED"(수동 마감) | "RECRUITING"(재모집)
```

## 서버 처리
- 리더 검증.
- 현재 상태가 `RECRUITING` 또는 `CLOSED`일 때만 상대값으로 토글 허용.
- 대상이 `COMPLETED`/`CANCELLED`(최종)면 400.
- 요청 `status`가 `CLOSED`/`RECRUITING` 외면 400.

## Response 200

```jsonc
{ "id": "uuid", "status": "CLOSED" }
```

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 최종 상태 대상 토글, 허용 외 status 값 | `BAD_REQUEST` | 400 |
| 비리더 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |

## 관련 테스트
US3 시나리오(마감→재모집 복귀), 비리더 403.
