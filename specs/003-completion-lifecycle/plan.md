# Implementation Plan: 완주 라이프사이클 (Phase 2 A)

**Branch**: `003-completion-lifecycle` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-completion-lifecycle/spec.md`

## Summary

정규 스터디 전용 완주 벌크 판정(리더·완주자 카운트 원자적 가산)·Post-mortem 수동 등록·명예의 전당/Post-mortem 목록 조회·성실 멤버 랭킹(TOP 5)·템플릿 플러그인 6종 등록 및 특화 데이터(`template_data`) 검증을 구현한다. 모든 로직은 Phase 1과 같은 패턴으로 `src/lib/posts.ts`(완주/회고/판정 조회)와 신규 `src/lib/templates.ts`(특화 데이터 Zod 검증) · `src/templates/registry.ts`(6종 프리셋 등록)에 둔다. DB 스키마는 Phase 0에서 이미 완성돼 있어 마이그레이션은 없다.

## Technical Context

**Language/Version**: TypeScript 5.x / Node (Next.js 14 App Router)

**Primary Dependencies**: Drizzle ORM, `postgres` 드라이버, Zod, Vitest. (전부 기존 설치됨, 신규 의존성 없음)

**Storage**: Supabase PostgreSQL. `posts.template_id`/`template_data`/`proof_type`/`proof_url`/`postmortem_text`, `users.completed_count`/`leader_count`, `participants.status`(`COMPLETED`/`INCOMPLETE`) 전부 Phase 0 스키마에 이미 존재. **마이그레이션 없음.**

**Testing**: Vitest. `.env.local`의 `DATABASE_URL`로 실제 Supabase에 접속, 트랜잭션 롤백으로 격리(TRUNCATE 금지).

**Target Platform**: Vercel (Next.js Route Handlers)

**Project Type**: Web (Next.js 단일 앱). Phase 2 A도 서버(API + 도메인)만. UI는 Phase 3.

**Performance Goals**: 동일 글에 판정 요청 동시 2건 → 가산 정확히 1회(FR-011, 참여 동시성과 동일한 락 전략).

**Constraints**: 서버 Zod가 최종 방어선. `COMPLETED`/`CANCELLED`는 역전 불가. 명예의 전당/Post-mortem/랭킹 응답은 `chat_url` 미노출.

**Scale/Scope**: Phase 2 A FR-001~017, SC-001~009. 엔드포인트 5종 + 템플릿 목록 1종.

## Constitution Check

*GATE: Phase 0 research 전 통과 필수. Phase 1 design 후 재검증.*

| 원칙 | 준수 방법 | 상태 |
| :--- | :--- | :--- |
| I. 사양 주도·테스트 우선 (NON-NEGOTIABLE) | 본 plan은 specify 산출물 위에 작성. 완주 판정/상태 머신/권한/템플릿 검증은 TDD, `describe`/`it`에 TC ID(`TC-COMPLETE-01`, `TC-COMPLETE-02`, `TC-LEADER-01`) 사용. 커버리지 90%+. | ✅ |
| II. 문서 SSOT 우선 | spec 작성 중 발견한 2건 충돌(단기 파티 판정 여부, 랭킹 정렬 기준)을 `docs/requirement.md`·`CLAUDE.md`·`docs/trd.md`에서 먼저 정정(완료, 2026-10-18). trd §4 API 표에 `GET /api/templates` 행 누락 → 이번 PR에서 추가. trd §4.2 `completeStudy` 예시 코드에 행 락이 없음 → research R1에서 보강안 확정 후 trd 동반 수정. | ⚠️ trd §4 보강 필요 (research R1) |
| III. 도메인 불변식 고정 | 증빙 URL 선택(`https://` 검증만)·명예의 전당/Post-mortem 정규 스터디 전용·캠퍼스 필터 없음·`avatar_url` 미수집을 CLAUDE.md §7 값 그대로 재사용. 신규 불변식(판정 창, 랭킹 정렬, 회고 길이)은 spec Assumptions에 근거 명시. | ✅ |
| IV. 동시성·상태 머신 무결성 | 완주 판정은 Join과 동일하게 `db.transaction()` + 대상 글 행 `.for('update')` 선점 후 참여자 상태·카운트·글 상태를 원자적으로 갱신(FR-011, NFR-001 재사용). `RECRUITING`/`CLOSED` → `COMPLETED`(최종). Post-mortem은 상태 전이 아님. | ✅ |
| V. 보안 경계·링크 가시성 | 명예의 전당/Post-mortem/랭킹 응답에서 `chat_url` 필드 자체를 제외(Phase 1 마스킹 패턴 재사용). 판정/회고는 Route Handler `session.user.id === post.leaderId` 검증. | ✅ |

