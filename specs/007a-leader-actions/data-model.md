# Data Model: 리더 기본 액션 상세 모달 결합 (007a)

**Feature**: `007a-leader-actions` | **Date**: 2026-10-18

## 1. DB 스키마 변경

**없음.** 기존 `posts` 테이블(`title`, `description`, `place`, `chat_url`, `status`, `cancel_reason`, `updated_at`)을 그대로 사용한다. 신규 마이그레이션을 생성하지 않는다.

---

## 2. 리더 액션 가능 상태 모델 (`LeaderActionState`)

상세 모달(`PostDetailModal` → `LeaderActions`)에서 버튼 노출 및 활성/비활성을 결정하는 순수 파생 모델.

```typescript
export type LeaderActionState = {
  /** 리더 액션 영역 자체를 렌더할지 여부 */
  visible: boolean;
  /** [수정하기] 버튼 활성화 여부 */
  canEdit: boolean;
  /** 마감/재모집 토글 버튼 활성화 여부 */
  canToggleStatus: boolean;
  /** 토글 클릭 시 요청할 목표 상태 */
  nextToggleStatus: 'CLOSED' | 'RECRUITING';
  /** 토글 버튼에 표시할 라벨 ('마감하기' | '재모집하기') */
  toggleLabel: string;
  /** [모집 취소] 버튼 활성화 여부 */
  canCancel: boolean;
};
```

### 파생 규칙 (`leaderActionStateOf(post, role, now)`)

| 조건 | `visible` | `canEdit` | `canToggleStatus` | `nextToggleStatus` / `toggleLabel` | `canCancel` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `role !== 'leader'` | `false` | `false` | `false` | — | `false` |
| `post.type === 'LIVE'` | `false` | `false` | `false` | — | `false` |
| `post.status === 'COMPLETED' \| 'CANCELLED'` | `false` | `false` | `false` | — | `false` |
| `post.type === 'PARTY'` & `endDate <= now` (기한 만료) | `true` | `false` | `false` | `'CLOSED'` / `'마감됨'` | `true` |
| `post.status === 'RECRUITING'` (미만료) | `true` | `true` | `true` | `'CLOSED'` / `'마감하기'` | `true` |
| `post.status === 'CLOSED'` & `currentMembers < maxMembers` (미만료) | `true` | `false` | `true` | `'RECRUITING'` / `'재모집하기'` | `true` |
| `post.status === 'CLOSED'` & `currentMembers >= maxMembers` (정원 도달) | `true` | `false` | `false` | `'RECRUITING'` / `'재모집 불가 (정원 마감)'` | `true` |

---

## 3. 게시글 수정 패치 직렬화 모델 (`buildUpdatePatch`)

수정 폼 입력값에서 `PUT /api/posts/:id` 요청 본문을 만드는 규칙.

```typescript
export type EditFormInput = {
  title: string;
  description: string;
  place: string;
  chatUrl: string;
};

export type BuiltUpdatePatch =
  | { ok: true; patch: UpdatePatch }
  | { ok: false; message: string };
```

### 변환 규칙

1. `title`: `input.title.trim()`. 비어 있거나 40자 초과 시 `{ ok: false, message }` 반환.
2. `description`: `input.description.trim()`. 빈 문자열이면 `null`, 아니면 다듬은 문자열(300자 초과 시 `{ ok: false }`).
3. `place`: `input.place.trim()`. 빈 문자열이면 `null`, 아니면 다듬은 문자열.
4. `chatUrl`: `input.chatUrl.trim()`.
   - 온라인 요소가 있는 모집(`ONLINE` · `HYBRID`)인데 빈 문자열이면 `{ ok: false, message: '온라인·온/오프라인 병행 모집은 초대 링크가 필요합니다.' }` 반환.
   - 비어 있지 않은데 화이트리스트(`isAllowedChatUrl`)를 통과하지 못하면 `{ ok: false, message: '카카오톡 오픈채팅 또는 디스코드 초대 링크만 입력할 수 있습니다.' }` 반환.
   - 비어 있지 않고 유효하면 `patch.chatUrl = trimmedChatUrl` 포함.
   - 오프라인 전용(`OFFLINE_GS` · `OFFLINE_SEOUL`)이고 빈 문자열이면 `chatUrl` 키를 생략(기존 값 유지 또는 미변경).

---

## 4. 취소 사유 검증 (`cancelSchema`)

- `src/lib/validation.ts`:
  ```typescript
  export const cancelSchema = z.object({
    reason: z.string().trim().min(1).max(300),
  });
  ```
- 앞뒤 공백 제거 후 최소 1자 이상, 최대 300자 이하.
