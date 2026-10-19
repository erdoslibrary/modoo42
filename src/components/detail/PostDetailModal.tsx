'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ParticipantList } from '@/components/detail/ParticipantList';
import { JoinConfirmDialog } from '@/components/detail/JoinConfirmDialog';
import { LeaderActions } from '@/components/detail/LeaderActions';
import { PostClockJump } from '@/components/dev/PostClockJump';
import { CampusBadge } from '@/components/card/CampusBadge';
import { InitialBadge } from '@/components/card/InitialBadge';
import { TagList } from '@/components/card/CardMeta';
import { cycleLabel, ddayLabel, headcountLabel, remainingLabel } from '@/lib/display';
import type { Joinability, PostDetail, ViewerRole } from '@/lib/view-types';

// 상세 모달 (spec FR-016~FR-023). 서버가 ?post= 쿼리로 내려준 데이터만 그린다 —
// 비참여자 응답에는 chatUrl 키가 없다 (헌법 V, research R8).
const LOCATION_LABEL: Record<string, string> = {
  ONLINE: '온라인',
  OFFLINE_GS: '경산 오프라인',
  OFFLINE_SEOUL: '서울 오프라인',
  OFFLINE_ETC: '오프라인',
  HYBRID: '온/오프라인 병행',
};

const PLATFORM_LABEL: Record<string, string> = {
  kakao: '카카오톡 오픈채팅',
  discord: '디스코드',
};

/** 참여 가능 상태 (data-model.md §6). */
function joinabilityOf(post: PostDetail, role: ViewerRole, now: Date): Joinability {
  if (role === 'guest') return 'guest';
  if (post.status === 'CANCELLED') return 'cancelled';
  if (post.status === 'COMPLETED') return 'completed';
  if (post.type === 'PARTY' && post.endDate && post.endDate.getTime() <= now.getTime()) {
    return 'expired';
  }
  if (post.status === 'CLOSED') return 'closed';
  if (post.maxMembers !== null && post.currentMembers >= post.maxMembers) return 'full';
  return 'open';
}

const DISABLED_LABEL: Record<Joinability, string> = {
  open: '참여하기 ↗',
  full: '모집 완료',
  closed: '모집 완료',
  expired: '마감',
  completed: '완주 종료',
  cancelled: '취소된 모집',
  guest: '로그인이 필요합니다',
};