**Gate 판정**: 통과. ⚠️ 1건은 doc 보강 작업으로 tasks에 명시(코드 설계 차단 아님).

**Post-design 재검증 (Phase 1 design 후)**: trd §4 표에 `GET /api/hall-of-fame`·`GET /api/templates` 행 추가, §4.2 예시 코드에 `.for('update')` 잠금과 실제 구현 검증 항목 안내를 반영 완료. 원칙 I~V 모두 ✅, 위반 없음.

## Project Structure

### Documentation (this feature)

```text
specs/003-completion-lifecycle/
├── plan.md               # 이 파일
├── research.md           # Phase 0 결정 기록
├── data-model.md         # 엔티티·검증·상태 전이
├── quickstart.md         # 검증 실행 가이드
├── contracts/            # API 계약 (엔드포인트별)
│   ├── posts-complete.md
│   ├── posts-postmortem.md
│   ├── hall-of-fame.md
│   ├── leaderboard.md
│   └── templates-list.md
└── tasks.md              # /speckit-tasks 산출 (아직 없음)
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── schema.ts              # (변경 없음, 컬럼 모두 기존)
│   └── index.ts               # (변경 없음)
├── templates/
│   ├── types.ts               # (변경 없음, StudyTemplate 인터페이스 재사용)
│   └── registry.ts            # [수정] 6종 프리셋 등록 (코딩테스트/모각코/책 완독/듀오링고/음악 감상/자유)
├── lib/
│   ├── auth.ts                 # (재사용)
│   ├── errors.ts                # (재사용)
│   ├── validation.ts            # [수정] createPostSchema에 templateId/templateData 선택 필드 추가
│   ├── templates.ts             # [신규] 템플릿 특화 데이터 Zod 검증 헬퍼 (resolveTemplateData)
│   └── posts.ts                 # [수정] completePost/postmortemPost/listHallOfFame/listPostmortems/getLeaderboard 추가
└── app/api/
    ├── posts/[id]/
    │   ├── complete/route.ts    # [신규] POST 완주 벌크 판정
    │   └── postmortem/route.ts  # [신규] POST 회고 등록
    ├── hall-of-fame/route.ts    # [신규] GET 명예의 전당 + Post-mortem 목록 (쿼리 파라미터로 분기)
    ├── leaderboard/route.ts     # [신규] GET 성실 멤버 랭킹
    └── templates/route.ts       # [신규] GET 템플릿 목록

tests/
├── posts-complete.test.ts    # TC-COMPLETE-01, TC-COMPLETE-02, TC-LEADER-01(판정), 동시 판정 1회 가산
├── posts-postmortem.test.ts  # 회고 등록·덮어쓰기·상태 불변·권한·배타성
├── hall-of-fame.test.ts      # 명예의 전당/Post-mortem 목록 필터링, chat_url 미노출
├── leaderboard.test.ts       # 정렬 규칙, 0건 유저 제외, 상위 5명 컷
└── templates.test.ts         # 6종 프리셋 검증 통과/위반, 미등록 ID, PARTY 템플릿 차단
```

**Structure Decision**: Phase 1과 동일한 얇은 Route Handler + `src/lib/posts.ts` 도메인 서비스 패턴을 유지한다. 템플릿 특화 데이터 검증만 책임이 다르므로 `src/lib/templates.ts`로 분리하고, `src/templates/registry.ts`는 순수 데이터 정의(플러그인 등록부) 역할을 유지한다. 명예의 전당·Post-mortem·랭킹은 쓰기가 없는 조회 전용이라 `posts.ts`에 조회 함수로 추가하고 전용 Route만 신설한다.

## Complexity Tracking

> 위반 없음. 비워 둠.
