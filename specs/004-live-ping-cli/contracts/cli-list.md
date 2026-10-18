# Contract: CLI 조회 — `GET /api/list`

## 인증

불필요. 쿠키를 읽지 않는다.

## Query

| 파라미터 | 값 | 기본 |
| :--- | :--- | :--- |
| `format` | `ansi` \| `plain` \| `json` | `ansi` |

허용 외 값 → 400 `BAD_REQUEST` (본문은 JSON 에러 규약).

## 공통 헤더

`Cache-Control: no-store`

## 노출 대상과 정렬

| 섹션 | 대상 | 정렬 |
| :--- | :--- | :--- |
| LIVE 핑 | 활성 핑 (Lazy Filter) | `expires_at` 오름차순 (만료 임박 먼저) |
| 단기 파티 | `type = 'PARTY' AND status = 'RECRUITING'` | `end_date` 오름차순 |
| 정규 스터디 | `type = 'STUDY' AND status = 'RECRUITING'` | `created_at` 내림차순 |

필드는 [data-model.md](../data-model.md) "CLI 목록 항목" 표를 따른다. `chatUrl`은 어떤 형식에도 없다.

## `format=json` — `200 application/json`

```json
{
  "generatedAt": "2026-10-18T05:00:00.000Z",
  "pings":   [{ "id": "…", "title": "…", "place": "클러스터 2층", "expiresAt": "…", "leader": { "intraId": "gs_leader", "campus": "GS" } }],
  "parties": [{ "id": "…", "title": "…", "place": "코엑스", "tags": ["해커톤"], "currentMembers": 1, "maxMembers": 4, "endDate": "…", "leader": { "intraId": "…", "campus": "SEOUL" } }],
  "studies": [{ "id": "…", "title": "…", "place": null, "tags": ["모각코"], "currentMembers": 3, "maxMembers": 10, "endDate": "…", "leader": { "intraId": "…", "campus": "GS" } }]
}
```

## `format=ansi|plain` — `200 text/plain; charset=utf-8`

형태 예시(`plain`):

```
모두의 42 — 2026-10-18 14:00 KST

[LIVE 핑] 2
  28분 남음  philosopher 데드락 30분 헬프 구합니다 @ 클러스터 2층  (gs_leader·GS)
  ...

[단기 파티] 1
  D-3  오픈소스 해커톤 팀원 모집  1/4명  #해커톤 @ 코엑스  (seoul_member·SEOUL)

[정규 스터디] 1
  born2solve 알고리즘 정복  3/10명  #코딩테스트  ~10/31  (gs_leader·GS)
```

- `ansi`는 같은 텍스트에 섹션 제목(굵게), 남은 시간·D-Day(액센트 색)만 SGR 코드로 감싼다. 끝에 리셋(`\x1b[0m`)한다.
- 남은 시간: `ceil((expiresAt - now) / 60000)`분. 60분 이상이면 `1시간 12분 남음`.
- D-Day: KST 날짜 차이. 당일이면 `D-Day`.
- 섹션이 비면 `  (없음)`. 세 섹션 모두 비면 본문에 `모집 중인 글이 없습니다.` 한 줄.
- 사용자 입력 문자열은 제어 문자를 제거한 뒤 출력한다 (research R11).

## 테스트 ID

TC-CLI-01 (비로그인 200, 대상 필터링, `chat_url` 부재, JSON/평문 동등성), 제어 문자 제거, 0건 안내, 잘못된 `format` 400.
