'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorCodeOf, joinErrorMessage } from '@/lib/error-message';
import type { PostDetail } from '@/lib/view-types';

// 참여 확인 팝업 (spec FR-019·FR-020). 네이티브 <dialog>로 포커스 트랩·Esc를 브라우저에 맡긴다
// (research R7). 확정 전에는 아무것도 기록되지 않는다.
// chat_url이 없는 오프라인 전용 모집은 이동할 채팅방이 없다 (CLAUDE.md §7.1). chatPlatform으로 가른다.
const CONFIRM_TEXT_WITH_CHAT =
  '정말 참여하시겠습니까? 참여 후에는 취소가 불가능하며 오픈채팅방으로 이동합니다.';
const CONFIRM_TEXT_NO_CHAT = '정말 참여하시겠습니까? 참여 후에는 취소가 불가능합니다.';

export function JoinConfirmDialog({
  post,
  onJoined,
}: {
  post: PostDetail;
  onJoined: (chatUrl: string | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 언마운트 시 열린 확인 팝업을 닫는다. 정리 시점에는 ref.current가 이미 비어 있을 수 있어
    // 효과 안에서 노드를 잡아 둔다.
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  async function confirm() {
    if (pending) return; // 중복 클릭 차단 (spec FR-020)
    setPending(true);
    setError(null);

    // 팝업 차단 대응: 사용자 제스처 시점에 빈 탭을 먼저 선점하고 응답으로 주소를 채운다
    // (research R9). 응답 후 window.open을 부르면 브라우저가 막는다.
    const tab = window.open('', '_blank');

    try {
      const res = await fetch(`/api/posts/${post.id}/join`, { method: 'POST' });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        tab?.close();
        setError(joinErrorMessage(errorCodeOf(body), post));
        return;
      }

      const chatUrl = (body as { chatUrl?: string | null } | null)?.chatUrl ?? null;
      if (tab && chatUrl) {
        tab.location.href = chatUrl;
      } else {
        tab?.close();
      }

      ref.current?.close();
      onJoined(chatUrl); // 탭이 막혔으면 상세 모달의 링크 버튼으로 복구한다.
      router.refresh(); // 서버가 참여자 기준으로 다시 판정한다 (chat_url 노출 재계산).
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="nb px w-full rounded-[9px] bg-accent px-4 pb-2.5 pt-3 text-[14px] hover:bg-accent-hover [--nb-depth:4px]"
      >
        참여하기 ↗
      </button>

      <dialog
        ref={ref}
        className="nb max-w-[420px] rounded-[10px] bg-card p-5 text-ink backdrop:bg-ink/45 [--nb-depth:4px]"
      >
        <h2 className="px text-[15px]">참여 확인</h2>
        <p className="mt-3 text-[13px] leading-relaxed">
          {post.chatPlatform ? CONFIRM_TEXT_WITH_CHAT : CONFIRM_TEXT_NO_CHAT}
        </p>
        {error && <p className="mt-3 text-[13px] font-bold text-accent-dark">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="nb px flex-1 rounded-lg bg-accent px-3 pb-1.5 pt-2.5 text-[13px] hover:bg-accent-hover disabled:cursor-wait [--nb-depth:2px]"
          >
            {pending ? '처리 중…' : '확인'}
          </button>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            disabled={pending}
            className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-bg [--nb-depth:2px]"
          >
            취소
          </button>
        </div>
      </dialog>
    </>
  );
}
