# Specification Quality Checklist: 유저 식별 스키마 전환 (Phase 3 선행)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-10-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- 1차 검증에서 지적된 항목과 처리:
  - 컬럼명·열거형 값 같은 저장 수준 용어가 사용자 시나리오에 섞여 있었다 → US/SC/Edge Cases는 "GitHub 핸들", "장소 분류", "그 외 오프라인" 같은 도메인 용어로 바꿨다. 컬럼 수준 표기는 Requirements와 Assumptions의 문서 참조에만 남겼다.
  - Mock 페르소나 수(3종 유지 vs 4종 확장)가 미결이었다 → 사용자 결정으로 4종 확장을 확정했고 FR-012와 US4에 반영했다. requirement.md FR-000과 trd.md §2.1을 같은 PR에서 함께 고친다.
  - 기존 데이터 백필 방식이 미결이었다 → 개발 DB 실측(유저 3건·글 3건·참여 6건, 실사용자 없음)을 근거로 42 Intra ID 파생 백필로 확정했다. FR-007·SC-004로 검증한다.
- 응답 필드 `intraId` → `login` 전환은 계약 5건을 동시에 깨는 변경이다. 과도기 병행 노출을 두지 않는 근거는 Assumptions에 기록했다.
- 새 인수 테스트 ID TC-IDENT-01~05는 `docs/requirement.md` §3에 추가해야 한다. 그 추가가 이 기능의 완료 조건에 포함된다.
- 2차 검증(코드 대조)에서 추가된 항목:
  - "그 외 오프라인"을 저장 가능 값과 입력 가능 값 모두로 읽으면 파생 전용 의미가 깨진다 → FR-005a 신설. 입력 가능 값은 기존 4종으로 고정한다.
  - 페르소나가 캠퍼스를 갖고 42 인증 시각은 비는 상태가 Key Entities 문장과 어긋났다 → "실사용 경로는 42 인증, 개발 시드는 직접 채움"으로 분리했다. 42 인증 시각은 어느 경로에서도 채우지 않는다.
  - 페르소나 문자열을 42 Intra ID로 재사용하면 42 인증 유저로 오인된다 → FR-012a 신설(매칭 기준은 GitHub 숫자 식별자, 42 Intra ID는 비움).
  - 페르소나 목록이 세션 해석과 선택 UI 두 곳에 각각 하드코딩돼 있었다 → FR-012b 신설(정의 1곳).
  - 필수 컬럼 추가 순서와 열거형 값 추가·사용 분리를 Assumptions에 명시했다. 둘 다 전환 실패로 직결되는 순서 제약이다.
