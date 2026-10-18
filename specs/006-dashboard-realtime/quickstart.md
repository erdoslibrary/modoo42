# Quickstart: 006 대시보드 UI 결합 & 실시간 동기화 검증

구현 후 "정말 되는가"를 확인하는 절차다. 자동 테스트가 잡는 것(§2)과 사람이 눈으로 봐야 하는 것(§3~§6)을 나눠 적는다.

## 0. 사전 조건

```bash
cd /home/erdos/workspace/modoo42
pnpm install            # 의존성 변경 없음. lockfile 그대로여야 한다
```

`.env.local`에 다음 4개가 있어야 한다 — `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`. 외부 선행 작업 U2(복제 컬럼)·U3(공개 키)는 완료 상태다.

## 1. 게이트 (PR 전 필수)

```bash
pnpm lint
pnpm typecheck
pnpm test          # CI에 없다. 로컬 필수 게이트 (NFR-006)
pnpm build
pnpm drizzle-kit check
```

`drizzle-kit check`는 스키마를 바꾸지 않았으므로 그대로 통과해야 한다. 마이그레이션 신규 파일이 생겼다면 설계를 벗어난 것이다.

## 2. 자동 테스트가 덮는 범위

| 테스트 | 확인 |
| :--- | :--- |
| `TC-PARTY-01` | 마감일 지난 파티가 `listPosts`·CLI 결과에서 0건. 마감 전 파티·정규 스터디는 그대로 |
| `TC-PARTY-02` | 마감 지난 파티 참여 시 400 `CLOSED`, `current_members` 불변. 기존 참여자는 200 + `chatUrl` |
| `endOfKstDay` 경계 | KST 23:59:59.999까지 유효, +1ms에서 만료 |
| `display.ts` | `remainingLabel`·`ddayLabel`이 CLI 출력과 동일 문자열. `initials`가 `borlee→BR`, `42-foo→42`, 1자 핸들 처리 |
| `profile.ts` | 완주·진행 중·종료 분류와 `isLeader`가 참여 레코드와 일치 |
| 기존 전건 | 참여 동시성·상태 머신·완주 판정·CLI 출력이 깨지지 않음 |

## 3. 화면 수동 확인 (개발 서버)

```bash
pnpm dev     # http://localhost:3000 → /dashboard 로 리다이렉트
```

우하단 `[🛠 Mock Auth]`로 페르소나를 바꿔 가며 확인한다.

| # | 페르소나 | 확인 |
| :-- | :--- | :--- |
| 1 | `gs_leader` | 네 영역(LIVE 전광판·단기 파티 가로줄·정규 스터디 그리드·아카이브)이 보인다. 자기 LIVE 핑에만 `[완료]`가 있다 |
| 2 | `gs_leader` | 정규 스터디 `[최신순]`/`[마감임박순]` 전환이 순서를 바꾼다 |
| 3 | `github_only` | 카드·상세·프로필에 캠퍼스 뱃지가 **없고** 빈 괄호나 떠 있는 구분자가 없다 |
| 4 | `gs_member` | 남의 글 상세 모달에 초대 링크가 없다. 개발자 도구 Elements와 RSC payload를 검색해도 `open.kakao.com`·`discord.gg`가 나오지 않는다 |
| 5 | `gs_member` | `[참여하기]` → 확인 팝업 문구가 "정말 참여하시겠습니까? 참여 후에는 취소가 불가능하며 오픈채팅방으로 이동합니다."이고, 팝업을 닫으면 인원이 그대로다 |
| 6 | `gs_member` | `[확인]` → 인원 +1, 새 탭으로 채팅 링크. 같은 글을 다시 열면 `[오픈채팅 바로가기 ↗]`가 고정돼 있고 취소 버튼이 없다 |
| 7 | `guest`(로그아웃) | 로그인 필요 안내가 보이고 Mock 전환 입구가 있다. 빈 화면이 아니다 |
| 8 | 아무 페르소나 | `/create`에서 유형 3종 전환, 템플릿 버튼 6종, 정규 스터디 종료일이 읽기 전용 안내 |
| 9 | 아무 페르소나 | 제목 41자·태그 4개·`https://google.com` 링크를 넣으면 거절 사유가 화면에 보인다 |
| 10 | 같은 유저 2회 | LIVE 핑을 두 번 등록하면 하루 1회 제한 안내가 보인다 |
| 11 | 아무 페르소나 | `/profile`에 완주·리더 횟수와 이력 3구분이 보이고, 개구리 도감·배지 섹션은 없다 |

