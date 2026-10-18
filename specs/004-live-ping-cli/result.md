---
description: "Implementation result for LIVE 핑 & CLI 조회 (Phase 2 B)"
---

# 구현 결과: LIVE 핑 & CLI 조회 (Phase 2 B)

**Branch**: `004-live-ping-cli` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md) | **Tasks**: [tasks.md](./tasks.md)

**상태**: 29개 태스크 전부 완료. 검증 게이트 전부 통과. 커밋 미생성(작업 트리에 남김).

---

## 1. 요약

LIVE 핑(FR-011)과 터미널 CLI 조회(FR-012)를 구현했다. DB 마이그레이션은 없다 — Phase 0 스키마의 `posts.expires_at`, `posts_live_ping_idx`, nullable `max_members`/`chat_url`을 그대로 썼다.

핵심 설계 3가지:

1. **1일 1회 제한**(KST 자정 기준)은 작성자 `users` 행을 `FOR UPDATE`로 잠가 직렬화한다. 동시 요청 10건에서도 1건만 생성된다.
2. **만료 처리**는 상태 전이가 아니라 `listPosts` 한 곳의 Lazy Filter다. cron이 없고, 웹 목록과 CLI가 같은 규칙을 공유한다.
3. **CLI 텍스트 렌더링**은 DB와 무관한 순수 모듈 `src/lib/cli-format.ts`로 분리했다.

---

## 2. 검증 결과

| 게이트 | 결과 |
| :--- | :--- |
| `pnpm test` | 24 파일 / **183 테스트 통과** (구현 시작 시점 17 파일 / 99 테스트 → 회귀 0) |
| `pnpm lint` | `✔ No ESLint warnings or errors` |
| `pnpm typecheck` | 통과 (출력 없음) |
| `pnpm drizzle-kit check` | `Everything's fine` (스키마 변경 없음) |

### 커버리지 (NFR-006: 핵심 도메인 90% 이상)

| 파일 | % Stmts | % Branch | % Lines |
| :--- | ---: | ---: | ---: |
| `src/app/api/list/route.ts` | 100 | 100 | 100 |
| `src/app/api/posts/[id]/complete-ping/route.ts` | 100 | 100 | 100 |
| `src/lib/cli-format.ts` | 100 | 97.36 | 100 |
| `src/lib/end-date.ts` | 100 | 100 | 100 |
| `src/lib/posts.ts` | 95.5 | 88.58 | 99.36 |

### 수동 검증 (quickstart.md, 개발 서버 + curl)

| 단계 | 기대 | 실제 |
| :--- | :--- | :--- |
| LIVE 핑 생성 | 201 + `expiresAt` | `{"id":"…","status":"RECRUITING","expiresAt":"…"}` ✅ |
| 같은 날 재생성 | 400 | 400 ✅ |
| `GET /api/list` (기본) | ANSI 텍스트 | SGR 코드 포함 텍스트 ✅ |
| `?format=plain` | 평문 | 제어 문자 없음 ✅ |
| `?format=json` | 구조화 JSON | `{generatedAt, pings, parties, studies}` ✅ |
| `?format=xml` | 400 | 400 ✅ |
| 응답 헤더 | `no-store` | `cache-control: no-store` ✅ |
| 링크 노출 | 0건 | `open.kakao`/`discord.gg`/`chatUrl` 0건 ✅ |
| 타인 조기 완료 | 403 | 403 ✅ |
| 작성자 조기 완료 | `CLOSED` | `{"status":"CLOSED"}` ✅ |
| 완료 재호출 | 멱등 200 | `{"status":"CLOSED"}` ✅ |
| 완료 후 목록 | 제외 | `모집 중인 글이 없습니다.` ✅ |

검증용으로 만든 LIVE 핑 1행(`9984d28b-…`)은 확인 후 삭제했다. 공용 DB에 잔여 데이터 없음.

---

## 3. 변경 파일

### 신규 (10개, 1,309줄)

