# Contract: GET /api/leaderboard — 성실 멤버 랭킹 TOP 5

**인증**: 필요(로그인 유저). **대응**: FR-016, FR-017. trd §4.

## 서버 처리

`users`에서 `completed_count > 0 OR leader_count > 0`,
`ORDER BY completed_count DESC, leader_count DESC, intra_id ASC LIMIT 5`. 캠퍼스 필터 없음.

## Response 200

```jsonc
[
  { "rank": 1, "intraId": "gs_member", "campus": "GS", "completedCount": 3, "leaderCount": 0 },
  { "rank": 2, "intraId": "gs_leader", "campus": "GS", "completedCount": 0, "leaderCount": 2 }
]
```

`rank`는 1~5 연속값(공동 순위 없음). 골드/실버/브론즈 표기는 UI(Phase 3)가 `rank`로 결정한다. `avatar_url` 없음.

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 비로그인 | `FORBIDDEN` | 403 |
