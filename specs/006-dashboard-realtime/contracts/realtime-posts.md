# Contract: 실시간 구독 (`posts-channel`) — FR-014 / NFR-004

HTTP 계약이 아니라 **브라우저 ↔ Supabase Realtime** 계약이다. 구현 원본은 `docs/trd.md` §5다.

---

## 1. 전제 — 공개 컬럼 (변경 금지)

```sql
-- 외부 선행 작업 U2 (next-steps.md §1)
alter publication supabase_realtime add table posts
  (id, type, status, current_members, max_members, expires_at, created_at, updated_at);

-- 실제 방어선: drizzle/0003_revoke_anon_chat_url.sql
revoke select on table posts from anon, authenticated;
grant select (id, type, max_members, current_members, expires_at, status, created_at, updated_at)
  on table posts to anon, authenticated;
```

- **실측 정정 (2026-10-18, T057/T064).** publication 컬럼 목록만으로는 payload가 걸러지지 않는다. 목록을 지정한 상태에서 anon 공개 키로 구독해 보니 `posts`의 **모든 컬럼**이 왔고 `chat_url`도 포함됐다. Supabase Realtime은 복제 슬롯을 `wal2json`으로 읽어 publication의 컬럼 목록을 적용하지 않고, `realtime.apply_rls`가 **컬럼 단위 SELECT 권한**으로 걸러낸다.
- 그래서 권한 마이그레이션(`0003`)이 이 계약의 전제다. 두 목록은 같게 유지한다 — 권한을 모두 걷어내면 레코드가 통째로 버려져 이벤트가 오지 않는다.
- **이 브랜치는 두 목록을 늘리지 않는다.** 컬럼을 더하면 브라우저 구독자에게 그 값이 그대로 브로드캐스트된다. 구독은 공개 키로 직접 붙기 때문에 Route Handler의 `chat_url` 마스킹을 거치지 않는다(헌법 V, trd §5).
- 권한 적용 후 payload에 `title`·`tags`·`place`·`description`·`chat_url`·`reference_url`은 **없다**(실측 확인).

## 2. 채널과 구독

| 항목 | 값 |
| :--- | :--- |
| 채널 이름 | `posts-channel` (전역 1개) |
| 이벤트 | `postgres_changes`, `schema: 'public'`, `table: 'posts'` |
| 수신 이벤트 | `INSERT`, `UPDATE` |
| 클라이언트 | `createBrowserClient`(`@supabase/ssr`) 싱글턴, `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| 구독 해제 | 훅 unmount 시 `removeChannel` |

## 3. 이벤트 처리 규칙

### `UPDATE`

```jsonc
{ "eventType": "UPDATE",
  "new": { "id": "…", "type": "STUDY", "status": "CLOSED",
           "current_members": 6, "max_members": 6,
           "expires_at": null, "updated_at": "…" } }
```

| 상황 | 처리 |
| :--- | :--- |
| 화면에 같은 `id` 카드가 있다 | `currentMembers`·`status`·`expiresAt`만 머지한다. 제목 등 기존 값은 유지 |
| 화면에 없는 `id` | 무시 (현재 탭·필터와 무관한 글) |
| `status`가 `CLOSED`·`COMPLETED`·`CANCELLED`로 바뀌었다 | 카드의 참여 입구를 닫고 상태 표기를 갱신 |
| `type='LIVE'`이고 `status='CLOSED'` | 전광판에서 그 핑을 제거 (조기 완료) |

### `INSERT`

```jsonc
{ "eventType": "INSERT",
  "new": { "id": "…", "type": "LIVE", "status": "RECRUITING",
           "current_members": 1, "max_members": null,
           "expires_at": "…", "created_at": "…" } }
```

| 상황 | 처리 |
| :--- | :--- |
| `type='LIVE'` | `GET /api/posts?type=LIVE`를 호출해 전광판 목록을 교체한다. payload만으로 그리지 않는다 |
| `type='STUDY'`·`'PARTY'` | 무시한다. 다음 진입·새로고침에서 반영된다 |
| 보강 조회가 실패했다 | 전광판을 바꾸지 않는다. 제목 없는 핑을 그리지 않는다 |

### `DELETE`

처리하지 않는다. 글 삭제 경로가 제품에 없다(취소는 `status` 전이다).

## 4. 성능·품질 기준

| 기준 | 값 |
| :--- | :--- |
| 반영 지연 | 1초 이내 (NFR-004) |
| 보강 조회 횟수 | LIVE `INSERT` 1건당 최대 1회 |
| 연결 실패·끊김 | 화면은 초기 서버 렌더 결과를 유지한다. 빈 목록으로 덮어쓰지 않는다 (FR-035) |
| 중복 이벤트 | 같은 `id`·같은 `updated_at`이 두 번 와도 결과가 같아야 한다(머지는 멱등) |

## 5. 검증

- 브라우저 2개로 참여·LIVE 등록·조기 완료를 교차 실행해 1초 내 반영을 확인한다(quickstart.md §4).
- 개발자 도구 Network의 WebSocket 프레임에서 `chat_url`·`title`이 오지 않는지 눈으로 확인한다. 프레임에 그 키가 보이면 즉시 중단하고 `0003` 권한 마이그레이션이 그 환경에 적용됐는지 확인한다(`has_column_privilege('anon','posts','chat_url','select')`가 `false`여야 한다). publication 컬럼 목록만 고쳐도 막히지 않는다.
- 구독 직후 1초 남짓은 이벤트가 유실될 수 있다(서버가 구독을 등록하는 시간). 실측에서 `SUBSCRIBED` 직후의 `INSERT`는 수신되지 않았고, 1.5초 뒤의 `INSERT`는 수신됐다. 초기 목록을 서버 렌더로 받는 설계가 이 구멍을 덮는다.

## 6. 전방 위험 (이 브랜치 범위 밖)

Phase 4에서 RLS를 켜면(`FR-017`) `postgres_changes` 구독이 RLS 평가를 받는다. `posts`에 구독 주체가 통과할 `SELECT` 정책이 없으면 이벤트가 조용히 끊긴다 — 에러가 아니라 무음 실패다. `FR-017` 작업에 "Realtime 구독용 SELECT 정책 점검"을 포함해야 한다. `docs/next-steps.md` §4에 항목으로 남긴다.
