# Contract: 단기 파티 마감 Lazy Filter (FR-020)

API 명세의 최종 권위는 `docs/trd.md` §4다. 이 문서는 `006`이 기존 두 엔드포인트에 더하는 **델타**만 정의한다. 신규 엔드포인트는 없다.

---

## 1. `GET /api/posts` — 모집 피드에서 제외

쿼리 파라미터·응답 필드는 그대로다(`specs/002-recruit-join-core/contracts/posts-list.md` + `specs/005-user-identity-schema/contracts/public-user.md`). 조회 결과 집합만 좁아진다.

| 조건 | 전환 전 | 전환 후 |
| :--- | :--- | :--- |
| `type='PARTY'`, `end_date`가 미래 | 포함 | 포함 |
| `type='PARTY'`, `end_date <= now()` | 포함 | **제외** |
| `type='PARTY'`, `end_date IS NULL` | 포함 | 포함 |
| `type='STUDY'`, `end_date` 과거 | 포함 | 포함 (대상 아님) |
| `type='LIVE'` | 기존 만료 필터 | 변경 없음 |

- `status` 값은 전이시키지 않는다. 제외된 글은 DB에서 여전히 `RECRUITING`이다.
- 만료용 배치(cron)를 두지 않는다.
- `GET /api/list`(CLI)는 같은 조회 경로를 쓰므로 함께 좁아진다. 출력 형식은 바뀌지 않는다.
- `GET /api/hall-of-fame`은 영향 없다. 단기 파티는 아카이빙 대상이 아니다.

## 2. `GET /api/posts/:id` — 영향 없음

마감된 파티도 200으로 열람할 수 있다. `chat_url` 마스킹 규칙은 불변이다(헌법 V). 화면은 응답의 `type`·`endDate`·`status`로 마감 상태를 판정해 표시한다.

## 3. `POST /api/posts/:id/join` — 마감된 파티 거절

```jsonc
// 요청: 변경 없음 (바디 없음)
// 마감일이 지난 PARTY에 비참여자가 요청한 경우
// HTTP 400
{ "error": "CLOSED" }
```

응답 바디는 기존 공통 핸들러 형식(`{ error: <코드> }`, `src/lib/errors.ts`)을 그대로 쓴다. **에러 메시지를 응답에 싣지 않는다** — 바디 형식을 바꾸면 Route Handler 전건과 기존 테스트가 함께 바뀐다. 따라서 "모집 마감"과 "마감일이 지난 파티"는 같은 `CLOSED` 코드로 오고, 화면이 이미 가진 글 정보(`type === 'PARTY'`와 지난 `endDate`)로 문장을 가린다 (`src/lib/error-message.ts`).

| 상황 | 결과 |
| :--- | :--- |
| 마감 지난 `PARTY`, 비참여자 | **400 `CLOSED`**. `current_members` 불변, `participants` 미생성 |
| 마감 지난 `PARTY`, 이미 `JOINED` | **200**. 기존 `chatUrl` 반환(멱등). 카운트 불변 |
| 마감 지난 `PARTY`, 리더 본인 | 리더는 `JOINED` 참여 행을 갖고 있으므로 위와 같이 200 |
| 마감 전 `PARTY` | 변경 없음 |
| `STUDY` | 변경 없음 |

- 새 에러 코드를 만들지 않는다. 기존 `CLOSED`(400)를 쓴다 (CLAUDE.md §8).
- 검증 위치는 멱등 반환 **뒤**, 정원 검증 **앞**이다 (data-model.md §3).

## 4. `POST /api/posts` — `PARTY` 마감일 정규화

| 입력 `endDate` | 저장되는 `end_date` |
| :--- | :--- |
| `"2026-10-14"` | `2026-10-14T14:59:59.999Z` (= KST 10/14 23:59:59.999) |
| `"2026-10-14T05:00:00Z"` | 같음 (같은 KST 날짜의 끝으로 올린다) |
| 생략 | `null` (만료 개념 없음) |
| `STUDY`의 `endDate` | 입력 무시, 자동 산출 (변경 없음) |

응답 형태는 바뀌지 않는다(`{ id, status, currentMembers }`).

## 관련 테스트

- `TC-PARTY-01` — 마감 지난 파티가 `GET /api/posts`·CLI 결과에서 0건.
- `TC-PARTY-02` — 마감 지난 파티 참여 시 400, 카운트 불변, 상세 조회는 200.
- 경계: `end_date`가 KST 23:59:59.999인 파티는 그 **1ms 전까지** 조회·참여가 되고, 경계 시각부터 둘 다 막힌다. LIVE 핑 만료(`expires_at > now`)와 같은 배타 비교를 쓴다 — 조회 필터에 연산자 2종이 섞이지 않게 맞췄다.
