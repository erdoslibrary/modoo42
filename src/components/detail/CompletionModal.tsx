'use client';

import { forwardRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CampusBadge } from '@/components/card/CampusBadge';
import { InitialBadge } from '@/components/card/InitialBadge';
import { errorCodeOf, errorMessage } from '@/lib/error-message';
import {
  buildCompletePayload,
  buildPostmortemPayload,
  type CompletionActionState,
} from '@/lib/leader-actions';
import type { PostDetail } from '@/lib/view-types';

// 완주 판정(FR-008) & Post-mortem 회고 등록(FR-009) 통합 모달.
// 디자인 원본: docs/designs/complete.html, docs/designs/complete_postmortem.html.
export const CompletionModal = forwardRef<
  HTMLDialogElement,
  {
    post: PostDetail;
    state: CompletionActionState;
  }
>(function CompletionModal({ post, state }, ref) {
  const router = useRouter();
  const members = post.verdictMembers ?? [];
  const [choice, setChoice] = useState<'complete' | 'postmortem'>(
    state.defaultChoice ?? 'postmortem',
  );
  const [checkedIds, setCheckedIds] = useState<string[]>(() => members.map((m) => m.userId));
  const [proofUrl, setProofUrl] = useState(post.proofUrl ?? '');
  const [postmortemText, setPostmortemText] = useState(post.postmortemText ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setChoice(state.defaultChoice ?? 'postmortem');
  }, [state.defaultChoice]);

  useEffect(() => {
    setCheckedIds((post.verdictMembers ?? []).map((m) => m.userId));
  }, [post.verdictMembers]);

  function close() {
    if (ref && 'current' in ref) {
      ref.current?.close();
    }
  }

  function toggleMember(userId: string) {
    setCheckedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleSubmit() {
    if (pending) return;
    setError(null);

    if (choice === 'complete') {
      const built = buildCompletePayload({
        evaluations: members.map((m) => ({
          userId: m.userId,
          isCompleted: checkedIds.includes(m.userId),
        })),
        proofUrl,
      });
      if (!built.ok) {
        setError(built.message);
        return;
      }
      await send(`/api/posts/${post.id}/complete`, built.payload);
      return;
    }

    const built = buildPostmortemPayload(postmortemText);
    if (!built.ok) {
      setError(built.message);
      return;
    }
    await send(`/api/posts/${post.id}/postmortem`, built.payload);
  }

  async function send(url: string, payload: unknown) {
    setPending(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(errorMessage(errorCodeOf(await res.json().catch(() => null))));
        return;
      }
      close();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const firstTag = post.tags[0];

  return (
    <dialog
      ref={ref}
      className="nb w-[min(94vw,680px)] overflow-hidden rounded-[16px] bg-card p-0 text-ink backdrop:bg-ink/45 [--nb-depth:8px]"
    >
      <div className="flex max-h-[88vh] flex-col overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b-[3px] border-ink bg-bg px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 className="px text-[20px] tracking-[0.2px] sm:text-[22px]">
              스터디를 마무리할게요
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[14px] text-muted">
              {firstTag && (
                <span className="rounded-[6px] border-[1.5px] border-accent-dark bg-accent-soft px-2 py-0.5 text-[12.5px] font-bold text-accent-dark">
                  #{firstTag}
                </span>
              )}
              <span className="truncate">{post.title}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="모달 닫기"
            className="nb h-9 w-9 flex-none rounded-[8px] bg-white text-[16px] font-bold text-ink hover:bg-bg [--nb-depth:2px]"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <p className="mb-4 text-[13.5px] leading-[1.55] text-muted">
            지난 사이클은 어땠나요? 두 기록 모두 똑같이 소중해요. 편하게 하나를 골라주세요.
          </p>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              disabled={!state.canComplete}
              onClick={() => {
                setError(null);
                setChoice('complete');
              }}
              className={`nb relative flex min-h-[120px] flex-col gap-2.5 rounded-[12px] p-4 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                choice === 'complete'
                  ? 'bg-accent-soft [--nb-depth:5px]'
                  : 'bg-white [--nb-depth:2px]'
              }`}
            >
              {choice === 'complete' && (
                <span className="absolute right-3.5 top-3.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-accent text-[12px] font-extrabold text-ink">
                  ✓
                </span>
              )}
              <span className="grid h-11 w-11 place-items-center rounded-[9px] bg-accent-soft p-1">
                <span className="text-[26px] leading-none">🏆</span>
              </span>
              <span className="px text-[15px] tracking-[-0.2px] text-ink">완주했어요</span>
              <span className="text-[12.5px] leading-[1.45] text-muted">
                {state.canComplete
                  ? '결과물을 남기고 명예의 전당에 올려요.'
                  : (state.completeDisabledReason ?? '완주 판정을 진행할 수 없습니다.')}
              </span>
            </button>

            <button
              type="button"
              disabled={!state.canPostmortem}
              onClick={() => {
                setError(null);
                setChoice('postmortem');
              }}
              className={`nb relative flex min-h-[120px] flex-col gap-2.5 rounded-[12px] p-4 text-left disabled:cursor-not-allowed disabled:opacity-55 ${
                choice === 'postmortem'
                  ? 'bg-chip [--nb-depth:5px]'
                  : 'bg-white [--nb-depth:2px]'
              }`}
            >
              {choice === 'postmortem' && (
                <span className="absolute right-3.5 top-3.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-ink text-[12px] font-extrabold text-white">
                  ✓
                </span>
              )}
              <span className="grid h-11 w-11 place-items-center rounded-[9px] bg-chip p-1">
                <span className="text-[26px] leading-none">🪦</span>
              </span>
              <span className="px text-[15px] tracking-[-0.2px] text-ink">
                Post-mortem 남기기
              </span>
              <span className="text-[12.5px] leading-[1.45] text-muted">
                완주만큼 가치 있는 기록이에요.
              </span>
            </button>
          </div>

          {choice === 'complete' ? (
            <div className="nb mt-5 flex flex-col gap-4 rounded-[12px] bg-accent-soft p-5 [--nb-depth:4px]">
              <div>
                <p className="text-[14px] font-extrabold text-accent-dark">
                  함께 완주한 팀원을 체크해주세요 (최소 1명 필수)
                </p>
                <p className="mt-1 text-[12.5px] text-accent-dark">
                  체크된 팀원과 리더 본인에게 완주 기록이 부여됩니다.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {members.map((member) => {
                    const checked = checkedIds.includes(member.userId);
                    return (
                      <label
                        key={member.userId}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-[8px] border-2 border-ink bg-white px-3 py-2.5"
                      >
                        <span className="flex items-center gap-2">
                          <InitialBadge login={member.login} size="list" />
                          <span className="px text-[13px]">{member.login}</span>
                          <CampusBadge campus={member.campus} />
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(member.userId)}
                          className="h-4 w-4 accent-accent-dark"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[14px] font-extrabold text-accent-dark">
                  결과물 링크를 남겨주세요 (선택)
                </label>
                <p className="mt-1 text-[12.5px] text-accent-dark">
                  GitHub 레포, Notion 회고 등 완주의 흔적을 남기면 상세 화면에 전시돼요.
                </p>
                <div className="mt-2.5 flex items-center gap-2.5 rounded-[8px] border-2 border-ink bg-white px-2.5">
                  <span className="px grid h-8 w-8 flex-none place-items-center rounded-[6px] border-2 border-ink bg-ink text-[11px] text-white">
                    URL
                  </span>
                  <input
                    name="proofUrl"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    placeholder="https://github.com/..."
                    className="h-11 flex-1 border-none bg-transparent text-[14px] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="nb mt-5 rounded-[12px] bg-chip p-5 [--nb-depth:4px]">
              <label className="block text-[14px] font-extrabold text-ink">
                Post-mortem 회고 (1~1000자)
              </label>
              <p className="mt-1 text-[12.5px] text-muted">
                완주만큼 가치 있는 기록이에요. 다음 스터디의 좋은 레퍼런스가 됩니다.
              </p>
              <textarea
                name="postmortemText"
                value={postmortemText}
                onChange={(e) => setPostmortemText(e.target.value)}
                maxLength={1000}
                placeholder="왜 중단했나요? 무엇을 배웠나요? — 솔직한 회고는 다른 카뎃에게 좋은 레퍼런스가 됩니다."
                className="mt-3 min-h-[140px] w-full resize-y rounded-[8px] border-2 border-ink bg-white p-3.5 text-[14px] leading-[1.6]"
              />
            </div>
          )}

          {error && <p className="mt-3 text-[12.5px] font-bold text-accent-dark">{error}</p>}

          <div className="mt-6 flex items-center justify-end gap-3.5">
            <button
              type="button"
              onClick={close}
              className="px-2 py-2.5 text-[14px] font-bold text-muted hover:text-ink"
            >
              나중에 할게요
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleSubmit()}
              className={`nb px rounded-[9px] px-6 py-3 text-[15px] disabled:cursor-wait [--nb-depth:4px] ${
                choice === 'complete'
                  ? 'bg-accent text-ink hover:bg-accent-hover'
                  : 'bg-ink text-white'
              }`}
            >
              {pending ? '저장 중…' : '기록 남기기'}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
});