| 파일 | 줄 | 역할 |
| :--- | ---: | :--- |
| `src/lib/cli-format.ts` | 127 | CLI 텍스트 렌더러 + `stripControl`. DB import 없는 순수 모듈 |
| `src/app/api/list/route.ts` | 53 | 비인증 CLI 조회. `format` 파싱, 방어적 투영, `no-store` |
| `src/app/api/posts/[id]/complete-ping/route.ts` | 18 | LIVE 핑 조기 완료 |
| `tests/posts-live.test.ts` | 482 | TC-LIVE-01~03, TC-CLI-01, 쓰기 차단, 동시 생성 |
| `tests/lib/cli-format.test.ts` | 206 | 렌더링·남은 시간·D-Day·제어 문자·ANSI |
| `tests/api/cli-list.test.ts` | 119 | TC-CLI-01 라우트 레벨 |
| `tests/posts-list.test.ts` | 106 | TC-LIVE-04 Lazy Filter |
| `tests/api/posts-create-live.test.ts` | 82 | `POST /api/posts` LIVE 분기 |
| `tests/lib/validation.test.ts` | 59 | LIVE 입력 Zod 경계 |
| `tests/api/posts-complete-ping.test.ts` | 57 | 조기 완료 라우트 |

### 수정 (9개, +277 / −41)

| 파일 | 변경 |
| :--- | :--- |
| `src/lib/posts.ts` | `createLivePing`·`completeLivePing`·`listForCli` 추가. `listPosts`에 Lazy Filter·`now` 주입·`expiresAt`. `getPostDetail`에 `expiresAt`. `joinPost`/`updatePost`/`cancelPost`/`toggleStatus`에 `assertNotLivePing` 가드 |
| `src/lib/end-date.ts` | `kstDayRange(now)`, `toKstWall(date)` 추가 |
| `src/lib/validation.ts` | `createLivePingSchema`(strict), `createPostRequestSchema`(판별 유니온) 추가 |
| `src/app/api/posts/route.ts` | POST에 `type === 'LIVE'` 분기, GET `type` 쿼리에 `LIVE` 허용 |
| `tests/lib/end-date.test.ts` | `kstDayRange` 경계 5건 추가 |
| `tests/posts-detail.test.ts` | STUDY 상세 `expiresAt === null` 단언 1줄 추가 |
| `docs/trd.md` | §4 표 `POST /api/posts` 행에 LIVE 요청 형식 명시 |
| `CLAUDE.md` | §7.1 LIVE `duration` 항목에 API 필드명 `durationMinutes` 병기 |
| `specs/004-live-ping-cli/tasks.md` | 29개 태스크 `[X]` 체크 |

---

## 4. 구현 세부

### 4.1 LIVE 핑 저장 매핑 (마이그레이션 없음)

| LIVE 개념 | 컬럼 | 값 |
| :--- | :--- | :--- |
| 내용 (≤50자) | `title` | 입력 `text` |
| 위치 (필수) | `place` | 입력 `place` |
| 유효시간 | `expires_at` | `now + durationMinutes` |
| 장소 구분 | `location_type` | 작성자 캠퍼스 → `OFFLINE_GS` / `OFFLINE_SEOUL` |
| 정원·채팅 링크·참고 링크·설명·템플릿 | `max_members` 등 | `null` |
| 태그 | `tags` | `[]` |
| 참여자 | `participants` | 행 생성하지 않음 |

### 4.2 상태 머신

```
RECRUITING --(작성자 조기 완료)--> CLOSED     최종. 재모집 불가.
RECRUITING --(expires_at 경과)--> 전이 없음. 목록에서만 제외 (Lazy Filter).
```

`assertNotLivePing`을 `NOT_FOUND` 직후·권한 검사 전에 두어, LIVE 핑에 대한 참여·수정·취소·마감 토글을 400으로 거부한다. 특히 `toggleStatus`를 막아야 `CLOSED` 핑이 `RECRUITING`으로 되돌아가는 것을 방지할 수 있다 — 되돌아가면 1일 1회 제한과 조기 완료의 의미가 깨진다.

