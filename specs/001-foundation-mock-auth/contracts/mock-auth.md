# Contract — `/api/mock-auth` (개발 환경 전용)

Phase 0이 노출하는 유일한 외부 인터페이스. 개발 환경에서만 동작한다
(`NODE_ENV === 'development'`). 상용에서는 모든 메서드가 차단된다.

관련: FR-001, FR-002, FR-004, FR-005 / US1, US2.

## 공통 동작

- **상용 차단**: `NODE_ENV !== 'development'`이면 모든 요청을 거부한다 (세션 변경 없음).
  차단 응답은 `404 NOT_FOUND` (엔드포인트 미존재처럼 취급).
- **쿠키**: 이름 `modoo42_mock_user`. 값은 페르소나 문자열. `HttpOnly` 불필요(개발
  편의), 상용엔 어차피 없음.

## POST `/api/mock-auth`

페르소나를 세팅하거나 로그아웃한다.

**Request body**

```json
{ "persona": "gs_leader" }
```

- `persona`: `"gs_leader" | "gs_member" | "seoul_member" | "guest"` 중 하나.

**동작**

| persona | 결과 |
| :--- | :--- |
| `gs_leader` / `gs_member` / `seoul_member` | `modoo42_mock_user` 쿠키를 해당 값으로 세팅. 200. |
| `guest` | 쿠키 삭제(로그아웃). 200. |
| 그 외/누락 | `400 BAD_REQUEST`. 기존 세션 유지 (FR-005). |

**Response 200**

```json
{ "persona": "gs_leader" }
```

클라이언트는 200 수신 후 페이지를 즉시 갱신한다 (FR-002).

**Response 400** — 알 수 없는 페르소나

```json
{ "error": "BAD_REQUEST" }
```

**Response 404** — 상용 환경

세션 불변. 바디는 표준 not-found.

## 세션 조회 (내부, 엔드포인트 아님)

`getCurrentUser()` — 서버 측 함수. HTTP 계약 아님. `src/lib/auth.ts`.

- `modoo42_mock_user` 쿠키를 읽어 해당 페르소나의 `users` 레코드를 반환(없으면 Upsert).
- 쿠키 없음/`guest`/손상/알 수 없는 값 → `null` 반환(비로그인). 예외를 던지지 않는다
  (Edge Case).
- 비개발 환경에서는 Mock 경로를 타지 않는다(Phase 4에서 OAuth 세션으로 대체).

## 검증 시나리오 (quickstart 참조)

1. `gs_leader` POST → 쿠키 세팅, `getCurrentUser()`가 GS 리더 반환.
2. `guest` POST → 쿠키 삭제, `getCurrentUser()`가 `null`.
3. 알 수 없는 persona POST → 400, 쿠키 불변.
4. 상용 모드 POST → 404, 쿠키 불변.
