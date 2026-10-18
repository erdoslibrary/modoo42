# Phase 1 Data Model: 대시보드 UI 결합 & 실시간 동기화

**DB 스키마는 바뀌지 않는다.** 테이블·컬럼·열거형을 추가하거나 고치지 않는다(req FR-019 "신규 테이블·컬럼을 추가하지 않는다"). 이 문서가 정의하는 것은 ① 화면이 읽는 뷰 모델 ② 저장값에서 표기값을 만드는 파생 규칙 ③ 쓰기 동작 1건의 정규화 ④ 조회 조건 변경이다.

---

## 1. 쓰기 동작 변경 — 단기 파티 `end_date` 정규화 (FR-020)

| 항목 | 현재 | 변경 후 |
| :--- | :--- | :--- |
| `PARTY` 개설 시 `end_date` | 입력값 그대로 (`z.coerce.date()` → `2026-10-14T00:00:00Z`) | 그 날짜의 **KST 23:59:59.999** (`2026-10-14T14:59:59.999Z`) |
| `STUDY` 개설 시 `end_date` | `computeStudyEndDate()` = 말일 KST 23:59:59.999 | 변경 없음 |
| 기존 행 | 그대로 둔다 | 마이그레이션·백필 없음 |

- 적용 지점: `createPost`(`src/lib/posts.ts`)가 `endOfKstDay()`를 통과시킨다.
- 신규 헬퍼: `endOfKstDay(date: Date): Date` — `src/lib/end-date.ts`. 입력 시각이 속한 KST 날짜의 끝을 UTC 시각으로 돌려준다. `kstDayRange(now).end - 1ms`와 같은 값이다.
- 기존 개발 데이터의 파티 `end_date`가 00:00 UTC로 남아 있어도 조회·참여 판정이 "그 날 오전에 마감"으로 보일 뿐이고 데이터 정합성은 깨지지 않는다. 필요하면 수동으로 고친다(`docs/next-steps.md` U9와 같은 범주).

## 2. 조회 조건 변경 — 모집 피드의 파티 마감 제외 (FR-020)

`listPosts`의 `where`에 조건 1건을 더한다. LIVE 핑 Lazy Filter 바로 옆에 같은 모양으로 둔다.

```text
기존: OR( type <> 'LIVE',  AND( status = 'RECRUITING', expires_at > now ) )
추가: OR( type <> 'PARTY', end_date IS NULL, end_date > now )
```

| 대상 | 결과 |
| :--- | :--- |
| `PARTY` · `end_date > now` | 포함 |
| `PARTY` · `end_date <= now` | **제외** (상태값은 건드리지 않는다) |
| `PARTY` · `end_date IS NULL` | 포함 (마감일 없는 파티는 만료 개념이 없다) |
| `STUDY` · `end_date` 과거 | 포함 (정규 스터디는 이 규칙의 대상이 아니다) |
| `LIVE` | 기존 만료 필터만 적용 |

- 파급: `listForCli`가 `listPosts`를 호출하므로 CLI 출력도 같이 맞는다(`src/lib/posts.ts:357`).
- 상세 조회(`getPostDetail`)는 제외하지 않는다. 마감된 파티도 링크로 열람할 수 있어야 한다(FR-042).
- 아카이브(`listHallOfFame`)는 `COMPLETED`·회고 보유 `STUDY`만 보므로 영향이 없다(FR-044).

## 3. 참여 검증 추가 — 마감된 파티 거절 (FR-043)

`joinPost`의 검증 순서에 1건을 끼운다. 자리는 **멱등 반환 다음, 정원 검증 앞**이다.

```text
1. 행 잠금 (FOR UPDATE)
2. 글 존재 확인                                → NOT_FOUND
3. LIVE 핑 참여 불가 (기존)                      → BAD_REQUEST
4. status = 'RECRUITING' (기존)                 → CLOSED
5. 기존 참여 멱등 반환 (기존)                     → 200 + chatUrl
6. [신규] type = 'PARTY' AND end_date <= now    → CLOSED
7. 정원 검증 (기존)                              → FULL
8. 기록 · 카운트 증가 (기존)
```

- 멱등 반환(5) **뒤**에 두는 이유: 이미 참여한 유저는 마감 여부와 무관하게 링크를 재열람할 수 있어야 한다(FR-021). 앞에 두면 마감된 파티의 기존 참여자가 자기 채팅방 링크를 잃는다.
- 에러 코드는 `CLOSED`(400)를 재사용한다. 유저에게 보이는 문장은 "마감일이 지난 파티입니다." (CLAUDE.md §8 표에 코드를 새로 만들지 않는다)

