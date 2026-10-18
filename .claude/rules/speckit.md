# speckit 기반 사양 주도 개발(SDD) 규칙

모든 기능 및 마일스톤 구현 작업에 적용. 사용자가 프롬프트에서 `speckit`을 직접 언급하지 않더라도 아래 규약을 강제한다.

## 강제 사항 (MUST)

1. **기본 4단계 루프 자동 적용**:
   - 새로운 Phase 또는 기능 구현 요청 시 바로 코드를 작성하지 않는다.
   - 반드시 아래 4단계를 순서대로 거친다:
     1) `speckit-specify`: `docs/requirement.md` 기반 `specs/<phase>/spec.md` 생성
     2) `speckit-plan`: 아키텍처 및 기술 명세 `specs/<phase>/plan.md` 생성
     3) `speckit-tasks`: 의존성 순서의 작업 체크리스트 `specs/<phase>/tasks.md` 생성
     4) `speckit-implement`: 체크리스트를 순차적으로 구현하고 테스트 통과 확인
2. **단일 진실 공급원 (SSOT)**:
   - 전체 시스템 범위와 요구사항 기준은 항상 `docs/requirement.md`를 최우선 참조한다.
   - 워크플로우 세부 가이드는 `docs/speckit-guide.md`를 따른다.
3. **TDD 원칙 준수**:
   - 핵심 도메인 로직 구현 시 Vitest 테스트를 먼저 작성(Red)하고 구현(Green)을 거친다.

## 예외 — chore 직결 처리

아래 작업은 `specs/` 아티팩트 없이 바로 구현하고 `chore:` 커밋으로 처리한다. 4단계 루프를 강제하면 산출물보다 형식 비용이 커지는 범주다.

- CI/CD 워크플로, 린터·포매터·테스트 러너 설정 파일
- PR·이슈 템플릿, `.gitignore`, `.env.example`
- 문서 간 충돌 해소를 위한 동기화 수정 (CLAUDE.md §1 우선순위 적용)
- 의존성 추가·업그레이드

**예외 적용 조건 (전부 충족해야 한다):** 도메인 로직·DB 스키마·API 표면 중 어느 것도 바꾸지 않는다. 하나라도 건드리면 chore가 아니므로 4단계 루프로 돌아간다.

예외로 처리하더라도 요구사항 ID(`FR-*`/`NFR-*`)의 이행 범위가 달라지면 `docs/requirement.md`를 같은 PR에서 함께 고친다.
