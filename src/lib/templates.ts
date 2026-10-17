// 템플릿 특화 데이터 검증 (FR-007, research R6). 등록부(src/templates/registry.ts)는 순수 정의로 두고,
// 개설 입력과 등록부를 맞춰 보는 책임은 여기서 진다. 신규 템플릿은 등록부 정의 1건만 추가하면 된다.
import { AppError } from '@/lib/errors';
import { getTemplate, templateRegistry } from '@/templates/registry';

export type ResolvedTemplate = {
  templateId: string | null;
  templateData: Record<string, unknown> | null;
  proofType: string | null;
};

/** 개설 입력의 템플릿 ID·특화 데이터를 검증하고 저장할 값을 돌려준다. 위반 시 BAD_REQUEST. */
export function resolveTemplate(
  type: 'STUDY' | 'PARTY',
  templateId: string | null | undefined,
  templateData: Record<string, unknown> | null | undefined,
): ResolvedTemplate {
  if (!templateId) {
    if (templateData) throw new AppError('BAD_REQUEST', '템플릿 없이 특화 데이터를 보낼 수 없습니다.');
    return { templateId: null, templateData: null, proofType: null };
  }
  if (type !== 'STUDY') throw new AppError('BAD_REQUEST', '템플릿은 정규 스터디 전용입니다.');

  const template = getTemplate(templateId);
  if (!template) throw new AppError('BAD_REQUEST', '등록되지 않은 템플릿입니다.');

  if (!template.dataSchema) {
    if (templateData && Object.keys(templateData).length > 0) {
      throw new AppError('BAD_REQUEST', '이 템플릿은 특화 데이터를 받지 않습니다.');
    }
    return { templateId, templateData: null, proofType: template.defaultProofType };
  }

  // 필수 항목이 있는 템플릿은 데이터 누락도 규칙 위반이다 → 빈 객체로 검증한다.
  const parsed = template.dataSchema.safeParse(templateData ?? {});
  if (!parsed.success) throw new AppError('BAD_REQUEST', '템플릿 특화 데이터가 올바르지 않습니다.');
  const data = parsed.data as Record<string, unknown>;
  return {
    templateId,
    templateData: Object.keys(data).length > 0 ? data : null,
    proofType: template.defaultProofType,
  };
}

/** 템플릿 목록 (FR-005). dataSchema·CustomFormField는 직렬화하지 않는다. */
export function listTemplates() {
  return Object.values(templateRegistry).map(({ id, title, description, defaultTags }) => ({
    id,
    title,
    description,
    defaultTags,
  }));
}
