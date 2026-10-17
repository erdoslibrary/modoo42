# Phase 0 Data Model — users / posts / participants

스키마 원본은 `docs/trd.md` §3.2이며 `src/db/schema.ts`가 이를 그대로 구현한다. Phase 0은
세 테이블과 enum, 인덱스, 관계를 모두 생성하되, `posts`/`participants`의 쓰기 로직은
Phase 1 이후로 미룬다. (아래는 모델 정의 참고용 — 전체 코드는 trd.md §3.2.)

## Enums

| enum | 값 |
| :--- | :--- |
| `campus_type` | `GS`, `SEOUL` |
| `post_type` | `STUDY`, `PARTY`, `LIVE` |
| `post_status` | `RECRUITING`, `CLOSED`, `COMPLETED`, `CANCELLED` |
| `location_type` | `ONLINE`, `OFFLINE_GS`, `OFFLINE_SEOUL`, `HYBRID` |
| `participant_status` | `JOINED`, `LEFT`, `REMOVED`, `COMPLETED`, `INCOMPLETE` |

`participant_status`의 `LEFT`/`REMOVED`는 스키마에만 존재하는 미사용 값이다 (CLAUDE.md
§6.2). Phase 0은 정의만 하고, 어떤 Phase도 로직으로 쓰지 않는다.

## users

Phase 0에서 유일하게 쓰기가 발생하는 테이블(페르소나 Upsert).

| 필드 | 타입 | 제약 |
| :--- | :--- | :--- |
| `id` | uuid | PK, `defaultRandom()` |
| `intra_id` | text | unique, not null |
| `campus` | `campus_type` | not null |
| `completed_count` | integer | default 0, not null |
| `leader_count` | integer | default 0, not null |
| `created_at` / `updated_at` | timestamptz | `defaultNow()`, not null |

- **불변식**: `avatar_url` 컬럼 없음 (CLAUDE.md §7 — 외부 프로필 이미지 미수집). UI는
  `intra_id` 앞 2자리 영문 대문자 이니셜로 표기.
- **Phase 0 Seed(페르소나)**:

  | 페르소나 | intra_id | campus |
  | :--- | :--- | :--- |
  | `gs_leader` | (고정 값) | `GS` |
  | `gs_member` | (고정 값) | `GS` |
  | `seoul_cadet` | (고정 값) | `SEOUL` |
  | `guest` | — | 유저 없음(비로그인) |

  `getCurrentUser()` 최초 호출 시 해당 페르소나 레코드를 Upsert (research.md 결정 3).

## posts

Phase 0은 테이블·인덱스만 생성. 쓰기 로직 없음. 주요 컬럼: `leader_id`(FK → users,
`onDelete: restrict`), `type`, `template_id`, `template_data`(jsonb), `title`,
`tags`(text[]), `location_type`, `place`, `max_members`, `current_members`(default 1),
`cycle`, `end_date`, `expires_at`, `chat_url`, `reference_url`, `description`,
`status`(default `RECRUITING`), `proof_type`, `proof_url`, `postmortem_text`.

- **인덱스**: `posts_feed_idx` (type, status, created_at), `posts_live_ping_idx`
  (type, status, expires_at).
- **Phase 0 비범위**: 입력 검증(Zod), 상태 전이, `chat_url` 마스킹은 Phase 1 이후.

## participants

Phase 0은 테이블·인덱스만 생성. 쓰기 로직 없음. 컬럼: `post_id`(FK → posts,
`onDelete: cascade`), `user_id`(FK → users, `onDelete: cascade`), `status`(default
`JOINED`), `joined_at`.

- **인덱스**: `participants_post_user_idx` (post_id, user_id) **unique** — 멱등 참여의
  DB 방어선(Phase 1), `participants_user_id_idx` (user_id).

## 관계

- `users 1 — N posts` (leader)
- `users 1 — N participants`
- `posts 1 — N participants`

## 검증 규칙 매핑

Phase 0에서 강제되는 것은 DB 레벨 제약뿐이다 (not null, unique, FK, default). 값 범위
검증(`title` 40자, `max_members` 2~10, `chat_url` 화이트리스트 등 CLAUDE.md §7)은 Zod로
Phase 1에서 구현한다. Phase 0은 `zod` 설치와 `src/templates/types.ts` 토대까지만.
