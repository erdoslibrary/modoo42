'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CompletionModal } from '@/components/detail/CompletionModal';
import { useDevClock } from '@/components/dev/ClockProvider';
import { errorCodeOf, errorMessage } from '@/lib/error-message';
import {
  buildUpdatePatch,
  completionActionStateOf,
  leaderActionStateOf,
} from '@/lib/leader-actions';
import type { PostDetail, ViewerRole } from '@/lib/view-types';

// 리더 전용 관리 입구 (FR-004 마감/재모집 토글, FR-005 중도 취소, FR-006 게시글 수정, FR-008 완주 판정, FR-009 회고 등록, FR-021).
// 화면에서 가리는 것은 보조이고 거절은 서버가 한다 (FR-017).
export function LeaderActions({
  post,
  role = 'leader',
  now,
}: {
  post: PostDetail;
  role?: ViewerRole;
  /** 서버가 내려준 유효 시각. 생략하면 클라이언트 쪽 유효 시각을 쓴다 (FR-027). */
  now?: Date;
}) {
  const router = useRouter();
  const clock = useDevClock();
  const effectiveNow = now ?? clock.now();
  const editRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLDialogElement>(null);
  const completionRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = leaderActionStateOf(post, role, effectiveNow);
  const completionState = completionActionStateOf(post, role, effectiveNow);
  if (!state.visible) return null;

  const isOnlineRequired = post.locationType === 'ONLINE' || post.locationType === 'HYBRID';

  async function send(
    url: string,
    method: 'PUT' | 'POST',
    payload: unknown,
    dialog?: HTMLDialogElement | null,
  ) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(errorMessage(errorCodeOf(await res.json().catch(() => null))));
        return;
      }
      dialog?.close();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t-[1.5px] border-ink/15 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted">리더 전용</p>
        {post.status === 'CLOSED' && (
          <span className="text-[11px] text-muted">
            마감 상태에서는 수정할 수 없습니다 (재모집 후 수정 가능)
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!state.canEdit || pending}
          onClick={() => {
            setError(null);
            editRef.current?.showModal();
          }}
          className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 [--nb-depth:2px]"
        >
          수정하기
        </button>
        <button
          type="button"
          disabled={!state.canToggleStatus || pending}
          onClick={() =>
            void send(`/api/posts/${post.id}/status`, 'POST', { status: state.nextToggleStatus })
          }
          className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 [--nb-depth:2px]"
        >
          {state.toggleLabel}
        </button>
        <button
          type="button"
          disabled={!state.canCancel || pending}
          onClick={() => {
            setError(null);
            cancelRef.current?.showModal();
          }}
          className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50 [--nb-depth:2px]"
        >
          모집 취소
        </button>
      </div>

      {completionState.showEntry && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={!completionState.canOpenModal || pending}
            onClick={() => {
              setError(null);
              completionRef.current?.showModal();
            }}
            className="nb px w-full rounded-lg bg-accent-soft px-3 pb-1.5 pt-2.5 text-[13px] text-ink hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 [--nb-depth:2px]"
          >
            {completionState.entryLabel}
          </button>
          {completionState.entryHint && (
            <p className="text-[11px] text-muted">{completionState.entryHint}</p>
          )}
        </div>
      )}

      {error && <p className="text-[12px] font-bold text-accent-dark">{error}</p>}

      <dialog
        ref={editRef}
        className="nb w-[min(92vw,440px)] rounded-[10px] bg-card p-5 text-ink backdrop:bg-ink/45 [--nb-depth:4px]"
      >
        <h2 className="px text-[15px]">게시글 수정</h2>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const built = buildUpdatePatch(
              {
                title: String(form.get('title') ?? ''),
                description: String(form.get('description') ?? ''),
                place: String(form.get('place') ?? ''),
                chatUrl: String(form.get('chatUrl') ?? ''),
              },
              post.locationType,
            );
            if (!built.ok) {
              setError(built.message);
              return;
            }
            void send(`/api/posts/${post.id}`, 'PUT', built.patch, editRef.current);
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            제목 (최대 40자)
            <input
              name="title"
              defaultValue={post.title}
              maxLength={40}
              required
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            설명 (최대 300자, 비우면 삭제)
            <textarea
              name="description"
              defaultValue={post.description ?? ''}
              maxLength={300}
              rows={3}
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            장소 (비우면 삭제)
            <input
              name="place"
              defaultValue={post.place ?? ''}
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            초대 링크 (카카오 오픈채팅 또는 디스코드{isOnlineRequired ? ', 필수' : ', 선택'})
            <input
              name="chatUrl"
              defaultValue={post.chatUrl ?? ''}
              required={isOnlineRequired}
              placeholder="https://open.kakao.com/o/..."
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>

          {error && <p className="text-[12px] font-bold text-accent-dark">{error}</p>}

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="nb px flex-1 rounded-lg bg-accent px-3 pb-1.5 pt-2.5 text-[13px] hover:bg-accent-hover disabled:cursor-wait [--nb-depth:2px]"
            >
              {pending ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => editRef.current?.close()}
              className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-bg [--nb-depth:2px]"
            >
              닫기
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={cancelRef}
        className="nb w-[min(92vw,420px)] rounded-[10px] bg-card p-5 text-ink backdrop:bg-ink/45 [--nb-depth:4px]"
      >
        <h2 className="px text-[15px]">모집 취소</h2>
        <p className="mt-3 text-[13px] leading-relaxed">
          취소하면 되돌릴 수 없고 신규 참여·수정이 모두 막힙니다. 사유는 참여자에게 표시됩니다.
        </p>
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const reason = String(form.get('reason') ?? '').trim();
            if (reason.length < 1 || reason.length > 300) {
              setError('취소 사유를 1~300자로 입력해 주세요.');
              return;
            }
            void send(`/api/posts/${post.id}/cancel`, 'POST', { reason }, cancelRef.current);
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            취소 사유 (최대 300자)
            <textarea
              name="reason"
              rows={3}
              maxLength={300}
              required
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>

          {error && <p className="text-[12px] font-bold text-accent-dark">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="nb px flex-1 rounded-lg bg-accent px-3 pb-1.5 pt-2.5 text-[13px] hover:bg-accent-hover disabled:cursor-wait [--nb-depth:2px]"
            >
              {pending ? '처리 중…' : '취소 확정'}
            </button>
            <button
              type="button"
              onClick={() => cancelRef.current?.close()}
              className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-bg [--nb-depth:2px]"
            >
              닫기
            </button>
          </div>
        </form>
      </dialog>

      <CompletionModal ref={completionRef} post={post} state={completionState} />
    </div>
  );
}
