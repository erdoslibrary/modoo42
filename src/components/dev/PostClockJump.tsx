'use client';

// 상세 모달의 개발 전용 "이 글 기준으로 이동" (FR-027 프리셋, FR-021).
// 글이 필요한 프리셋 3종은 여기서만 활성된다. 게이트가 닫히면 서버가 렌더하지 않는다.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PRESET_LABELS, type ScenarioPreset } from '@/lib/dev/presets';

/** 글 유형에 따라 의미 있는 프리셋만 보여준다. */
function presetsFor(type: 'STUDY' | 'PARTY' | 'LIVE'): ScenarioPreset[] {
  if (type === 'LIVE') return ['live_before_expiry', 'live_after_expiry'];
  if (type === 'PARTY') return ['party_ended'];
  return ['verdict_open', 'grace_expired'];
}

export function PostClockJump({
  postId,
  type,
}: {
  postId: string;
  type: 'STUDY' | 'PARTY' | 'LIVE';
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function jump(preset: ScenarioPreset) {
    if (pending) return;
    setPending(preset);
    setError(null);
    try {
      const res = await fetch('/api/dev/clock', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ preset, postId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `이동 실패 (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-4 rounded-[8px] border-[2.5px] border-dashed border-ink px-3 py-3">
      <p className="text-[12px] font-bold text-muted">이 글 기준으로 이동 (개발 전용)</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {presetsFor(type).map((preset) => (
          <button
            key={preset}
            onClick={() => void jump(preset)}
            disabled={pending !== null}
            className="rounded-[6px] border-[2.5px] border-ink bg-card px-2 py-1 text-[12px]"
          >
            {pending === preset ? '이동 중…' : PRESET_LABELS[preset]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[11px] text-ink">
          {error}
        </p>
      )}
    </div>
  );
}