### 4.3 CLI 응답

`GET /api/list?format=ansi|plain|json` (기본 `ansi`). 섹션 순서는 휘발성 순이다.

```
모두의 42 — 2026-10-18 10:45 KST

[LIVE 핑] 1
  30분 남음  philosopher 데드락 헬프  @ 클러스터 2층  (gs_leader·GS)

[단기 파티] 0
  (없음)

[정규 스터디] 0
  (없음)
```

정렬: 핑은 만료 임박순, 파티는 `end_date` 오름차순(D-Day), 스터디는 최신순.

---

## 5. 계획과 달라진 점

| 항목 | plan/tasks | 실제 | 이유 |
| :--- | :--- | :--- | :--- |
| 동시성 테스트 위치 | `tests/posts-live.test.ts` 1일 1회 describe 안 | 파일 **맨 끝** 별도 describe | 아래 5.1 |
| `toKstWall` | "필요하면 추가" | 추가함 (`end-date.ts` export) | CLI 헤더·D-Day·`~M/D` 포맷에 KST 환산이 필요 |
| `.eslintignore` | speckit 절차상 생성/확인 대상 | **만들지 않음** | `next lint`가 `node_modules`/`.next`/`out`/`build`를 기본 제외하고 lint가 통과한다. 불필요한 설정 파일이다 |

### 5.1 동시성 테스트 배치 (테스트 하네스 제약)

`createRacePool`로 두 번째 커넥션 풀을 열면, 이후 공유 `testClient`를 쓰는 테스트가 다음 오류로 깨진다:

```
PostgresError: prepared statement "6873ou3ui533" does not exist
```

원인은 `DATABASE_URL`이 Supabase **트랜잭션 풀러(포트 6543)**라는 점이다. 새 풀을 열면 pgbouncer가 서버 커넥션을 재배치하고, `testClient`가 캐시해 둔 prepared statement가 무효화된다. 격리 실행(`-t`)하면 통과하고, 같은 2건이 반복적으로 실패해 로직 버그가 아님을 확인했다.

기존 `tests/posts-join.test.ts`도 `TC-RACE-01`을 파일 맨 끝에 두고 있다. 같은 규칙을 적용하고 파일에 주석으로 근거를 남겼다. **앞으로 race pool을 쓰는 테스트는 파일 맨 끝에 둬야 한다.**

---

## 6. 잔여 위험 / 후속 작업

### 보안

`GET /api/list`는 인증이 없다. Phase 4 Rate Limit(NFR-005)이 들어가기 전까지 호출 횟수 제한이 전혀 없으므로 무제한 스크래핑이 가능하다. 이 엔드포인트는 사용자 결정(spec FR-009 옵션 A)에 따라 작성자 intra ID와 LIVE 핑의 물리적 위치(예: "클러스터 2층")를 공개한다. 즉 **외부인이 특정 카뎃의 실시간 위치를 조회할 수 있다.** 노출 범위는 최대 3시간 휘발 정보로 한정되고 `chat_url`·설명·참고 링크는 제외했지만, Phase 4에서 Rate Limit을 걸 때 이 엔드포인트를 우선 대상으로 삼아야 한다.

### 범위 밖 (후속 Phase)

- 전광판 UI·남은 시간 카운트다운 렌더링, Realtime prepend → Phase 3 (FR-013, FR-014)
- Rate Limit → Phase 4 (NFR-005)
- 지역 기반(Geo) 핑 확장 → 미정
- 단기 파티 `end_date` 도래 시 `CLOSED` 자동 종료 → 요구사항 FR 미배정 (이전 Phase에서 확인된 공백, 그대로 남음)

---

## 7. 다음 단계

작업 트리에 커밋되지 않은 변경이 남아 있다. 사양 문서는 `c26ffbb`로 이미 커밋됐고, 이번 구현분(§3)이 미커밋 상태다.

```bash
# 커밋 후 PR
git add -A
git commit   # feat(live): Phase 2 B LIVE 핑 및 CLI 조회 구현
gh pr create --base main
```
