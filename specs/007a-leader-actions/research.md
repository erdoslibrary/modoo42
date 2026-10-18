# Research: 리더 기본 액션 상세 모달 결합 (007a)

**Feature**: `007a-leader-actions` | **Date**: 2026-10-18

## R1: 상태 토글(`POST /api/posts/:id/status`) UI 결합 및 활성 조건

- **Decision**: `LeaderActions` 컴포넌트에 `[마감하기]`(`RECRUITING` → `CLOSED`) / `[재모집하기]`(`CLOSED` → `RECRUITING`) 토글 버튼을 추가한다. 단, `CLOSED` 상태에서 이미 정원이 가득 찬 경우(`maxMembers !== null && currentMembers >= maxMembers`)나 `PARTY` 마감일이 지난 경우(`endDate <= now`)에는 토글 버튼을 비활성화한다.
- **Rationale**:
  - 백엔드 `toggleStatus`는 단순히 `RECRUITING ↔ CLOSED`를 전환한다. 그러나 정원이 이미 찬(`6/6명`) 글에서 `RECRUITING`으로 되돌려도 신규 참여자는 `joinPost`의 정원 검증(`FULL`)과 상세 모달의 `joinabilityOf`(`full`)에 막혀 참여할 수 없다. UI에서 정원 도달 시 재모집 토글을 막아야 리더에게 거짓 피드백을 주지 않는다.
  - 마찬가지로 마감일이 지난 단기 파티(`PARTY`)는 `FR-020` Lazy Filter에 의해 피드에서 제외되고 참여가 막히므로 상태 토글이 무의미하다.
- **Alternatives considered**:
  - 정원 도달 상태에서도 재모집 버튼 허용: 클릭 시 상태만 `RECRUITING`으로 바뀌고 실제 참여는 여전히 막혀 UX 모순 발생 → 기각.

## R2: 마감(`CLOSED`) 상태에서 `[수정하기]` 버튼 제어

- **Decision**: `status !== 'RECRUITING'`(또는 단기 파티 마감일 도과)일 때 `[수정하기]` 버튼을 `disabled` 처리한다.
- **Rationale**:
  - `docs/requirement.md` `FR-006`과 `src/lib/posts.ts` `updatePost`(L421)는 `post.status !== 'RECRUITING'`일 때 `BAD_REQUEST`("모집 중인 글만 수정할 수 있습니다.")를 던진다.
  - 기존 `006`의 `LeaderActions.tsx`는 `CLOSED`에서도 수정 모달을 열어 제출 시점에야 400 에러를 냈다. 버튼 단계에서 비활성화하고 툴팁/보조 문구 또는 상태 표시로 안내하는 것이 일관된다.
- **Alternatives considered**:
  - 백엔드 `updatePost`를 고쳐 `CLOSED`에서도 수정을 허용: `requirement.md` `FR-006`("모집 중(`RECRUITING`) 상태일 때 리더는 ... 수정 가능") 및 기존 테스트 `tests/posts-update.test.ts` L43("RECRUITING 아닌 글 수정 → BAD_REQUEST")과 정면 충돌하므로 기각 (헌법 III 도메인 불변식 고정).

## R3: 게시글 수정(`PUT /api/posts/:id`) 페이로드 직렬화 (빈 값 및 조건부 `chatUrl`)

- **Decision**: 수정 폼 제출값을 직렬화하는 순수 함수 `buildUpdatePatch(formValues, locationType)`를 분리한다.
  - `title`: `trim()`한 문자열 (필수, 1~40자).
  - `description`: `trim()`한 결과가 빈 문자열이면 `null`을 전송해 기존 설명을 지울 수 있게 한다.
  - `place`: `trim()`한 결과가 빈 문자열이면 `null`을 전송해 기존 장소를 지울 수 있게 한다.
  - `chatUrl`: `trim()`한 결과가 비어 있지 않으면 전송한다. 비어 있을 때 `ONLINE`·`HYBRID` 모집이면 클라이언트 검증 에러를 반환해 제출을 막고, 오프라인 전용(`OFFLINE_GS`·`OFFLINE_SEOUL`)이면 패치 키에서 생략(또는 서버 스키마 허용 범위 유지)한다. 또한 백엔드 `updatePost`와 `updatePostSchema`에서 오프라인 전용 모집이 아닐 때 `chatUrl`을 지우지 못하게 하고, 화이트리스트 검증을 유지한다.
- **Rationale**:
  - `updatePostSchema`(`src/lib/validation.ts` L88)는 `description: z.string().max(300).nullable()`, `place: z.string().nullable()`로 정의되어 있어 `null`을 받을 준비가 되어 있다.
  - 반면 기존 `LeaderActions.tsx`(L77-80)는 `if (value) patch[key] = value;`로 작성되어 설명이나 장소를 지우면 아예 키가 빠지고 기존 DB 값이 그대로 남는 버그가 있었다.
- **Alternatives considered**:
  - 빈 문자열 `""` 그대로 전송: `description`과 `place`가 DB에 `""`로 들어가 `null` 기준 조건부 렌더링(`{post.description && ...}`, `{post.place && ...}`)과 어긋남 → `null`로 정규화 채택.

## R4: 중도 취소(`POST /api/posts/:id/cancel`) 공백 사유 방어

- **Decision**: `src/lib/validation.ts`의 `cancelSchema`에 `.trim()`을 추가해(`z.string().trim().min(1).max(300)`) 공백만 입력한 사유(`"   "`)를 서버에서도 `BAD_REQUEST`로 거부하고, 클라이언트 폼에서도 `trim()` 후 비어 있으면 제출하지 않는다.
- **Rationale**:
  - `postmortemSchema`(L120)는 `z.string().trim().min(1).max(1000)`으로 공백을 걸러내지만, `cancelSchema`(L107)는 `.trim()`이 빠져 있어 `"   "`가 통과할 수 있었다.
- **Alternatives considered**:
  - 프론트에서만 `trim()` 검증: 헌법 III("서버 측 Zod 검증이 최종 방어선이며 프론트 검증은 보조다") 위반 → 서버 스키마도 함께 보강.

## R5: 파생 로직 테스트 전략

- **Decision**: `006`의 R14 결정과 동일하게 React DOM 렌더 테스트 라이브러리를 추가하지 않고, 리더 액션 가능 상태 판별(`leaderActionStateOf`)과 수정 패치 직렬화(`buildUpdatePatch`)를 순수 함수(`src/lib/leader-actions.ts` 또는 `src/lib/display.ts`)로 추출해 Vitest 단위 테스트로 검증한다.加えて `cancelSchema` 공백 거부 테스트를 `tests/lib/validation.test.ts`에 추가한다.
- **Rationale**: 신규 의존성 0개 원칙을 지키면서 모든 분기(상태·정원·파티 만료·입력 직렬화)를 빠르고 결정론적으로 검증할 수 있다.
