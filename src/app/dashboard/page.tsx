// 대시보드 (FR-013). 서버 컴포넌트가 도메인 함수를 직접 호출한다 — 자기 서버에 HTTP를
// 다시 쏘지 않는다 (research.md R1).
import { AppShell } from '@/components/layout/AppShell';
import { LoginRequired } from '@/components/layout/LoginRequired';
import { RealtimeFeed } from '@/components/feed/RealtimeFeed';
import { ArchiveTabs } from '@/components/feed/ArchiveTabs';
import { Leaderboard } from '@/components/feed/Leaderboard';
import { CliFooter } from '@/components/feed/CliFooter';
import { PostDetailModal } from '@/components/detail/PostDetailModal';
import { getCurrentUser } from '@/lib/auth';
import { AppError } from '@/lib/errors';
import { getLeaderboard, getPostDetail, listHallOfFame, listPosts } from '@/lib/posts';
import { toPublicUser } from '@/lib/public-user';
import type { PostDetail, ViewerRole } from '@/lib/view-types';

// 세션마다 내용이 다르고 LIVE 핑의 만료가 시각에 걸려 있어 정적 프리렌더 대상이 아니다.
// Phase 3의 Mock 인증은 상용에서 비활성이라 쿠키를 읽지 않으므로, 선언하지 않으면
// 빌드 시 "로그인이 필요합니다" 화면이 정적으로 박힌다.
export const dynamic = 'force-dynamic';

type SearchParams = { sort?: string; archive?: string; post?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const me = await getCurrentUser();
  if (!me) {
    return (
      <AppShell me={null}>
        <LoginRequired />
      </AppShell>
    );
  }

  const sort = searchParams.sort === 'deadline' ? 'deadline' : 'latest';
  const archiveKind = searchParams.archive === 'postmortem' ? 'postmortem' : 'completed';
  const now = new Date();

  const [pings, parties, studies, completed, postmortem, ranking] = await Promise.all([
    listPosts({ type: 'LIVE' }, undefined, now),
    listPosts({ type: 'PARTY', status: 'RECRUITING', sort: 'deadline' }, undefined, now),
    listPosts({ type: 'STUDY', status: 'RECRUITING', sort }, undefined, now),
    listHallOfFame('completed'),
    listHallOfFame('postmortem'),
    getLeaderboard(),
  ]);

  // 전광판은 만료 임박순 — "지금 당장" 정보가 앞에 온다 (listForCli와 같은 기준).
  const sortedPings = [...pings].sort(
    (a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0),
  );

  // 상세 모달은 쿼리로 열린다. 마스킹 판정은 서버가 하므로(헌법 V) 응답을 그대로 내려준다.
  // 없는 글 id가 들어와도 피드는 그려야 하므로 NOT_FOUND는 모달 미표시로 흘린다.
  let detail: PostDetail | null = null;
  if (searchParams.post) {
    try {
      detail = await getPostDetail(searchParams.post, me.id);
    } catch (err) {
      if (!(err instanceof AppError) || err.code !== 'NOT_FOUND') throw err;
    }
  }

  const role: ViewerRole = !detail
    ? 'visitor'
    : detail.leader.login === me.login
      ? 'leader'
      : detail.participants.some((p) => p.login === me.login)
        ? 'participant'
        : 'visitor';

  return (
    <AppShell me={toPublicUser(me)}>
      {/* 블록 순서는 LIVE → 파티 → 스터디 → (아카이브 + 랭킹) → CLI다. 섹션 간격 34px
          (FR-017, interactions.md §3.5). 열 전환 분기점은 xl 하나만 쓴다 (C3-L5). */}
      <div className="flex flex-col gap-[34px]">
        <RealtimeFeed
          initial={{ pings: sortedPings, parties, studies }}
          now={now}
          myLogin={me.login}
          sort={sort}
          archive={searchParams.archive ?? null}
        />

        {/* 랭킹은 아카이브와 같은 행의 오른쪽이다. 스터디 그리드의 사이드바가 아니다 (C3-L4). */}
        <div className="grid gap-[22px] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <ArchiveTabs
            kind={archiveKind}
            completed={completed}
            postmortem={postmortem}
            sort={sort}
          />
          <Leaderboard rows={ranking} />
        </div>

        <CliFooter />

        {detail && <PostDetailModal post={detail} role={role} now={now} />}
      </div>
    </AppShell>
  );
}
