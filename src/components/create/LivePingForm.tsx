'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorCodeOf, livePingErrorMessage } from '@/lib/error-message';

// LIVE 핑 등록 폼 (spec FR-028·FR-030). 받는 값은 내용·위치·유효시간 3개뿐이다 —
// 정원·초대 링크·태그는 LIVE에 없다 (validation.ts createLivePingSchema는 strict).
const DURATIONS = [
  { value: 30, label: '30분' },
  { value: 60, label: '1시간' },
  { value: 120, label: '2시간' },
  { value: 180, label: '3시간' },
] as const;

export function LivePingForm() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [place, setPlace] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 하루 1회 제한에 걸리면 입구를 닫는다. 날짜는 클라이언트가 세지 않고 서버 판정만 믿는다
  // (KST 자정 기준은 서버가 SSOT, req FR-011).
  const [blocked, setBlocked] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || blocked) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'LIVE', text, place, durationMinutes }),
      });
      if (!res.ok) {
        const code = errorCodeOf(await res.json().catch(() => null));
        setError(livePingErrorMessage(code));
        if (code === 'BAD_REQUEST') setBlocked(true);
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
      <p className="px text-[13px]">LIVE · 가볍게 던지는 초단기 호출</p>

      <label className="flex flex-col gap-1 text-[12px]">
        무엇을 도와달라 / 함께하자? (최대 50자)
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50}
          required
          placeholder="동편 밥친구 구합니다."
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
        <span className="text-right text-[11px] text-muted">{text.length}/50</span>
      </label>

      <label className="flex flex-col gap-1 text-[12px]">
        지금 어디에 있나요? (필수)
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          required
          placeholder="클러스터 2층 b2r4s3"
          className="nb rounded-lg px-2.5 py-2 text-[13px] [--nb-depth:2px]"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-[12px]">
        <legend>얼마나?</legend>
        {/* 진행 방식 세그먼트와 같은 골격이다 — 전체 폭 등분 1덩어리, 칸 사이는 border-left로만
            나눈다. 선택된 칸은 accent-bright다 (FR-001·FR-011). */}
        <div className="nb grid w-full auto-cols-fr grid-flow-col overflow-hidden rounded-lg [--nb-depth:2px]">
          {DURATIONS.map(({ value, label }) => (
            <label
              key={value}
              className={`px grid min-h-[46px] cursor-pointer place-items-center px-1.5 text-center text-[14px] leading-tight [border-left:2px_solid_#18181b] first:[border-left:none] ${
                durationMinutes === value ? 'bg-accent-bright' : 'bg-white hover:bg-accent-soft'
              }`}
            >
              <input
                type="radio"
                name="durationMinutes"
                value={value}
                checked={durationMinutes === value}
                onChange={() => setDurationMinutes(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-[12px] font-bold text-accent-dark">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || blocked}
          // LIVE 계열은 전광판·핑 버튼·제출 버튼이 같은 녹색으로 묶이며 액센트 축 밖이다 (FR-004).
          className="nb px flex-1 rounded-[9px] bg-live px-4 pb-3.5 pt-4 text-[15px] text-white hover:bg-live disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted [--nb-depth:4px]"
        >
          {blocked ? '오늘은 이미 핑을 보냈어요' : pending ? '보내는 중…' : '핑 보내기'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="nb rounded-lg bg-white px-4 py-2.5 text-[14px] font-bold hover:bg-bg [--nb-depth:4px]"
        >
          취소
        </button>
      </div>

      <p className="text-[11px] text-muted">
        입력한 시간이 지나면 피드에서 자동으로 사라져요. 핑은 하루에 한 번만 보낼 수 있습니다.
      </p>
    </form>
  );
}
