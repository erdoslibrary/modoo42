// 템플릿 플러그인 등록부 (책장/플러그인 아키텍처, CLAUDE.md §6.5).
// 신규 템플릿은 여기에 정의 1건을 추가해 DB 마이그레이션 없이 확장한다.
// 기본 프리셋 6종(코딩테스트·모각코·책 완독·듀오링고·음악 감상·자유)은 Phase 1에서 등록한다.
import type { StudyTemplate } from './types';

export const templateRegistry: Record<string, StudyTemplate> = {};

export function getTemplate(id: string): StudyTemplate | undefined {
  return templateRegistry[id];
}
