# Data Model: LIVE 핑 & CLI 조회 (Phase 2 B)

스키마 변경 없음. `src/db/schema.ts`·`docs/trd.md` §3.2 그대로 쓴다. 매핑 근거는 [research.md](./research.md) R3.

## LIVE 핑 (`posts` where `type = 'LIVE'`)

| 필드 | 컬럼 | 규칙 |
| :--- | :--- | :--- |
| 작성자 | `leader_id` | 로그인 유저 |
| 내용 | `title` | 1~50자, 필수 (Zod) |
| 위치 | `place` | 1자 이상, 필수 (Zod) |
| 유효시간 | 입력 `durationMinutes` | `30 \| 60 \| 120 \| 180` 중 하나 |
| 만료 시각 | `expires_at` | `now + durationMinutes` |
| 장소 구분 | `location_type` | 작성자 캠퍼스로 `OFFLINE_GS` / `OFFLINE_SEOUL` (R4) |
| 정원 / 채팅 링크 / 참고 링크 / 설명 | `max_members` / `chat_url` / `reference_url` / `description` | `null` |
| 태그 | `tags` | `[]` |
| 인원 | `current_members` | 기본값 1, 변하지 않음 |
| 생성 시각 | `created_at` | 주입한 `now` (R2) |
| 상태 | `status` | `RECRUITING` 시작 |

참여자 행(`participants`)은 만들지 않는다 (R5).

### 상태 전이

```
RECRUITING --(작성자 조기 완료)--> CLOSED     최종. 재모집 불가.
RECRUITING --(expires_at 경과)--> (전이 없음, Lazy Filter로 목록 제외)
```

LIVE에 대한 참여·토글·수정·취소·판정·회고 → `BAD_REQUEST` (R6).

### 활성 판정 (Lazy Filter)

```
active(ping, now) := ping.status = 'RECRUITING' AND ping.expires_at > now
```

### 1일 1회 불변식

```
count(posts where leader_id = U and type = 'LIVE'
      and created_at in kstDayRange(now)) <= 1
```

상태(활성·완료·만료)와 무관하게 센다. 작성자 `users` 행 잠금으로 직렬화한다 (R1).

`kstDayRange(now)`: `now`의 KST 날짜 00:00:00.000 ~ 다음날 00:00:00.000(배타) 구간의 UTC 시각 쌍.

## CLI 목록 항목 (읽기 전용 투영)

| 필드 | LIVE 핑 | 단기 파티 | 정규 스터디 |
| :--- | :---: | :---: | :---: |
| `id` | O | O | O |
| `title` (LIVE는 내용) | O | O | O |
| `place` (LIVE는 위치) | O | O | O |
| `leader.intraId`, `leader.campus` | O | O | O |
| `tags` | - | O | O |
| `currentMembers` / `maxMembers` | - | O | O |
| `endDate` | - | O | O |
| `expiresAt` | O | - | - |

노출 대상: 활성 LIVE 핑, `RECRUITING` 파티, `RECRUITING` 스터디. `chat_url`·`description`·`reference_url`·`template_data`는 포함하지 않는다 (R12).