export function PostDetailModal({
  post,
  role,
  now: serverNow,
  devClockJump = false,
}: {
  post: PostDetail;
  role: ViewerRole;
  now: Date;
  /** 개발자 콘솔 게이트가 열렸는지. 서버가 판정해 내려준다 (FR-027). */
  devClockJump?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [chatUrl, setChatUrl] = useState<string | null>(post.chatUrl ?? null);
  const now = new Date(serverNow);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog?.open) dialog?.showModal();
  }, []);

  function close() {
    ref.current?.close();
    // 쿼리에서 post를 지워 뒤로가기·새로고침이 피드로 돌아오게 한다.
    router.push('/dashboard', { scroll: false });
  }

  const joinability = joinabilityOf(post, role, now);
  const isMember = role === 'leader' || role === 'participant';

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="nb w-[min(94vw,640px)] rounded-[10px] bg-card p-0 text-ink backdrop:bg-ink/45 [--nb-depth:4px]"
    >
      <div className="flex max-h-[85vh] flex-col overflow-y-auto p-5">
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <TagList tags={post.tags} />
            <h2 className="px mt-2 text-[17px] leading-snug">{post.title}</h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="nb flex-none rounded-lg bg-white px-2.5 py-1 text-[13px] font-bold hover:bg-bg [--nb-depth:2px]"
          >
            닫기
          </button>
        </header>

        <div className="mt-3 flex items-center gap-2">
          <InitialBadge login={post.leader.login} size="leader" />
          <span className="px text-[13px]">{post.leader.login}</span>
          <CampusBadge campus={post.leader.campus} />
        </div>

        {post.description && (
          // 읽는 글 자리는 ink-soft다 (FR-007).
          <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
            {post.description}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 text-[12px]">
          {post.type === 'STUDY' && (
            <>
              <dt className="text-muted">스터디 기간</dt>
              <dd className="px text-right">{cycleLabel(post.endDate) ?? '미정'}</dd>
            </>
          )}
          {post.type === 'PARTY' && post.endDate && (
            <>
              <dt className="text-muted">마감</dt>
              <dd className="px text-right">{ddayLabel(post.endDate, now)}</dd>
            </>
          )}
          {post.type === 'LIVE' && post.expiresAt && (
            <>
              <dt className="text-muted">남은 시간</dt>
              <dd className="px text-right">{remainingLabel(post.expiresAt, now)}</dd>
            </>
          )}
          <dt className="text-muted">진행 방식</dt>
          <dd className="px text-right">
            {LOCATION_LABEL[post.locationType] ?? post.locationType}
          </dd>
          {post.place && (
            <>
              <dt className="text-muted">장소</dt>
              <dd className="px text-right">{post.place}</dd>
            </>
          )}
          {post.maxMembers !== null && (
            <>
              <dt className="text-muted">모집 현황</dt>
              <dd className="px text-right">
                {headcountLabel(post.currentMembers, post.maxMembers)}
              </dd>
            </>
          )}
          {post.chatPlatform && (
            <>
              <dt className="text-muted">소통 채널</dt>
              <dd className="px text-right">
                {PLATFORM_LABEL[post.chatPlatform] ?? post.chatPlatform}
              </dd>
            </>
          )}
        </dl>

        {post.referenceUrl && (
          <a
            href={post.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 text-[13px] font-bold hover:text-accent-dark"
          >
            이전 활동·참고 링크 ↗
          </a>
        )}

        {post.proofUrl && (
          <a
            href={post.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-[13px] font-bold text-accent-dark hover:underline"
          >
            🏆 완주 결과물 링크 ↗
          </a>
        )}

        {post.status === 'CANCELLED' && post.cancelReason && (
          <p className="nb mt-4 rounded-lg bg-bg p-3 text-[13px] [--nb-depth:2px]">
            취소 사유: {post.cancelReason}
          </p>
        )}

        {post.postmortemText && (
          <div className="nb mt-4 rounded-lg bg-surface p-3.5 text-[13px] [--nb-depth:2px]">
            <p className="px text-[12px] text-ink">🪦 Post-mortem 회고</p>
            <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-ink-soft">
              {post.postmortemText}
            </p>
          </div>
        )}

        {post.type !== 'LIVE' && (
          <div className="mt-5">
            <ParticipantList
              participants={post.participants}
              leaderLogin={post.leader.login}
              maxMembers={post.maxMembers}
            />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {post.type === 'LIVE' ? (
            <p className="text-[12px] text-muted">
              LIVE 핑은 찾아가기 전용입니다. 참여 버튼이 없습니다.
            </p>
          ) : isMember ? (
            <>
              {chatUrl ? (
                <a
                  href={chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nb px block rounded-[10px] bg-accent px-[18px] pb-3.5 pt-4 text-center text-[16px] text-ink hover:bg-accent-hover hover:text-ink [--nb-depth:4px]"
                >
                  오픈채팅 바로가기 ↗
                </a>
              ) : (
                <p className="text-[12px] text-muted">초대 링크가 등록되지 않았습니다.</p>
              )}
              <p className="text-[12px] text-muted">
                참여는 확정 방식입니다. 자진 취소는 지원하지 않습니다.
              </p>
            </>
          ) : joinability === 'open' ? (
            <>
              <JoinConfirmDialog post={post} onJoined={setChatUrl} />
              <p className="text-[12px] text-muted">
                버튼을 누르면 리더의 오픈채팅으로 이동해요.
              </p>
            </>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg border-[2.5px] border-ink/40 bg-bg px-4 py-2.5 text-[14px] font-bold text-muted"
            >
              {DISABLED_LABEL[joinability]}
            </button>
          )}

          {role === 'leader' && post.type !== 'LIVE' && (
            <LeaderActions post={post} role={role} now={now} />
          )}

          {devClockJump && <PostClockJump postId={post.id} type={post.type} />}
        </div>
      </div>
    </dialog>
  );
}
