# Contract: POST /api/posts/:id/postmortem — 실패 회고 등록

**인증**: 리더 본인. **대응**: FR-013~014. trd §4.

## Request (JSON)

```jsonc
{ "text": "과제 일정이 겹쳐 2주차부터 출석이 무너졌다. 다음엔 주 2회로 낮춘다." }  // 공백 제외 1~1000자
```

## 서버 처리 (단일 트랜잭션)

1. 글 행 `.for('update')` 잠금. 없으면 `NOT_FOUND`.
2. 리더 검증 → 비리더 `FORBIDDEN`.
3. `type !== 'STUDY'` → `BAD_REQUEST`.
4. `status`가 `COMPLETED`/`CANCELLED` → `BAD_REQUEST`.
5. `now < opensAt`(판정 창 시작 전) → `BAD_REQUEST`.
6. `postmortem_text`·`updated_at`만 갱신(덮어쓰기). **상태·카운트 불변.**

## Response 200

```jsonc
{ "id": "uuid", "status": "CLOSED", "postmortemText": "..." }   // status는 기존 값 그대로
```

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| Zod 실패(공백만·1000자 초과) | `BAD_REQUEST` | 400 |
| PARTY / 최종 상태 / 창 시작 전 | `BAD_REQUEST` | 400 |
| 비로그인·비리더 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |

## 관련 테스트
회고 저장·상태 불변·카운트 불변, 덮어쓰기, 회고 후 판정 400, 비리더 403, PARTY 400.
