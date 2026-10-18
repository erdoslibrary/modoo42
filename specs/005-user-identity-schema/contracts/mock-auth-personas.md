# Contract: Mock 인증 페르소나 4종 (005)

전환 전 계약은 `specs/001-foundation-mock-auth/contracts/mock-auth.md`다. 이 문서는 델타만 정의한다. 요구사항 원본은 `docs/requirement.md` FR-000(이 PR에서 4종으로 갱신)과 `docs/trd.md` §2.1이다.

---

## 페르소나 정의

| 키 | 라벨 (UI) | `github_id` | `login` | `campus` |
| :--- | :--- | :--- | :--- | :--- |
| `gs_leader` | GS 리더 | `mock:gs_leader` | `gs_leader` | `GS` |
| `gs_member` | GS 멤버 | `mock:gs_member` | `gs_member` | `GS` |
| `seoul_member` | SEOUL 멤버 | `mock:seoul_member` | `seoul_member` | `SEOUL` |
| `github_only` | GitHub 전용 (캠퍼스 없음) | `mock:github_only` | `github_only` | `null` |

- `intra_id`와 `intra_verified_at`은 페르소나가 채우지 않는다 (research R4).
- 정의는 `src/lib/personas.ts` 한 곳에만 둔다. 세션 해석(`src/lib/auth.ts`)과 선택 UI(`src/components/MockAuthModal.tsx`)가 같은 정의를 읽는다 (FR-012b).

## `POST /api/mock-auth`

| 요청 `persona` | 응답 | 쿠키 `modoo42_mock_user` |
| :--- | :--- | :--- |
| 위 표의 키 4종 | `200 { "persona": "<키>" }` | 해당 키로 설정 (`path=/`, `sameSite=lax`) |
| `"guest"` | `200 { "persona": "guest" }` | 삭제 (비로그인) |
| 미지값·누락·손상 | `400 { "error": "BAD_REQUEST" }` | 기존 세션 유지 |
| (상용 환경) 모든 요청 | `404 { "error": "NOT_FOUND" }` | 변화 없음 |

전환 전과 달라지는 것은 허용 키가 3종에서 4종이 된 것뿐이다. 상태 코드와 쿠키 규약은 불변이다.

## 세션 해석 (`resolvePersonaUser`)

- 유효 페르소나: `github_id` 기준 Upsert 후 해당 `users` 행을 반환한다. 충돌 기준이 `intra_id`에서 `github_id`로 바뀐다 (research R4).
- 같은 페르소나를 여러 번 해석해도 행이 하나다(멱등). 호출마다 새 행을 만들지 않는다.
- `guest`·없음·손상·미지값: `null`(비로그인)을 반환하고 예외를 던지지 않는다. 불변.
- 백필된 기존 3행의 `github_id`가 위 표와 일치하므로 전환 후 첫 해석이 기존 행에 붙는다.

## 환경 차단 (불변, 헌법 V)

- `/api/mock-auth`는 `NODE_ENV !== 'development'`에서 404다.
- `MockAuthModal`은 `NODE_ENV !== 'development'`에서 렌더되지 않는다.
- 서버·클라이언트 양쪽 차단을 유지한다. 페르소나가 4종이 되어도 차단 조건은 바뀌지 않는다.

## 검증

`github_only`로 전환한 세션에서:

1. 세션 유저의 `campus`가 `null`이다 (TC-IDENT-05).
2. LIVE 핑을 등록하면 `location_type = 'OFFLINE_ETC'`로 저장된다 (TC-IDENT-02).
3. 글 작성·참여가 캠퍼스 부재로 거부되지 않는다 (SC-001).
