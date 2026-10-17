# Contract: GET /api/posts/:id — 상세 조회

**인증**: 필요. **대응**: FR-006(링크 가시성). trd §4.

## Response 200 (비참여자)

```jsonc
{
  "id": "uuid",
  "type": "STUDY",
  "title": "코테 스터디",
  "tags": ["코딩테스트"],
  "locationType": "ONLINE",
  "place": "디스코드",
  "maxMembers": 6,
  "currentMembers": 3,
  "status": "RECRUITING",
  "chatPlatform": "kakao",          // chatUrl에서 유도한 플랫폼 종류(전체 공개)
  "referenceUrl": "https://...",     // 전체 공개
  "description": "...",
  "endDate": "...",
  "leader": { "intraId": "gs_leader", "campus": "GS" },
  "participants": [ { "intraId": "gs_leader", "campus": "GS" } ]
  // chatUrl 키 없음 (마스킹)
}
```

## Response 200 (참여자 / 리더)
위와 동일 + `"chatUrl": "https://open.kakao.com/o/abc123"` 포함.

## 규칙
- 비참여자 응답에 `chatUrl` **키 자체를 제외**(null 치환 아님). 헌법 V.
- `chatPlatform`은 저장값이 아니라 `chatUrl`에서 유도(`kakao`|`discord`). 비참여자에게도 공개.
- 참여자 목록은 `avatar_url` 없이 `intraId`·`campus`만(이니셜 뱃지용).

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 없는 글 | `NOT_FOUND` | 404 |
| 미인증 | `FORBIDDEN` | 403 |

## 관련 테스트
SC-005(비참여자 chatUrl 미노출), 참여자 chatUrl 포함.
