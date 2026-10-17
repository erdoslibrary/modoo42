# Contract: GET /api/posts — 리스트 조회

**인증**: 필요. **대응**: trd §4 (Phase 1 & 3). Phase 1은 데이터만, 정렬/필터 UI는 Phase 3.

## Query params
| 파라미터 | 값 | 기본 |
| :-- | :-- | :-- |
| `type` | `STUDY`\|`PARTY` | 전체 |
| `status` | `RECRUITING`\|`CLOSED`\|`CANCELLED`\|`COMPLETED` | 전체 |
| `sort` | `latest`\|`deadline` | `latest` |

- 캠퍼스 필터 없음(헌법/CLAUDE.md §7.2). 단일 통합 피드.

## Response 200

```jsonc
{
  "posts": [
    {
      "id": "uuid", "type": "STUDY", "title": "...", "tags": ["..."],
      "locationType": "ONLINE", "place": "...", "maxMembers": 6,
      "currentMembers": 3, "status": "RECRUITING",
      "chatPlatform": "kakao", "endDate": "...",
      "leader": { "intraId": "gs_leader", "campus": "GS" }
      // chatUrl 미포함 (리스트는 전부 마스킹)
    }
  ]
}
```

## 규칙
- 리스트 응답은 참여 여부와 무관하게 `chatUrl`을 **절대 포함하지 않는다**. 링크는 상세 조회 참여자에게만.
- Phase 1 LIVE 핑 제외(Phase 2). `type` 미지정 시 STUDY/PARTY만.

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 미인증 | `FORBIDDEN` | 403 |
