# Contract: PUT /api/posts/:id — 리더 게시글 수정

**인증**: 리더 본인. **대응**: FR-006(requirement)/FR-009(spec). trd §4.

## Request (JSON, 부분 수정 허용)

```jsonc
{
  "title": "새 제목",        // 1~40자
  "description": "새 설명",   // 0~300자
  "chatUrl": "https://discord.gg/xxxx", // 화이트리스트 재검증
  "place": "새 장소"
}
```
- 수정 가능 필드: `title`, `description`, `chatUrl`, `place`만. 그 외(type/maxMembers/endDate/status 등) 거부.

## Response 200

```jsonc
{ "id": "uuid", "updatedAt": "..." }
```

## 규칙
- `status === 'RECRUITING'`일 때만 수정 가능. 그 외 400.
- `chatUrl` 제공 시 화이트리스트 정규식 재검증.

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| 비 RECRUITING 상태 수정, Zod 위반 | `BAD_REQUEST` | 400 |
| 비리더 수정 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |

## 관련 테스트
TC-LEADER-01(비리더 403), 비 RECRUITING 수정 400.
