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
