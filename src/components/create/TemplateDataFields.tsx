'use client';

// 템플릿 필수 특화 데이터 입력 (spec FR-026, templates.ts resolveTemplate).
// 등록부의 dataSchema는 strict이고 `book.bookTitle`·`duolingo.language`가 필수다 —
// 템플릿만 고르고 이 값을 보내지 않으면 서버가 BAD_REQUEST로 거절한다.
// 선택 항목(플랫폼·주간 목표 등)은 입력을 두지 않는다. 보내지 않으면 저장되지 않을 뿐이다.
const REQUIRED_FIELDS: Record<string, { key: string; label: string; maxLength: number }[]> = {
  book: [{ key: 'bookTitle', label: '책 제목', maxLength: 60 }],
  duolingo: [{ key: 'language', label: '학습 언어', maxLength: 20 }],
};

export function TemplateDataFields({
  templateId,
  value,
  onChange,
}: {
  templateId: string | null;
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const fields = templateId ? REQUIRED_FIELDS[templateId] : undefined;
  if (!fields) return null;

  return (
    <>
      {fields.map(({ key, label, maxLength }) => (
        <label key={key} className="flex flex-col gap-1 text-[12px]">
          {label} (필수, 최대 {maxLength}자)
          <input
            value={value[key] ?? ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            maxLength={maxLength}
            required
            className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
          />
        </label>
      ))}
    </>
  );
}