## 4. 뷰 모델

저장 스키마가 아니라 **화면이 받는 모양**이다. 괄호 안은 출처다.

### 4.1 `FeedCard` — 카드 1장 (출처: `GET /api/posts` / `listPosts`)

| 필드 | 출처 | 비고 |
| :--- | :--- | :--- |
| `id`·`type`·`title`·`tags`·`status` | 그대로 | |
| `currentMembers`·`maxMembers` | 그대로 | LIVE는 `maxMembers = null` |
| `place`·`locationType` | 그대로 | |
| `endDate`·`expiresAt` | 그대로 | 표기는 §5 파생 |
| `leader` | `{ login, campus }` | `campus`는 `null` 가능 |
| `chatPlatform` | `chat_url`에서 유도 | 전체 공개 |
| `referenceUrl` | 그대로 | 전체 공개 |
| ~~`chatUrl`~~ | **없음** | 리스트 응답에 애초에 없다 |

### 4.2 `PostDetail` — 상세 모달 (출처: `getPostDetail`)

`FeedCard`의 모든 필드 + `description`·`templateId`·`templateData`·`cancelReason`·`participants[]`(`{ login, campus }`) + **참여자에게만** `chatUrl`.

화면이 파생하는 값 3개:
- `viewerRole`: `leader` | `participant` | `guest` — `leader.login === me.login`, `participants`에 내가 있는지로 정한다.
- `joinability`: `open` | `full` | `closed` | `expired` | `final` — §6 표.
- `emptySeats`: `maxMembers - currentMembers` (0 이하면 표기 생략).

### 4.3 `ArchiveItem` — 아카이브 1줄 (출처: `GET /api/hall-of-fame`)

🏆 `kind=completed`: 제목·리더 `login`·완주 인원·`proofUrl`(있을 때만 `[결과물 ↗]`).
🪦 `kind=postmortem`: 제목·리더 `login`·`postmortemText`·작성 시각.

### 4.4 `LeaderboardRow` (출처: `GET /api/leaderboard`)

`rank`·`login`·`campus`·`completedCount`·`leaderCount`. **완주율은 없다** — 저장되지 않는 지표다(FR-012).

### 4.5 `ProfileView` (출처: `getProfile`, 신규 `src/lib/profile.ts`)

```text
ProfileView {
  login, campus,              // campus = null이면 뱃지 미렌더 (FR-038)
  initials,                   // §5.3
  completedCount, leaderCount,
  history: HistoryItem[]
}

HistoryItem {
  postId, title, type,
  category: 'COMPLETED' | 'LEADING' | 'ONGOING' | 'ENDED',
  isLeader: boolean,          // 카테고리와 별개로 '리더' 뱃지를 붙인다
  periodLabel,                // '26.09' (end_date 또는 created_at의 KST 연·월)
  headcountLabel,             // 완주 'N명 완주' / 진행 중 '4/6명'
  hasPostmortem: boolean      // 회고 뱃지
}
```

**분류 규칙** (위에서 아래로 처음 맞는 것 하나):

| 조건 | `category` |
| :--- | :--- |
| 참여 상태 `COMPLETED` | `COMPLETED` |
| 글 상태 `RECRUITING`·`CLOSED` 이고 참여 상태 `JOINED` | `ONGOING` |
| 그 외 (참여 상태 `INCOMPLETE`, 글 `CANCELLED`) | `ENDED` |

`isLeader = post.leaderId === userId`. 리더는 자기 글의 참여 행을 갖고 있으므로(FR-001 자동 참여) 같은 규칙으로 분류된다. `LEADING`은 리더가 진행 중인 글을 사이드 라벨로 구분할 때만 쓰고, 분류의 기본 축은 위 3종이다.

### 4.6 `RealtimeEvent` (출처: Supabase `postgres_changes`, trd §5)

payload에 실리는 컬럼은 복제 설정이 허용한 것만이다. **제목·태그·장소·초대 링크는 오지 않는다.**

| 이벤트 | payload 사용 필드 | 화면 처리 |
| :--- | :--- | :--- |
| `UPDATE` | `id`·`status`·`current_members`·`max_members`·`expires_at` | 같은 `id`의 카드에 머지. 없는 카드면 무시 |
| `INSERT` | `id`·`type`·`created_at` | `type = 'LIVE'`면 `GET /api/posts?type=LIVE`로 전광판 재조회. 그 외 유형은 무시(피드는 새로고침·재진입에서 반영) |
| `DELETE` | — | 삭제 경로가 없으므로 처리하지 않는다 |

