'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplatePicker, type TemplateOption } from '@/components/create/TemplatePicker';
import { TemplateDataFields } from '@/components/create/TemplateDataFields';
import { errorCodeOf, errorMessage } from '@/lib/error-message';
import { isAllowedChatUrl } from '@/lib/validation';

// 정규 스터디·단기 파티 개설 폼 (spec FR-024·FR-027·FR-029).
// 두 유형은 입력 항목이 같고 종료일 처리만 다르므로 한 폼으로 둔다 —
// 정규 스터디는 자동 산출 안내만 보여주고, 단기 파티만 마감일을 직접 고른다 (CLAUDE.md §7.2).
// 제한 값은 CLAUDE.md §7.1을 그대로 쓴다. 프론트 검증은 보조이고 최종 방어선은 서버 Zod다.
const LOCATION_OPTIONS = [
  { value: 'ONLINE', label: '온라인' },
  { value: 'OFFLINE_GS', label: '경산 오프라인' },
  { value: 'OFFLINE_SEOUL', label: '서울 오프라인' },
  { value: 'HYBRID', label: '온/오프라인 병행' },
] as const;

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 10;

export function RecruitForm({
  type,
  templates,
  endDateNotice,
  minEndDate,
}: {
  type: 'STUDY' | 'PARTY';
  templates: TemplateOption[];
  /** 정규 스터디의 자동 산출 종료일 안내. 서버가 계산해 내려준다(클라이언트 시계를 믿지 않는다). */
  endDateNotice: string;
  /** 단기 파티 마감일의 최솟값(오늘, KST). 과거 날짜를 고를 수 없게 한다. */
  minEndDate: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, string>>({});
  const [title, setTitle] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [description, setDescription] = useState('');
  const [locationType, setLocationType] = useState<string>('ONLINE');
  const [place, setPlace] = useState('');
  const [maxMembers, setMaxMembers] = useState(MAX_MEMBERS);
  const [chatUrl, setChatUrl] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  // 온라인 요소가 있는 모집(온라인·온/오프라인 병행)만 chat_url 필수. 오프라인 전용은 선택 (CLAUDE.md §7.1).
  const chatRequired = locationType === 'ONLINE' || locationType === 'HYBRID';

  function pickTemplate(template: TemplateOption | null) {
    // 직전에 적용돼 있던 템플릿. 그 프리필 값과 현재 칸을 비교해 "유저가 고쳤는지"를 가린다.
    const prev = templateId ? templates.find((t) => t.id === templateId) ?? null : null;
    setTemplateId(template?.id ?? null);
    setTemplateData({});
    // 이전 템플릿이 채운 프리필(또는 빈 칸)만 새 템플릿 값으로 교체한다.
    // 유저가 직접 고친 값(= 이전 프리필과 다른 값)은 덮지 않는다.
    const swap = (cur: string, was: string, next: string) =>
      cur === '' || cur === was ? next : cur;
    setTitle((cur) => swap(cur, prev?.title ?? '', template?.title ?? ''));
    setDescription((cur) => swap(cur, prev?.description ?? '', template?.description ?? ''));
    setTagsText((cur) =>
      swap(cur, prev?.defaultTags.join(', ') ?? '', template?.defaultTags.join(', ') ?? ''),
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (tags.length < 1 || tags.length > 3) {
      setError('태그는 1~3개여야 합니다. 쉼표로 구분해 주세요.');
      return;
    }
    if (chatRequired && !chatUrl) {
      setError('온라인·온/오프라인 병행 스터디는 초대 링크가 필수입니다.');
      return;
    }
    if (chatUrl && !isAllowedChatUrl(chatUrl)) {
      setError('초대 링크는 카카오 오픈채팅 또는 디스코드 링크만 쓸 수 있습니다.');
      return;
    }
    if (referenceUrl && !referenceUrl.startsWith('https://')) {
      setError('참고 링크는 https:// 로 시작해야 합니다.');
      return;
    }
    if (type === 'PARTY' && !endDate) {
      setError('마감일을 골라 주세요.');
      return;
    }

    const payload: Record<string, unknown> = {
      type,
      title,
      tags,
      locationType,
      maxMembers,
    };
    if (chatUrl) payload.chatUrl = chatUrl;
    if (description) payload.description = description;
    if (place) payload.place = place;
    if (referenceUrl) payload.referenceUrl = referenceUrl;
    if (type === 'PARTY') payload.endDate = endDate;
    if (templateId) {
      payload.templateId = templateId;
      if (Object.keys(templateData).length > 0) payload.templateData = templateData;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(errorMessage(errorCodeOf(await res.json().catch(() => null))));
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
      {type === 'STUDY' && (
        <>
          <TemplatePicker templates={templates} selected={templateId} onSelect={pickTemplate} />
          <TemplateDataFields
            templateId={templateId}
            value={templateData}
            onChange={setTemplateData}
          />
        </>
      )}

      <label className="flex flex-col gap-1 text-[12px]">
        스터디 이름 (최대 40자)
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={40}
          required
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
        <span className="text-right text-[11px] text-muted">{title.length}/40</span>
      </label>

      <label className="flex flex-col gap-1 text-[12px]">
        태그 (쉼표로 구분, 1~3개)
        <input
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="코딩테스트, 자율"
          required
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
        <span className="text-right text-[11px] text-muted">{tags.length}/3</span>
      </label>

      <label className="flex flex-col gap-1 text-[12px]">
        한 줄 소개 (선택, 최대 300자)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
        <span className="text-right text-[11px] text-muted">{description.length}/300</span>
      </label>

      <fieldset className="flex flex-col gap-2 text-[12px]">
        <legend>진행 방식</legend>
        {/* 낱개 pill 나열이 아니라 세그먼트 1덩어리다 — 칸 사이는 border-left로만 나눈다
            (FR-011, findings.md 2-7h). 선택된 칸은 accent-bright다 (FR-001). */}
        <div className="nb inline-flex w-fit max-w-full flex-wrap overflow-hidden rounded-lg [--nb-depth:2px]">
          {LOCATION_OPTIONS.map(({ value, label }) => (
            <label
              key={value}
              className={`px grid h-[46px] cursor-pointer place-items-center px-7 text-[13px] [border-left:2px_solid_#18181b] first:[border-left:none] ${
                locationType === value ? 'bg-accent-bright' : 'bg-white hover:bg-accent-soft'
              }`}
            >
              <input
                type="radio"
                name="locationType"
                value={value}
                checked={locationType === value}
                onChange={() => setLocationType(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-[12px]">
        장소 (선택)
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="클러스터 2층 / 디스코드 음성방"
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
      </label>

      <div className="flex flex-col gap-1 text-[12px]">
        <span>모집 인원 (리더 포함 {MIN_MEMBERS}~{MAX_MEMBERS}명)</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMaxMembers((n) => Math.max(MIN_MEMBERS, n - 1))}
            aria-label="인원 줄이기"
            className="nb rounded-lg bg-white px-3 py-1.5 font-bold hover:bg-accent-soft [--nb-depth:2px]"
          >
            −
          </button>
          <output className="px w-[70px] text-center text-[16px]">{maxMembers}명</output>
          <button
            type="button"
            onClick={() => setMaxMembers((n) => Math.min(MAX_MEMBERS, n + 1))}
            aria-label="인원 늘리기"
            className="nb rounded-lg bg-white px-3 py-1.5 font-bold hover:bg-accent-soft [--nb-depth:2px]"
          >
            +
          </button>
        </div>
      </div>

      {type === 'STUDY' ? (
        <p className="nb rounded-lg bg-bg p-3 text-[12px] leading-relaxed [--nb-depth:2px]">
          종료일은 개설일 기준으로 자동 정해집니다 — <b>{endDateNotice}</b>. 리더가 바꿀 수 없습니다.
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-[12px]">
          마감일 (D-Day)
          <input
            type="date"
            value={endDate}
            min={minEndDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
          />
        </label>
      )}

      <label className="flex flex-col gap-1 text-[12px]">
        참여자가 모일 오픈채팅 / 디스코드 링크 ({chatRequired ? '필수' : '선택'})
        <input
          value={chatUrl}
          onChange={(e) => setChatUrl(e.target.value)}
          placeholder="https://open.kakao.com/o/..."
          required={chatRequired}
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
        <span className="text-[11px] text-muted">
          이 서비스는 자체 채팅이 없습니다. 참여자는 이 링크로 모여요. 링크는 참여한 사람에게만
          보입니다.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-[12px]">
        이전 활동·참고 링크 (선택)
        <input
          value={referenceUrl}
          onChange={(e) => setReferenceUrl(e.target.value)}
          placeholder="https://..."
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
      </label>

      {error && <p className="text-[12px] font-bold text-accent-dark">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="nb px flex-1 rounded-[9px] bg-accent px-[30px] pb-3.5 pt-4 text-[15px] hover:bg-accent-hover disabled:cursor-wait [--nb-depth:4px]"
        >
          {pending ? '개설 중…' : '개설하기'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="nb rounded-lg bg-white px-4 py-2.5 text-[14px] font-bold hover:bg-bg [--nb-depth:4px]"
        >
          취소
        </button>
      </div>
    </form>
  );
}
