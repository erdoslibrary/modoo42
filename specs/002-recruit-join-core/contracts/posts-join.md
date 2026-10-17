# Contract: POST /api/posts/:id/join — 원클릭 참여

**인증**: 필요. **대응**: FR-003/FR-004/FR-005(spec), NFR-001. 구현 원본 trd §4.1.

## Request
body 없음(경로의 `:id` + 세션 유저로 충분).

## 서버 처리 (단일 트랜잭션, trd §4.1 순서)
1. `posts` 행 `.for('update')` 잠금.
2. 없으면 `NOT_FOUND`.
3. `status !== 'RECRUITING'` 이면 `CLOSED`.
4. 이미 `JOINED`면 카운트 미증가 + 기존 `chatUrl` 반환(멱등, `reJoined:true`).
5. `maxMembers` 도달이면 `FULL`.
6. `participants(JOINED)` insert, `currentMembers+1`, 도달 시 `status='CLOSED'`.

## Response 200

```jsonc
{ "chatUrl": "https://open.kakao.com/o/abc123", "reJoined": false }
```
- 성공 응답은 참여자가 되었으므로 `chatUrl` 포함(FR-006). 클라가 새 탭으로 open.

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 없는 글 | `NOT_FOUND` | 404 |
| RECRUITING 아님(CLOSED/CANCELLED/COMPLETED) | `CLOSED` | 400 |
| 정원 초과 | `FULL` | 400 |
| 미인증 | `FORBIDDEN` | 403 |

## 관련 테스트
TC-JOIN-01(정상), TC-JOIN-02(멱등), TC-JOIN-03(마지막 자리 자동 CLOSED), TC-RACE-01(5명 동시 → 1 성공/4 FULL, 초과 0).