## 5. 표기 파생 규칙 (`src/lib/display.ts`)

### 5.1 `remainingLabel(expiresAt, now)` — LIVE 남은 시간
`cli-format.ts`에서 이동. 1분 미만은 `1분 남음`으로 올림, 60분 미만 `N분 남음`, 이상은 `N시간` / `N시간 M분 남음`. **CLI 출력과 완전히 같은 문자열이어야 한다** (기존 CLI 테스트가 고정).

### 5.2 `ddayLabel(endDate, now)` — 파티 D-Day
`cli-format.ts`에서 이동. KST 날짜 차이로 계산하며 0 이하는 `D-Day`, 그 외 `D-N`.

### 5.3 `initials(login)` — 이니셜 뱃지
앞 2자를 취한다. 영문은 대문자로 올리고 숫자·하이픈 등은 그대로 둔다 (`borlee` → `BR`, `42-foo` → `42`). 1자 핸들은 1자만 반환한다 (CLAUDE.md §7.2).

### 5.4 `headcountLabel(current, max)` — 인원
`max`가 `null`이면 `null`을 돌려준다(LIVE는 인원 표기 없음). 그 외 `4/6명`.

### 5.5 `cycleLabel(endDate)` / `periodLabel(endDate)` — 기간 표기
정규 스터디 카드는 `26.11.1~11.30`(해당 월 1일~말일, `end_date`의 KST 연·월에서 산출), 프로필 이력은 `26.09`. `cycle` 컬럼은 어느 경로에서도 채워지지 않으므로 읽지 않는다.

### 5.6 캠퍼스 뱃지
`campus === 'GS'` → `42경산`, `'SEOUL'` → `42서울`, `null` → **렌더하지 않는다**(요소 자체를 만들지 않는다. 빈 괄호·구분자 금지). 기수 표기는 하지 않는다 (req §1.3).

## 6. 참여 가능 상태 (`joinability`)

| 글 상태 / 조건 | 비참여자 버튼 | 참여자 버튼 |
| :--- | :--- | :--- |
| `RECRUITING`, 자리 있음 | `[참여하기 ↗]` | `[오픈채팅 바로가기 ↗]` |
| `RECRUITING`, `PARTY`·마감일 지남 | `[마감]` 비활성 | `[오픈채팅 바로가기 ↗]` |
| `CLOSED` (정원·수동 마감) | `[모집 완료]` 비활성 | `[오픈채팅 바로가기 ↗]` |
| `COMPLETED` | `[완주 종료]` 비활성 | `[오픈채팅 바로가기 ↗]` |
| `CANCELLED` | `[취소된 모집]` 비활성 + `cancelReason` | 같음 |
| `LIVE` 유형 | 참여 버튼 없음 (찾아가기 전용) | 작성자에게만 `[완료]` |
| 비로그인 | `[로그인이 필요합니다]` 비활성 | — |

참여자는 어떤 상태에서도 링크를 재열람할 수 있다. 자진 취소 버튼은 어느 칸에도 없다 (req §1.2).

## 7. 영향 받는 기존 코드 지점

| 파일 | 변경 |
| :--- | :--- |
| `src/lib/posts.ts` | `createPost`(파티 `end_date` 정규화), `listPosts`(파티 마감 제외), `joinPost`(마감 거절) |
| `src/lib/end-date.ts` | `endOfKstDay` 추가 |
| `src/lib/cli-format.ts` | `remainingLabel`·`ddayLabel`을 `display.ts`에서 import (출력 문자열 불변) |
| `src/app/layout.tsx` | 폰트 교체, `metadata` 교체, 한국어 `lang` |
| `src/app/globals.css` | 토큰·`.nb`·`.px`·`pulse`·`.hs`로 교체, Next 기본값 제거 |
| `tailwind.config.ts` | 색·폰트 토큰 등록 |
| `src/app/page.tsx` | `/dashboard` 리다이렉트로 교체 |
| `src/app/fonts/Geist*.woff` | 삭제 |

신규 모듈: `src/lib/display.ts`, `src/lib/profile.ts`, `src/lib/supabase/client.ts`, `src/hooks/useRealtimePosts.ts`, `src/components/**`(화면 컴포넌트), `src/app/dashboard|create|profile/page.tsx`.
