'use client';

// /login의 개발 전용 콘솔 입구 (FR-027, prd.md F7).
// 게이트가 닫히면 서버(ConsoleEntryGate)가 이 컴포넌트를 렌더하지 않는다.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ConsoleEntry() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enter() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/console', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error === 'SANDBOX_STALE'
            ? 'dev_sandbox 스키마가 낡았습니다. pnpm sandbox:sync를 실행하세요.'
            : data?.error === 'UNAUTHORIZED'
              ? '비밀번호가 올바르지 않습니다.'
              : `진입에 실패했습니다 (${res.status}).`,
        );
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-5 w-full rounded-[8px] border-[2.5px] border-ink bg-card px-4 py-3 text-[13px] text-muted"
      >
        개발자 콘솔로 진입
      </button>
    );
  }

  return (
    <div className="mt-5 rounded-[8px] border-[2.5px] border-ink bg-card p-4">
      <p className="text-[13px] leading-relaxed text-ink">
        이 세션에서 만든 데이터는 <code>dev_sandbox</code>에 들어가고 다음 진입 시 사라집니다.
        오픈채팅방 링크는 더미입니다.
      </p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void enter();
        }}
        placeholder="콘솔 비밀번호"
        className="mt-3 w-full rounded-[6px] border-[2.5px] border-ink bg-white px-3 py-2 text-[14px]"
      />
      {error && (
        <p role="alert" className="mt-2 text-[12px] leading-relaxed text-ink">
          {error}
        </p>
      )}
      <button
        onClick={() => void enter()}
        disabled={pending || password === ''}
        className="nb px mt-3 w-full rounded-[8px] bg-accent px-4 pb-[10px] pt-3 text-[14px] text-ink [--nb-depth:3px]"
      >
        {pending ? '진입 중…' : '진입'}
      </button>
    </div>
  );
}
