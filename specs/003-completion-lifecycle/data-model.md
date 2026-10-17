# Data Model: 완주 라이프사이클 (Phase 2 A)

스키마 정의 원본은 `docs/trd.md` §3.2와 `src/db/schema.ts`다. 이 Phase는 **컬럼 추가·변경이 없다.** 아래는 이번에 처음 쓰는 컬럼과 그 규칙이다.

## Post (`posts`)

| 필드 | 이번 Phase 쓰임 | 규칙 |
| :-- | :-- | :-- |
| `template_id` | 개설 시 템플릿 지정 | `STUDY`만. 등록부에 있는 ID만 (R6) |
| `template_data` | 템플릿 특화 데이터 | 템플릿 `dataSchema`(strict) 통과값만 저장. 템플릿 없으면 `null` |
| `proof_type` | 증빙 유형 | 템플릿 지정 시 `defaultProofType`, 아니면 `null` (FR-003) |
| `proof_url` | 완주 증빙 링크 | 선택. 입력 시 `https://`만. 판정 확정 시 저장 |
| `postmortem_text` | 실패 회고 | 공백 제외 1~1000자. 덮어쓰기 허용. 값이 있으면 완주 판정 불가 (R9) |
| `status` | 판정 시 `COMPLETED` | 아래 상태 전이 참고 |
| `updated_at` | 판정·회고 시각 | 명예의 전당/Post-mortem 정렬 키 (R7) |

## Participant (`participants`)

| 필드 | 이번 Phase 쓰임 |
| :-- | :-- |
| `status` | 판정 확정 시 `JOINED` → `COMPLETED` 또는 `INCOMPLETE`. 리더 행은 `COMPLETED` (R5). `LEFT`/`REMOVED`는 계속 미사용 |

## User (`users`)

| 필드 | 이번 Phase 쓰임 |
| :-- | :-- |
| `completed_count` | 판정에서 완주로 체크된 멤버만 +1 (리더 제외) |
| `leader_count` | 판정 확정 시 리더 +1 |

랭킹 정렬: `completed_count DESC, leader_count DESC, intra_id ASC`, 두 값이 모두 0인 유저 제외, 상위 5명 (R8).

## Template (코드 정의, DB 테이블 아님)

`src/templates/types.ts`의 `StudyTemplate` 인터페이스를 그대로 쓴다. 6종 등록값:

| `id` | `title` | `defaultTags` | `defaultProofType` | `dataSchema` (전부 `.strict()`) |
| :-- | :-- | :-- | :-- | :-- |
| `coding-test` | 코딩테스트 | `['코딩테스트']` | `github` | `platform?: 'BOJ'\|'PROGRAMMERS'\|'LEETCODE'\|'OTHER'`, `weeklyGoal?: int 1~50` |
| `mogakco` | 모각코 | `['모각코']` | `github` | `weeklySessions?: int 1~7`, `timeSlot?: string ≤20` |
| `book` | 책 완독 | `['책 완독']` | `notion` | `bookTitle: string 1~60` (필수), `totalPages?: int 1~5000` |
| `duolingo` | 듀오링고 | `['듀오링고']` | `screenshot` | `language: string 1~20` (필수), `dailyXp?: int 1~1000` |
| `music` | 음악 감상 | `['음악 감상']` | `notion` | `genre?: string ≤20`, `weeklyAlbums?: int 1~20` |
| `free` | 자유 | `[]` | `link` | 없음 (데이터 보내면 400) |

`description`(기본 설명)은 각 템플릿 정의에 한국어 1~2문장으로 둔다. `CustomFormField`는 Phase 3에서 채운다.

## 상태 전이 (NFR-003, 이번 Phase 추가분)

```
RECRUITING | CLOSED  --[완주 판정: STUDY, 판정 창 안, 회고 없음, 완주 멤버 ≥1]-->  COMPLETED (최종)
RECRUITING | CLOSED  --[회고 등록: STUDY, 판정 창 시작 이후]-->  (상태 불변, postmortem_text만 기록)
```

- `COMPLETED`/`CANCELLED` → 어떤 전이도 없음. 참여·수정·취소·토글·판정·회고 전부 400.
- `PARTY`는 판정·회고 대상이 아니다(400).

## 판정 창 (R2)

`end_date`가 속한 KST 달을 M이라 하면:

- `opensAt` = M월 15일 00:00:00.000 KST
- `closesAt` = (M+1)월 10일 23:59:59.999 KST
- 판정 허용: `opensAt ≤ now ≤ closesAt`
- 회고 허용: `opensAt ≤ now` (종료 기한 없음)