## 4. 실시간 확인 (브라우저 2개)

창 A는 `gs_leader`, 창 B는 `seoul_member`로 로그인한 뒤 둘 다 `/dashboard`를 열어 둔다.

| # | 동작 (창 B) | 창 A에서 1초 내 | 근거 |
| :-- | :--- | :--- | :--- |
| 1 | 정규 스터디에 참여 | 그 카드 인원 숫자 +1 (새로고침 없이) | NFR-004 |
| 2 | 마지막 한 자리를 채움 | 그 카드가 마감 상태로 바뀌고 참여 입구가 닫힘 | FR-033 |
| 3 | LIVE 핑 등록 | 전광판 맨 앞에 내용·위치·남은 시간이 채워진 핑 등장 | FR-032 |
| 4 | 자기 LIVE 핑 `[완료]` | 전광판에서 그 핑이 사라짐 | FR-011 |

**보안 확인(필수):** 창 A의 개발자 도구 → Network → WebSocket(`realtime`) 프레임을 열어 `chat_url`·`title`이 **오지 않는지** 확인한다. 보이면 즉시 중단하고 복제 컬럼 설정(U2)을 다시 적용한다.

**연결 끊김 확인:** 창 A에서 네트워크를 Offline으로 바꿔도 화면이 비워지지 않고, 다시 Online + 새로고침하면 최신 상태가 보인다 (FR-035).

## 5. 마감 파티 수동 확인

마감일이 지난 파티는 UI로 만들 수 없다(달력이 과거를 막는다). 임시 테스트 파일로 데이터를 만든 뒤 지운다 — 이 저장소의 임시 DB 조회 관례를 따른다.

1. `tests/tmp-party.test.ts`를 만들어 `end_date`를 어제로 둔 `PARTY` 1건을 삽입한다(트랜잭션 롤백 없이 커밋).
2. `/dashboard`에서 그 글이 **보이지 않음**을 확인한다. `curl localhost:3000/api/list`에도 없다.
3. 상세 주소(`/dashboard?post=<id>`)로 직접 열면 열람은 되고 버튼이 `[마감]` 비활성이다.
4. 확인 후 그 글과 참여 행을 지우고 임시 테스트 파일을 삭제한다. 참여 행을 먼저 지운다(`posts.leader_id`가 `restrict`).

## 6. 디자인 규칙 자가 점검

`.claude/rules/anti-ai-slop.md` 출력 전 점검 6항목을 그대로 돌린다. 이 브랜치에서 특히 보는 것:

- [ ] `linear-gradient`·`radial-gradient`가 0건인가 (`grep -r "gradient" src/`)
- [ ] 색 들어간 `box-shadow`나 `blur`가 0건인가 — 하드 섀도우는 `#18181b` + blur 0만
- [ ] `:hover`에 `transform`이 없는가. 이동은 `:active`에만 (`interactions.md` §4)
- [ ] `pulse` 키프레임이 LIVE 상태 점(지름 ≤10px) 외에 쓰이지 않는가
- [ ] 폰트가 Galmuri11·Pretendard인가. Geist·Arial 잔존 0건 (`grep -r "Geist\|Arial" src/`)
- [ ] 375px 폭에서 가로 페이지 스크롤이 없는가 (반응형: 원본 HTML의 `min-width:1280px`는 옮기지 않는다)

## 7. 끝내기 전

- `docs/next-steps.md`의 U3 실측 결과(공개 키 형식으로 구독이 되는지)를 기록했는가.
- `CLAUDE.md` §3 디렉터리 규약에 `src/hooks/`를 더했는가.
- 완주 판정·회고 화면으로 가는 버튼을 노출하지 않았는가 (FR-045, `FR-021`은 후속 브랜치).
