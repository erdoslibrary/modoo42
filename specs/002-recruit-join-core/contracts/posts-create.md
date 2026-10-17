# Contract: POST /api/posts — 개설

**인증**: 필요(`getCurrentUser()` → null이면 참여 불가 취급). **대응**: FR-001, FR-002, FR-003. trd §4.

## Request (JSON)

```jsonc
{
  "type": "STUDY",                 // "STUDY" | "PARTY" (Phase 1)
  "templateId": "cote",            // 선택: cote|commit|reading|duolingo|music|custom
  "title": "코테 스터디",           // 1~40자 필수
  "tags": ["코딩테스트", "알고리즘"], // 1~3개 필수
  "locationType": "ONLINE",        // ONLINE|OFFLINE_GS|OFFLINE_SEOUL|HYBRID
  "place": "디스코드 음성채널",      // 선택
  "maxMembers": 6,                 // 2~10, 기본 10
  "chatUrl": "https://open.kakao.com/o/abc123", // 화이트리스트 필수
  "referenceUrl": "https://github.com/x/y",     // 선택, https://만
  "description": "주 3회",          // 0~300자 선택
  "endDate": "2026-11-30T00:00:00Z" // PARTY만 사용. STUDY는 보내도 무시
}
```

## 서버 처리
- `leaderId`·`currentMembers:1`·`status:'RECRUITING'`은 서버가 설정(클라 입력 무시).
- STUDY: `endDate`를 개설일 기준 자동 산출(1~14일→당월 말일, 15일~말일→익월 말일).
- 트랜잭션: `posts` insert → 같은 유저 `participants(JOINED)` insert(리더 자동 참여).

## Response 201

```jsonc
{ "id": "uuid", "status": "RECRUITING", "currentMembers": 1 }
```

## Errors
| 조건 | code | HTTP |
| :-- | :-- | :-- |
| title>40, tags>3 또는 0, maxMembers∉[2,10], chatUrl 화이트리스트 위반, referenceUrl 비 https | `BAD_REQUEST` | 400 |
| 미인증(세션 없음) | `FORBIDDEN` | 403 |

## 관련 테스트
TC-POST-01(정상), TC-POST-02(title 41자), TC-POST-03(정원 1/11), TC-POST-04(URL 도메인).
