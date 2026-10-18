// 프로필·스터디 이력 조회 (req FR-019, contracts/profile-view.md).
// HTTP 엔드포인트를 늘리지 않고 서버 컴포넌트가 직접 부르는 내부 조회다 (research R1·R13).
// 신규 테이블·컬럼을 쓰지 않는다 — users 1행 + participants ⋈ posts 1회로 만든다.
import { desc, eq, sql } from 'drizzle-orm';
import { participants, posts, users } from '@/db/schema';
import { AppError } from '@/lib/errors';
import { headcountLabel, initials, periodLabel } from '@/lib/display';
import { toPublicUser } from '@/lib/public-user';
import type { Database } from '@/lib/posts';
import { db as defaultDb } from '@/db';
import type { HistoryCategory, HistoryItem, PostType, ProfileView } from '@/lib/view-types';

/**
 * 이력 분류 (contracts/profile-view.md). 위에서 아래로 처음 맞는 하나를 쓴다.
 * 참여 상태 LEFT·REMOVED는 구현하지 않는 미사용 값이라 분기를 만들지 않는다 (CLAUDE.md §6.2).
 */
function categoryOf(participantStatus: string, postStatus: string): HistoryCategory {
  if (participantStatus === 'COMPLETED') return 'COMPLETED';
  if ((postStatus === 'RECRUITING' || postStatus === 'CLOSED') && participantStatus === 'JOINED') {
    return 'ONGOING';
  }
  return 'ENDED';
}

export async function getProfile(
  userId: string,
  database: Database = defaultDb,
): Promise<ProfileView> {
  const [me] = await database
    .select({
      login: users.login,
      campus: users.campus,
      completedCount: users.completedCount,
      leaderCount: users.leaderCount,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!me) throw new AppError('NOT_FOUND', '유저가 존재하지 않습니다.');

  // 완주 인원은 같은 쿼리의 스칼라 서브쿼리로 센다 — 조회 횟수를 늘리지 않는다.
  const completedMembers = sql<number>`(
    select cast(count(*) as int) from participants cp
    where cp.post_id = ${posts.id} and cp.status = 'COMPLETED'
  )`;

  const rows = await database
    .select({
      postId: posts.id,
      title: posts.title,
      type: posts.type,
      leaderId: posts.leaderId,
      postStatus: posts.status,
      participantStatus: participants.status,
      endDate: posts.endDate,
      createdAt: posts.createdAt,
      currentMembers: posts.currentMembers,
      maxMembers: posts.maxMembers,
      postmortemText: posts.postmortemText,
      completedMembers,
    })
    .from(participants)
    .innerJoin(posts, eq(participants.postId, posts.id))
    .where(eq(participants.userId, userId))
    // 최신순. end_date가 없는 글(LIVE 핑)은 created_at으로 줄을 세운다.
    .orderBy(desc(sql`coalesce(${posts.endDate}, ${posts.createdAt})`));

  const history: HistoryItem[] = rows.map((row) => {
    const category = categoryOf(row.participantStatus, row.postStatus);
    return {
      postId: row.postId,
      title: row.title,
      type: row.type as PostType,
      category,
      // 분류와 독립이다. 리더 본인이면 뱃지를 덧붙인다.
      isLeader: row.leaderId === userId,
      periodLabel: periodLabel(row.endDate ?? row.createdAt),
      headcountLabel:
        category === 'COMPLETED'
          ? `${row.completedMembers}명 완주`
          : headcountLabel(row.currentMembers, row.maxMembers),
      // 회고는 상태 전이가 아니므로 분류를 바꾸지 않는다 (req FR-009).
      hasPostmortem: Boolean(row.postmortemText),
    };
  });

  // 누적 수치는 users 저장값이 SSOT다. 완주 판정(FR-008)이 가산한 값을 다시 세지 않는다.
  return {
    ...toPublicUser(me),
    initials: initials(me.login),
    completedCount: me.completedCount,
    leaderCount: me.leaderCount,
    history,
  };
}
