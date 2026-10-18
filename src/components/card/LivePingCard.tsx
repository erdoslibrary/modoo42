'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { remainingLabel } from '@/lib/display';
import { errorCodeOf, errorMessage } from '@/lib/error-message';
import type { FeedPost } from '@/lib/view-types';

// LIVE 핑 카드 (spec FR-008·FR-013). 참여 버튼이 없다 — 찾아가기 전용 전광판이다 (prd §1-5).
// [완료]는 작성자 본인에게만 보인다. 만료는 상태 전이가 아니므로 서버에 알리지 않는다.
export function LivePingCard({
  post,
  now,
  isAuthor,
}: {
  post: FeedPost;
  now: Date;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function complete() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/complete-ping`, { method: 'POST' });
      if (!res.ok) {
        setError(errorMessage(errorCodeOf(await res.json().catch(() => null))));
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="nb flex w-[280px] flex-none flex-col gap-2 rounded-[10px] bg-card p-3.5">
      <header className="flex items-center gap-2">
        {/* 이 점이 사라지면 '지금 유효하다'는 상태를 알 수 없다 (CLAUDE.md §10 등재 예외). */}
        <span className="live-dot h-2 w-2 flex-none rounded-full bg-live" aria-hidden="true" />
        {/* 한글·영문 문구 칩은 Pretendard다 — 버튼·탭 규칙을 칩까지 넓히지 않는다 (FR-009). */}
        <span className="text-[11px] font-extrabold tracking-[0.5px] text-live">LIVE</span>
        <span className="ml-auto px text-[11px]">
          {post.expiresAt ? remainingLabel(post.expiresAt, now) : ''}
        </span>
      </header>

      <p className="text-[13px] font-bold leading-snug">{post.title}</p>
      {post.place && <p className="text-[12px] text-muted-soft">{post.place}</p>}

      {isAuthor && (
        <button
          type="button"
          onClick={complete}
          disabled={pending}
          className="nb mt-1 rounded-lg bg-bg px-3 py-1.5 text-[12px] font-bold hover:bg-accent-soft disabled:cursor-wait [--nb-depth:2px]"
        >
          {pending ? '처리 중…' : '완료'}
        </button>
      )}

      {error && <p className="text-[12px] text-accent-dark">{error}</p>}
    </article>
  );
}
