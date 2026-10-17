# Contract: POST /api/posts/:id/cancel — 리더 중도 취소

**인증**: 리더 본인. **대응**: FR-005, NFR-003. trd §4.

## Request (JSON)

```jsonc
{ "reason": "모집 인원 미달로 취소합니다" }  // 취소 사유
```

## 서버 처리
- 리더 검증 → `status` 가 `RECRUITING` 또는 `CLOSED`일 때만 `CANCELLED`로 전이.
- `cancelReason` 저장(스키마에 `cancel_reason` 컬럼 추가 — data-model 주의 참고).
- `CANCELLED`는 최종. 이후 참여/수정/재취소 전부 400.

## Response 200

```jsonc
{ "id": "uuid", "status": "CANCELLED" }
```

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 이미 CANCELLED/COMPLETED | `BAD_REQUEST` | 400 |
| 비리더 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |

## 관련 테스트
TC-CANCEL-01(취소 전이 + 신규 액션 차단), TC-LEADER-01(비리더 403).
