# Data Model: 코어 모집 & 참여 루프 (Phase 1)

스키마 SSOT는 `docs/trd.md` §3.2 / `src/db/schema.ts`. **Phase 1 신규 컬럼·마이그레이션 없음.** 아래는 Phase 1이 실제로 읽고 쓰는 필드·검증·상태 전이만 추린다.

## Entities

### Post (`posts`)

| 필드 | 타입 | Phase 1 쓰임 | 검증 (서버 Zod, 최종 방어선) |
| :--- | :--- | :--- | :--- |
| `id` | uuid PK | 자동 | — |
| `leaderId` | uuid FK→users | 개설자 = 현재 유저 | 서버가 세션에서 주입(클라 입력 아님) |
| `type` | enum | `STUDY` \| `PARTY` (LIVE는 Phase 2) | 둘 중 하나 |
| `templateId` | text? | 템플릿 버튼 선택값(`cote`/`commit`/`reading`/`duolingo`/`music`/`custom`) | 선택 |
| `title` | text | 필수 | 1~40자 |
| `tags` | text[] | 필수 | 1~3개 |
| `locationType` | enum | 필수 | `ONLINE`\|`OFFLINE_GS`\|`OFFLINE_SEOUL`\|`HYBRID` |
| `place` | text? | 상세 장소 | 선택(오프라인/하이브리드 시 권장) |
| `maxMembers` | int | 정원 | 2~10, 기본 10 |
| `currentMembers` | int | 개설 시 1 | 서버 관리(클라 입력 금지) |
| `endDate` | timestamptz? | STUDY=자동산출, PARTY=입력 | STUDY는 입력 무시, PARTY는 미래 시각 |
| `chatUrl` | text | 필수 | 화이트리스트 정규식(R3). **비참여자 응답서 제외** |
| `referenceUrl` | text? | 참고 링크 | `^https://` (선택, 전체 공개) |
| `description` | text? | 설명 | 0~300자 |
| `status` | enum | 상태 머신 | 아래 전이만 |
| `createdAt`/`updatedAt` | timestamptz | 자동 | — |

Phase 1 **미사용**(Phase 2+): `templateData`, `cycle`, `expiresAt`, `proofType`, `proofUrl`, `postmortemText`. 취소 사유는 아래 주의 참고.

> **취소 사유 저장 위치 주의**: FR-005/spec US5는 취소 사유 입력을 요구하나 `posts`에 전용 컬럼이 없다. Phase 1은 `postmortemText`를 전용 컬럼으로 전용(轉用)하지 않는다(그 필드는 완주 회고 의미). 대신 **취소 사유는 `description`에 접미(append)하지 않고**, 신규 컬럼 없이 처리하려면 옵션 둘 중 하나를 tasks에서 확정한다: (a) 취소 사유 필수 요구를 Phase 1에서 "선택·미저장(응답 메시지로만)"으로 축소, (b) `posts`에 `cancel_reason text` 컬럼 추가(스키마+trd §3.2 동반 수정). **기본 결정: (b) `cancel_reason` 컬럼 추가** — 사유 표출(참여자에게 취소 상태+사유)이 FR-005 검증 기준이므로 저장이 필요하다. → tasks에 스키마 보강 작업 포함.

### Participant (`participants`)

| 필드 | 타입 | Phase 1 쓰임 | 검증 |
| :--- | :--- | :--- | :--- |
| `id` | uuid PK | 자동 | — |
| `postId` | uuid FK→posts (cascade) | 필수 | — |
| `userId` | uuid FK→users (cascade) | 필수 | `(postId,userId)` unique(멱등 근거) |
| `status` | enum | Phase 1은 `JOINED`만 | `LEFT`/`REMOVED`/`COMPLETED`/`INCOMPLETE` 미사용 |
| `joinedAt` | timestamptz | 자동 | — |

### User (`users`)

Phase 1은 **읽기만**(리더/참여자 식별). `completedCount`/`leaderCount` 가산은 Phase 2. `getCurrentUser()`가 반환하는 Mock 페르소나 레코드 사용.

## State Machine (NFR-003)

```
          개설
            │
            ▼
      RECRUITING ◄──────────► CLOSED
         │   │    수동 토글(FR-004)  │
         │   └── 정원 도달 자동 ────►│
         │                          │
         └──────────┬───────────────┘
                    ▼
                CANCELLED  (최종, 리더 취소 FR-005)

  COMPLETED 전이는 Phase 2 (완주 판정). Phase 1은 진입 없음.
```

**Phase 1 전이 규칙**
- `RECRUITING → CLOSED`: 정원 도달(자동) 또는 리더 수동 마감.
- `CLOSED → RECRUITING`: 리더 재모집 토글만. (정원이 이미 찬 경우도 리더가 열 수 있으나, 즉시 참여는 정원 검증에 걸림)
- `RECRUITING | CLOSED → CANCELLED`: 리더 취소. **최종**.
- `CANCELLED`(및 Phase 2의 `COMPLETED`) 대상 참여·수정·취소·상태토글 → **400 BAD_REQUEST**.
- 참여 시도가 `RECRUITING`이 아니면 → **400 CLOSED**.

## Validation ↔ Error 매핑

| 위반 | AppError | HTTP |
| :--- | :--- | :--- |
| Zod 실패(길이/범위/URL/태그 수) | `BAD_REQUEST` | 400 |
| 최종상태 글 수정/취소/토글 | `BAD_REQUEST` | 400 |
| `RECRUITING` 아닌 글 참여 | `CLOSED` | 400 |
| 정원 초과 | `FULL` | 400 |
| 비리더의 수정/마감/취소 | `FORBIDDEN` | 403 |
| 없는 글 | `NOT_FOUND` | 404 |
