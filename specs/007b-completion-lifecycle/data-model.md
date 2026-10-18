# Data Model: 완주 판정 및 회고 등록 화면 포팅 (007b)

**Feature**: `007b-completion-lifecycle` | **Date**: 2026-10-18

## 1. DB 스키마 변경

**없음.** 기존 `posts`(`status`, `proof_url`, `postmortem_text`, `end_date`), `participants`(`status`), `users`(`completed_count`, `leader_count`) 테이블을 그대로 사용한다. 신규 마이그레이션을 생성하지 않는다.

---

## 2. 상세 뷰 모델 확장 (`src/lib/view-types.ts` & `src/lib/posts.ts`)

```typescript
/** 리더 본인에게만 내려주는 완주 판정 대상 팀원 (리더 제외 JOINED 참여자). */
export type VerdictMember = PublicUser & {
  userId: string;
};

export type PostDetail = FeedPost & {
  templateId: string | null;
  templateData: Record<string, unknown> | null;
  description: string | null;
  cancelReason: string | null;
  proofUrl: string | null;
  postmortemText: string | null;
  participants: PublicUser[];
  chatUrl?: string | null;
  /** 조회자가 리더 본인(viewerId === post.leaderId)일 때만 포함 */
  verdictMembers?: VerdictMember[];
};
```

- **보안 및 투영 불변식 (`TC-IDENT-04`)**:
  - `detail.leader`와 `detail.participants`는 항상 `{ login, campus }`만 가진다.
  - `detail.verdictMembers`는 `viewerId === post.leaderId`일 때만 키가 존재하며, `participants.status === 'JOINED' && participants.userId !== post.leaderId`인 행만 담는다.

---

## 3. 완주·회고 액션 상태 모델 (`CompletionActionState`)

`src/lib/leader-actions.ts`에서 `completionActionStateOf(post, role, now)`가 반환하는 순수 파생 모델.

```typescript
export type CompletionChoice = 'complete' | 'postmortem';

export type CompletionActionState = {
  /** 상세 모달에 마무리 액션 버튼을 렌더할지 여부 (리더 & STUDY & RECRUITING|CLOSED) */
  showEntry: boolean;
  /** 마무리 모달 오픈 가능 여부 (now >= opensAt) */
  canOpenModal: boolean;
  /** 마무리 입구 버튼 라벨 */
  entryLabel: string;
  /** 입구 비활성 또는 보조 안내 문구 */
  entryHint: string | null;
  /** [🏆 완주했어요] 경로 선택 및 제출 가능 여부 */
  canComplete: boolean;
  /** 완주 판정 경로가 비활성일 때 표시할 사유 */
  completeDisabledReason: string | null;
  /** [🪦 Post-mortem 남기기] 경로 선택 및 제출 가능 여부 */
  canPostmortem: boolean;
  /** 모달 오픈 시 기본 선택될 탭 */
  defaultChoice: CompletionChoice;
};
```

### 파생 규칙 (`completionActionStateOf(post, role, now)`)

| 조건 | `showEntry` | `canOpenModal` | `canComplete` | `canPostmortem` | `defaultChoice` | 비고 |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| 비리더, `PARTY`/`LIVE`, `COMPLETED`/`CANCELLED`, `endDate === null` | `false` | `false` | `false` | `false` | `'complete'` | 버튼 미노출 |
| `now < opensAt` (종료월 15일 이전) | `true` | `false` | `false` | `false` | `'complete'` | `entryHint`: `'사이클 종료월 15일부터 결과를 기록할 수 있습니다.'` |
| `opensAt <= now <= closesAt` & `postmortemText === null` & `verdictMembers.length >= 1` | `true` | `true` | `true` | `true` | `'complete'` | 두 경로 모두 활성 |
| `opensAt <= now <= closesAt` & `postmortemText === null` & `verdictMembers.length === 0` | `true` | `true` | `false` | `true` | `'postmortem'` | `completeDisabledReason`: `'참여한 팀원이 없어 완주 판정을 할 수 없습니다. Post-mortem 회고를 남겨 주세요.'` |
| `now >= opensAt` & `postmortemText !== null` (회고 기등록) | `true` | `true` | `false` | `true` | `'postmortem'` | `entryLabel`: `'Post-mortem 회고 수정'`, `completeDisabledReason`: `'이미 Post-mortem 회고가 등록된 스터디입니다.'` |
| `now > closesAt` & `postmortemText === null` (판정 기한 도과) | `true` | `true` | `false` | `true` | `'postmortem'` | `completeDisabledReason`: `'완주 판정 기한(익월 10일)이 지났습니다. Post-mortem 회고를 남겨 주세요.'` |

---

## 4. 제출 페이로드 직렬화 및 검증 모델

### 4.1 완주 판정 (`buildCompletePayload`)

```typescript
export type CompleteFormInput = {
  evaluations: { userId: string; isCompleted: boolean }[];
  proofUrl: string;
};

export type BuiltCompletePayload =
  | {
      ok: true;
      payload: {
        evaluations: { userId: string; isCompleted: boolean }[];
        proofUrl?: string;
      };
    }
  | { ok: false; message: string };
```

- **검증 규칙**:
  1. `evaluations.length === 0`: `{ ok: false, message: '판정할 참여 팀원이 없습니다.' }`
  2. `evaluations.every((e) => !e.isCompleted)` (완주자 0명): `{ ok: false, message: '완주한 팀원을 1명 이상 선택해 주세요.' }`
  3. `proofUrl`: `input.proofUrl.trim()`.
     - 빈 문자열이면 `payload.proofUrl` 키를 생략한다.
     - 비어 있지 않은데 `^https://`를 만족하지 않으면 `{ ok: false, message: '결과물 링크는 https://로 시작해야 합니다.' }` 반환.

### 4.2 Post-mortem 회고 (`buildPostmortemPayload`)

```typescript
export type BuiltPostmortemPayload =
  | { ok: true; payload: { text: string } }
  | { ok: false; message: string };
```

- **검증 규칙**:
  1. `text = rawText.trim()`.
  2. `text.length < 1 || text.length > 1000`: `{ ok: false, message: 'Post-mortem 회고는 1~1000자로 입력해 주세요.' }` 반환.
  3. 통과 시 `{ ok: true, payload: { text } }` 반환.
