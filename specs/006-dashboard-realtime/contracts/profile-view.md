# Contract: 프로필 조회 (`getProfile`) — FR-019

HTTP 엔드포인트가 아니다. 서버 컴포넌트가 직접 호출하는 **내부 조회 계약**이다(research R1·R13). 외부 표면을 늘리지 않으므로 `docs/trd.md` §4의 엔드포인트 표에 항목을 더하지 않는다.

```ts
// src/lib/profile.ts
getProfile(userId: string, database?: Database): Promise<ProfileView>
```

---

## 응답 모양

```jsonc
{
  "login": "borlee",
  "campus": "GS",            // null 가능 — null이면 뱃지를 렌더하지 않는다
  "initials": "BR",
  "completedCount": 12,
  "leaderCount": 4,
  "history": [
    {
      "postId": "…",
      "title": "알고리즘 매일 1문제 챌린지",
      "type": "STUDY",
      "category": "COMPLETED",
      "isLeader": true,
      "periodLabel": "26.09",
      "headcountLabel": "6명 완주",
      "hasPostmortem": false
    },
    {
      "postId": "…",
      "title": "매주 3문제, 코딩테스트 주 3회",
      "type": "STUDY",
      "category": "ONGOING",
      "isLeader": true,
      "periodLabel": "26.11",
      "headcountLabel": "4/6명",
      "hasPostmortem": false
    }
  ]
}
```

## 규칙

- **노출 필드는 공개 유저 투영을 넘지 않는다.** `id`·`github_id`·`intra_id`·`intra_verified_at`을 싣지 않는다 (`specs/005-user-identity-schema/contracts/public-user.md` FR-010).
- `avatar_url` 계열 필드는 존재하지 않는다. 표시는 `initials`뿐이다 (CLAUDE.md §7.2).
- `chat_url`을 싣지 않는다. 프로필은 참여 여부 판정을 하지 않는다(헌법 V).
- 신규 테이블·컬럼을 쓰지 않는다. `users` 1행 + `participants ⋈ posts` 조인 1회로 만든다 (req FR-019).
- `completedCount`·`leaderCount`는 `users`의 저장값을 그대로 읽는다. 이력에서 다시 세지 않는다 — 완주 판정(FR-008)이 가산한 값이 SSOT다.
- 정렬: `history`는 최신순(`end_date` 내림차순, `null`이면 `created_at`).

## 분류 규칙 (`category`)

위에서 아래로 처음 맞는 하나를 쓴다.

| 조건 | `category` | 화면 표기 |
| :--- | :--- | :--- |
| 참여 상태 `COMPLETED` | `COMPLETED` | `완주` |
| 글 상태 `RECRUITING`·`CLOSED` + 참여 상태 `JOINED` | `ONGOING` | `진행중` |
| 그 외 (참여 상태 `INCOMPLETE`, 글 `CANCELLED`) | `ENDED` | `종료` |

- `isLeader`는 분류와 독립이다. `post.leader_id === userId`이면 `true`이고 화면에 `리더` 뱃지를 덧붙인다.
- `hasPostmortem`은 `posts.postmortem_text`가 있으면 `true`다. 회고 등록은 상태 전이가 아니므로 분류를 바꾸지 않는다 (req FR-009).
- 참여 상태 `LEFT`·`REMOVED`는 구현하지 않는 미사용 값이므로 분기를 만들지 않는다 (req §1.2).

## 범위 밖

디자인 원본(`myprofile.html`)의 **개구리 도감·무지개 개구리 도감·획득 배지·자기소개·관심 태그·완주율**은 이 계약에 없다. 앞 3개는 `requirement.md` §1.3 보류이고, 뒤 3개는 저장되는 데이터가 없다 (spec FR-005).

## 검증

- 완주·리더·진행 중이 섞인 유저의 `history`가 `participants` 레코드와 1:1로 맞는다 (SC-007).
- `campus`가 `null`인 유저의 응답에 `campus: null`이 오고 화면에 뱃지 요소가 생성되지 않는다 (SC-005).
- 이력이 없는 유저는 `history: []`와 `completedCount: 0`·`leaderCount: 0`을 받는다.
