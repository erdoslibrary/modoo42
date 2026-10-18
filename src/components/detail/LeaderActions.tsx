'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { errorCodeOf, errorMessage } from '@/lib/error-message';
import type { PostDetail } from '@/lib/view-types';

// 리더 전용 관리 입구 (spec FR-023). 화면에서 가리는 것은 보조이고 거절은 서버가 한다 (FR-017).
// 완주 판정·회고 등록 버튼은 만들지 않는다 — 그 화면은 FR-021 후속 브랜치다 (spec FR-045).
export function LeaderActions({ post }: { post: PostDetail }) {
  const router = useRouter();
  const editRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFinal = post.status === 'COMPLETED' || post.status === 'CANCELLED';

  async function send(url: string, method: 'PUT' | 'POST', payload: unknown, dialog?: HTMLDialogElement | null) {
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

  if (isFinal) return null;

  return (
    <div className="flex flex-col gap-2 border-t-[1.5px] border-ink/15 pt-3">
      <p className="text-[12px] text-muted">리더 전용</p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => editRef.current?.showModal()}
          className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-accent-soft [--nb-depth:2px]"
        >
          수정하기
        </button>
        <button
          type="button"
          onClick={() => cancelRef.current?.showModal()}
          className="nb flex-1 rounded-lg bg-white px-3 py-2 text-[13px] font-bold hover:bg-accent-soft [--nb-depth:2px]"
        >
          모집 취소
        </button>
      </div>

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
            // 부분 수정이다. 빈 값을 보내면 서버 Zod가 거절하므로 채운 항목만 보낸다.
            const patch: Record<string, string> = {};
            for (const key of ['title', 'description', 'place', 'chatUrl'] as const) {
              const value = String(form.get(key) ?? '').trim();
              if (value) patch[key] = value;
            }
            void send(`/api/posts/${post.id}`, 'PUT', patch, editRef.current);
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
            설명 (최대 300자)
            <textarea
              name="description"
              defaultValue={post.description ?? ''}
              maxLength={300}
              rows={3}
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            장소
            <input
              name="place"
              defaultValue={post.place ?? ''}
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            초대 링크 (카카오 오픈채팅 또는 디스코드)
            <input
              name="chatUrl"
              defaultValue={post.chatUrl ?? ''}
              placeholder="https://open.kakao.com/o/..."
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>

          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="nb flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-bold hover:bg-accent-hover disabled:cursor-wait [--nb-depth:2px]"
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
            void send(
              `/api/posts/${post.id}/cancel`,
              'POST',
              { reason: String(form.get('reason') ?? '') },
              cancelRef.current,
            );
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            취소 사유
            <textarea
              name="reason"
              rows={3}
              required
              className="nb rounded-lg px-2 py-1.5 text-[13px] [--nb-depth:2px]"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="nb flex-1 rounded-lg bg-accent px-3 py-2 text-[13px] font-bold hover:bg-accent-hover disabled:cursor-wait [--nb-depth:2px]"
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
    </div>
  );
}
