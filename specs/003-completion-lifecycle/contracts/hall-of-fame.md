# Contract: GET /api/hall-of-fame — 명예의 전당 / Post-mortem 목록

**인증**: 필요(로그인 유저). **대응**: FR-015, FR-017. trd §4.

## Query

| 키 | 값 | 기본 |
| :-- | :-- | :-- |
| `kind` | `completed` \| `postmortem` | `completed` |

그 외 값 → `BAD_REQUEST`.

## 서버 처리

- `completed`: `type='STUDY' AND status='COMPLETED'`.
- `postmortem`: `type='STUDY' AND postmortem_text IS NOT NULL AND status <> 'CANCELLED'`.
- 정렬 `updated_at DESC`. 캠퍼스 필터 없음.

## Response 200

```jsonc
// kind=completed
[{
  "id": "uuid", "title": "born2solve 알고리즘 정복", "templateId": "coding-test",
  "endDate": "2026-10-31T14:59:59.999Z", "proofUrl": "https://github.com/..." /* 또는 null */,
  "leader": { "intraId": "gs_leader", "campus": "GS" },
  "completedMembers": [{ "intraId": "gs_member", "campus": "GS" }],
  "completedAt": "2026-10-20T03:00:00.000Z"
}]

// kind=postmortem
[{
  "id": "uuid", "title": "매일 1커밋 모각코", "templateId": "mogakco",
  "endDate": "2026-10-31T14:59:59.999Z",
  "leader": { "intraId": "gs_leader", "campus": "GS" },
  "postmortemText": "...", "writtenAt": "2026-10-20T03:00:00.000Z"
}]
```

`chatUrl`은 어느 항목에도 포함하지 않는다(SC-008). `completedMembers`는 리더 제외 `participants.status='COMPLETED'` 멤버.

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 잘못된 `kind` | `BAD_REQUEST` | 400 |
| 비로그인 | `FORBIDDEN` | 403 |
