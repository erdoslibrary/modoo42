# Contract: POST /api/posts/:id/complete — 완주 벌크 판정

**인증**: 리더 본인. **대응**: FR-006~012, NFR-003. trd §4, §4.2.

## Request (JSON)

```jsonc
{
  "evaluations": [                       // 리더 제외 JOINED 참여자 전원, 각 1번씩
    { "userId": "uuid", "isCompleted": true },
    { "userId": "uuid", "isCompleted": false }
  ],
  "proofUrl": "https://github.com/..."   // 선택. 있으면 https:// 만
}
```

## 서버 처리 (단일 트랜잭션)

1. 글 행 `.for('update')` 잠금. 없으면 `NOT_FOUND`.
2. 리더 검증 → 비리더 `FORBIDDEN`.
3. `type !== 'STUDY'` → `BAD_REQUEST`.
4. `status`가 `RECRUITING`/`CLOSED`가 아니면 → `BAD_REQUEST`.
5. `postmortem_text`가 있으면 → `BAD_REQUEST`.
6. `now`가 판정 창(data-model 참고) 밖이면 → `BAD_REQUEST`.
7. 리더 제외 `JOINED` 참여자 집합과 `evaluations[].userId` 집합이 정확히 일치하지 않거나, 완주 0명이면 → `BAD_REQUEST`.
8. 참여자 상태 갱신(`COMPLETED`/`INCOMPLETE`, 리더 행 `COMPLETED`) → 완주 멤버 `completed_count + 1` → 리더 `leader_count + 1` → 글 `status='COMPLETED'`, `proof_url`, `updated_at` 저장.

## Response 200

```jsonc
{ "id": "uuid", "status": "COMPLETED", "completedCount": 1, "incompleteCount": 1 }
```

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| Zod 실패(형태·`proofUrl` 비 https) | `BAD_REQUEST` | 400 |
| PARTY / 최종 상태 / 회고 있음 / 창 밖 / 목록 불일치 / 완주 0명 | `BAD_REQUEST` | 400 |
| 비로그인·비리더 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |

## 관련 테스트
TC-COMPLETE-01(카운트 원자 가산, 증빙 유무 무관), TC-COMPLETE-02(완료 후 참여/취소/수정 400), TC-LEADER-01(비리더 403), 동시 판정 2건 → 가산 1회.
