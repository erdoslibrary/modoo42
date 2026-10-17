# Antigravity IDE & speckit (Spec Kit) 가이드

이 문서는 `.claude` 환경에 설정된 규칙(Rules)과 스킬(Skills)을 **Antigravity IDE**에서 연동하여 사용하는 방법과, **speckit(Spec Kit)** 기반의 사양 주도 개발(Spec-Driven Development) 워크플로우를 초보자도 쉽게 따라 할 수 있도록 정리한 실전 가이드입니다.

---

## 1. 개요 및 호환성

Antigravity IDE와 Claude Code는 에이전트 확장 체계(`SKILL.md` 포맷 및 마크다운 규칙)가 상호 호환됩니다. 단, 설정 디렉토리 기본 탐색 경로가 다릅니다.

| 구분 | Claude Code | Antigravity IDE |
| :--- | :--- | :--- |
| **규칙 (Rules)** | `.claude/rules/*.md` | `.agents/rules/*.md` 또는 `AGENTS.md` / `GEMINI.md` |
| **스킬 (Skills)** | `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |

---

## 2. Antigravity 연동 방법

프로젝트 루트(`/home/erdos/workspace/modoo42`)에서 심볼릭 링크를 생성하여 연동합니다 (권장).

```bash
ln -s .claude .agents
```

- `.claude/rules/anti-ai-slop.md` → `.agents/rules/`로 자동 인식
- `.claude/skills/speckit-*` → `.agents/skills/`로 자동 인식

---

## 3. speckit 명령어 10종 역할 분류

speckit 명령어는 많아 보이지만, **매 기능마다 실행하는 핵심은 4개**뿐입니다. 나머지는 상황에 따라 쓰는 보조 도구입니다.

```text
[필수 기본 4단계 루프]
1. specify (명세) ➔ 2. plan (설계) ➔ 3. tasks (할일 분해) ➔ 4. implement (구현)
```

| 분류 | 명령어 | 역할 및 사용 시점 | 필수 여부 |
| :--- | :--- | :--- | :---: |
| **핵심 기본 루프** | `/speckit-specify` | "무엇을 만들지" 자연어 요구사항을 표준 기능 명세서(`spec.md`)로 작성 | **필수** |
| | `/speckit-plan` | "어떻게 만들지" 기술 스택(DB 스키마, API, UI)에 맞춘 설계서(`plan.md`) 작성 | **필수** |
| | `/speckit-tasks` | 설계서를 의존성 순서의 실행 가능한 체크리스트(`tasks.md`)로 분해 | **필수** |
| | `/speckit-implement` | `tasks.md`의 체크리스트를 하나씩 순서대로 코드로 구현하고 테스트 통과 확인 | **필수** |
| **품질 검증 보조** | `/speckit-clarify` | `specify` 직후 모호하거나 누락된 비즈니스 룰을 Q&A로 해소 | 선택 (모호할 때) |
| | `/speckit-checklist` | 기능 명세서의 완성도 및 예외 상황 점검 체크리스트 생성 | 선택 |
| | `/speckit-analyze` | `tasks` 작성 후 `spec.md`, `plan.md`, `tasks.md` 간 모순이나 누락 분석 | 선택 (복잡할 때) |
| | `/speckit-converge` | 구현 완료/진행 중 실제 코드와 명세를 대조해 남은 미구현 작업을 찾아 추가 | 선택 (구현 후) |
| **거버넌스 & 특수** | `/speckit-constitution` | 프로젝트 아키텍처 및 코딩 컨벤션 헌법 제정 (초기 1회만 실행) | 프로젝트 초기 1회 |
| | `/speckit-taskstoissues` | `tasks.md`를 GitHub Issues로 변환 (Deprecated, 보통 미사용) | 미사용 권장 |

---

## 4. [실전 튜토리얼] Phase 0 착수 예시로 배우는 플로우

`docs/requirement.md`의 **Phase 0 (기반 인프라 & Mock 인증)**을 구현한다고 가정했을 때의 실제 진행 흐름입니다.

### Step 1: 기능 명세서 작성 (`specify`)
전체 청사진 문서인 `requirement.md`의 Phase 0을 가리켜 명세 작성을 요청합니다.
```text
/speckit-specify docs/requirement.md의 Phase 0 기반 인프라 및 Mock 인증 세션 구현
```
- **에이전트 동작**: `specs/00-mock-auth/spec.md` 파일 생성 (유저 시나리오, FR-000 세부 기능 정의).

### Step 2: 모호점 해소 (선택: `clarify`)
세션 만료 시간이나 모달 디자인 등 애매한 점이 있다면 질의응답을 거칩니다.
```text
/speckit-clarify
```
- **에이전트 동작**: 객관식 질문을 통해 세부 정책 확정 후 `spec.md`에 자동 반영.

### Step 3: 기술 구현 계획 수립 (`plan`)
실제 기술 스택(Drizzle ORM, Next.js App Router, Vitest)을 적용한 파일 및 아키텍처를 설계합니다.
```text
/speckit-plan
```
- **에이전트 동작**: `specs/00-mock-auth/plan.md` 생성 (스키마 파일 경로, `/api/mock-auth` 구조, `MockAuthModal.tsx` 컴포넌트 위치 확정).

### Step 4: 작업 체크리스트 분해 (`tasks`)
설계서를 순서대로 실행할 수 있는 작은 작업 단위로 쪼갭니다.
```text
/speckit-tasks
```
- **에이전트 동작**: `specs/00-mock-auth/tasks.md` 생성.
  ```markdown
  - [ ] Task 1: drizzle-orm, postgres, vitest 패키지 설치
  - [ ] Task 2: src/db/schema.ts 스키마 작성 및 마이그레이션 실행
  - [ ] Task 3: src/lib/auth.ts Mock 유저 세션 헬퍼 구현
  - [ ] Task 4: src/app/api/mock-auth/route.ts 엔드포인트 구현
  - [ ] Task 5: MockAuthModal 컴포넌트 작성 및 레이아웃 연결
  ```

### Step 5: 순차 코드 구현 (`implement`)
체크리스트를 바탕으로 실제 코드를 한 단계씩 작성하고 체크박스를 채웁니다.
```text
/speckit-implement
```
- **에이전트 동작**: Task 1부터 Task 5까지 순차적으로 코드를 작성, 테스트를 실행하며 `tasks.md`의 체크박스를 `[x]`로 완료 처리.

---

## 5. Antigravity IDE 활용 팁

1. **명령어 호출 방식 2가지**:
   - **슬래시 커맨드 입력**: `/speckit-specify ...`
   - **자연어 요청 (동일하게 동작)**: `requirement.md의 Phase 0으로 speckit-specify 실행해줘`
2. **단일 진실 공급원(SSOT) 유지**:
   - 상위 설계는 항상 `docs/requirement.md`에 유지하고, `speckit`은 각 Phase를 순서대로 파내려가는 실행 도구로 활용합니다.
3. **현재 진행 상태 기억**:
   - `.specify/feature.json`에 현재 작업 중인 `feature_directory`가 자동으로 기록되므로, 다음 명령어 호출 시 이전 맥락이 그대로 이어집니다.
