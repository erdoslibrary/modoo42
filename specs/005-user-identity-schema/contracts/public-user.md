# Contract: 공개 유저 투영 전환 (005)

적용 범위: 유저 정보를 응답에 싣는 엔드포인트 5건. API 명세의 최종 권위는 `docs/trd.md` §4다. 이 문서는 005 전환의 **델타**만 정의한다. 과거 Phase의 계약 문서(`specs/002-*/contracts/posts-list.md`·`posts-get.md`, `specs/003-*/contracts/hall-of-fame.md`·`leaderboard.md`, `specs/004-*/contracts/cli-list.md`)는 그 Phase의 스냅샷으로 남는다 (research R8).

---

## 공통 투영

```jsonc
// 전환 전
{ "intraId": "gs_leader", "campus": "GS" }

// 전환 후
{ "login": "gs_leader", "campus": "GS" }   // 42 추가 인증을 마친 유저
{ "login": "github_only", "campus": null } // GitHub 인증만 한 유저
```

규칙:

- 필드는 `login`과 `campus` 2개뿐이다. `intraId`는 **제거한다**(병행 노출 없음).
- `campus`는 `"GS"` · `"SEOUL"` · `null` 셋 중 하나다. 키는 항상 존재한다(값만 `null`).
- `id`·`github_id`·`intra_id`·`intra_verified_at`은 어떤 응답에도 싣지 않는다 (FR-010).
- `avatar_url` 계열 필드는 존재하지 않는다 (CLAUDE.md §7.2).

## 엔드포인트별 적용

| 엔드포인트 | 위치 | 전환 |
| :--- | :--- | :--- |
| `GET /api/posts` | `leader` | 공통 투영 적용 |
| `GET /api/posts/:id` | `leader`, `participants[]` | 공통 투영 적용. `chat_url` 마스킹 동작은 불변 (헌법 V) |
| `GET /api/list` (CLI, 비인증) | `leader` (JSON) / 작성자 라벨 (텍스트) | 공통 투영 적용 + 아래 텍스트 규칙 |
| `GET /api/hall-of-fame` | `leader`, `completedMembers[]` | 공통 투영 적용. 완주 멤버 정렬 키도 `login` 오름차순 |
| `GET /api/leaderboard` | 항목 자체가 투영 + `rank`·`completedCount`·`leaderCount` | 공통 투영 적용. **동률 타이브레이커를 `login` 오름차순으로 바꾼다** (FR-009) |

노출 필드 수는 늘지 않는다. 이름만 바뀐다.

## CLI 텍스트 작성자 라벨 (`GET /api/list?format=ansi|plain`)

| 작성자 | 전환 전 | 전환 후 |
| :--- | :--- | :--- |
| 캠퍼스 있음 | `(gs_leader·GS)` | `(gs_leader·GS)` |
| 캠퍼스 없음 | (해당 없음) | `(github_only)` |

- 캠퍼스가 `null`이면 구분자 `·`와 캠퍼스를 **함께** 생략한다. `(github_only·)` 같은 흔적을 남기지 않는다 (FR-011).
- 터미널 제어 문자 제거(`stripControl`)는 `login`에도 그대로 적용한다. 다른 출력 형식(남은 시간·D-Day·태그·장소·인원)은 바꾸지 않는다.

## JSON 응답 예 (`GET /api/list?format=json`)

```jsonc
{
  "generatedAt": "2026-10-18T03:00:00.000Z",
  "pings": [
    {
      "id": "…",
      "title": "philosopher 데드락 헬프",
      "place": "클러스터 2층",
      "tags": [],
      "currentMembers": 1,
      "maxMembers": null,
      "endDate": null,
      "expiresAt": "2026-10-18T04:00:00.000Z",
      "leader": { "login": "github_only", "campus": null }
    }
  ],
  "parties": [],
  "studies": []
}
```

`chat_url`은 어떤 형식에서도 포함하지 않는다 (불변, 헌법 V).

## 호환성

파괴적 변경이다. 과도기 호환 필드를 두지 않는 근거는 research R8에 있다 — 이 응답을 읽는 클라이언트가 아직 없고(화면은 `006-dashboard-realtime`에서 포팅), 유일한 소비자인 CLI 포매터를 같은 PR에서 함께 고친다.
