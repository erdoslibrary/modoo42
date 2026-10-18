'use client';

// 템플릿으로 시작하기 (spec FR-026). 고르면 기본 제목·설명·태그를 채우고, 채운 값은 유저가 고칠 수 있다.
// 템플릿은 정규 스터디 전용이라 단기 파티·LIVE 폼에는 렌더하지 않는다 (templates.ts resolveTemplate).
export type TemplateOption = {
  id: string;
  title: string;
  description: string;
  defaultTags: string[];
};

export function TemplatePicker({
  templates,
  selected,
  onSelect,
}: {
  templates: TemplateOption[];
  selected: string | null;
  onSelect: (template: TemplateOption | null) => void;
}) {
  return (
    <section>
      <h2 className="px text-[13px]">템플릿으로 시작하기</h2>
      <p className="mt-1 text-[11px] text-muted">
        고르면 이름·소개·태그가 미리 채워져요. 그대로 쓰지 않아도 됩니다.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            aria-pressed={selected === template.id}
            onClick={() => onSelect(selected === template.id ? null : template)}
            className={
              // 선택된 칩은 accent-bright다 — accent는 제출·참여 전용이다 (FR-001).
              selected === template.id
                ? 'nb rounded-lg bg-accent-bright px-3 py-1.5 text-[12px] font-bold [--nb-depth:2px]'
                : 'nb rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold hover:bg-accent-soft [--nb-depth:2px]'
            }
          >
            {template.title}
          </button>
        ))}
      </div>
    </section>
  );
}
