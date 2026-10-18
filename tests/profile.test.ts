import { describe, it, expect } from 'vitest';
import { withRollback } from './setup/db';
import { getProfile } from '@/lib/profile';
import { participants, posts, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 프로필·스터디 이력 (req FR-019, contracts/profile-view.md).
// 분류 규칙과 노출 필드를 고정한다 — 화면 렌더는 quickstart 수동 시나리오로 본다.
const base = {
  type: 'STUDY' as const,
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/profile',
};

/** end_date까지 직접 지정해 분류·정렬을 결정적으로 만든다. */
async function seedPost(
  tx: Parameters<Parameters<typeof withRollback>[0]>[0],
  leaderId: string,
  values: {
    title: string;
    status: 'RECRUITING' | 'CLOSED' | 'COMPLETED' | 'CANCELLED';
    endDate: Date;
    currentMembers?: number;
    postmortemText?: string;
  },
) {
  const [row] = await tx
    .insert(posts)
    .values({
      ...base,
      leaderId,
      title: values.title,
      status: values.status,
      endDate: values.endDate,
      currentMembers: values.currentMembers ?? 1,
      postmortemText: values.postmortemText ?? null,
    })
    .returning({ id: posts.id });
  return row.id;
}

describe('프로필 이력 분류 (FR-019, SC-007)', () => {
  it('참여 COMPLETED는 완주, RECRUITING·CLOSED+JOINED는 진행중, 그 외는 종료로 분류한다', async () => {
    await withRollback(async (tx) => {
      const tag = `prof_${Date.now()}`;
      const [leader] = await tx
        .insert(users)
        .values({ githubId: `gh_l_${tag}`, login: `l_${tag}`, campus: 'GS' })
        .returning({ id: users.id });
      const [member] = await tx
        .insert(users)
        .values({ githubId: `gh_m_${tag}`, login: `m_${tag}`, campus: 'GS' })
        .returning({ id: users.id });

      // end_date 내림차순이 기대 순서다: done(10월) → ongoing(9월) → closed(8월) → cancelled(7월)
      const done = await seedPost(tx, leader.id, {
        title: '완주한 스터디',
        status: 'COMPLETED',
        endDate: new Date('2026-10-31T14:59:59.999Z'),
        currentMembers: 3,
      });
      const ongoing = await seedPost(tx, member.id, {
        title: '진행 중 스터디',
        status: 'RECRUITING',
        endDate: new Date('2026-09-30T14:59:59.999Z'),
        currentMembers: 4,
      });
      const closed = await seedPost(tx, leader.id, {
        title: '회고만 남은 스터디',
        status: 'CLOSED',
        endDate: new Date('2026-08-31T14:59:59.999Z'),
        currentMembers: 5,
        postmortemText: '목표를 못 채웠다.',
      });
      const cancelled = await seedPost(tx, leader.id, {
        title: '취소된 스터디',
        status: 'CANCELLED',
        endDate: new Date('2026-07-31T14:59:59.999Z'),
        currentMembers: 2,
      });

      await tx.insert(participants).values([
        { postId: done, userId: member.id, status: 'COMPLETED' },
        // 같은 글의 다른 완주자 — "N명 완주" 표기가 참여 레코드를 센다.
        { postId: done, userId: leader.id, status: 'COMPLETED' },
        { postId: ongoing, userId: member.id, status: 'JOINED' },
        { postId: closed, userId: member.id, status: 'INCOMPLETE' },
        { postId: cancelled, userId: member.id, status: 'JOINED' },
      ]);
      await tx
        .update(users)
        .set({ completedCount: 1, leaderCount: 1 })
        .where(eq(users.id, member.id));

      const profile = await getProfile(member.id, tx);

      expect(profile.login).toBe(`m_${tag}`);
      expect(profile.campus).toBe('GS');
      expect(profile.initials).toBe('M_');
      // 누적 수치는 users 저장값을 그대로 읽는다 — 이력에서 다시 세지 않는다.
      expect(profile.completedCount).toBe(1);
      expect(profile.leaderCount).toBe(1);

      expect(profile.history.map((h) => [h.postId, h.category, h.isLeader])).toEqual([
        [done, 'COMPLETED', false],
        [ongoing, 'ONGOING', true],
        [closed, 'ENDED', false],
        [cancelled, 'ENDED', false],
      ]);

      const [first, second, third] = profile.history;
      expect(first.title).toBe('완주한 스터디');
      expect(first.periodLabel).toBe('26.10');
      expect(first.headcountLabel).toBe('2명 완주');
      expect(first.hasPostmortem).toBe(false);

      expect(second.headcountLabel).toBe('4/6명');
      // 회고 등록은 상태 전이가 아니므로 분류를 바꾸지 않는다 (req FR-009).
      expect(third.category).toBe('ENDED');
      expect(third.hasPostmortem).toBe(true);
    });
  });

  it('공개 투영을 넘는 식별자와 chat_url을 싣지 않는다', async () => {
    await withRollback(async (tx) => {
      const tag = `prof_fields_${Date.now()}`;
      const [me] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag, intraId: `intra_${tag}` })
        .returning({ id: users.id });
      const post = await seedPost(tx, me.id, {
        title: '필드 확인',
        status: 'RECRUITING',
        endDate: new Date('2026-10-31T14:59:59.999Z'),
      });
      await tx.insert(participants).values({ postId: post, userId: me.id, status: 'JOINED' });

      const profile = await getProfile(me.id, tx);

      for (const key of ['id', 'githubId', 'intraId', 'intraVerifiedAt', 'chatUrl', 'avatarUrl']) {
        expect(key in profile).toBe(false);
      }
      for (const key of ['chatUrl', 'leaderId']) {
        expect(key in profile.history[0]).toBe(false);
      }
      // campus는 GitHub 인증만 한 유저에서 null이다 (CLAUDE.md §7.2).
      expect(profile.campus).toBeNull();
    });
  });

  it('이력이 없는 유저는 빈 이력과 0 카운트를 받는다', async () => {
    await withRollback(async (tx) => {
      const tag = `prof_empty_${Date.now()}`;
      const [me] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag })
        .returning({ id: users.id });

      const profile = await getProfile(me.id, tx);
      expect(profile.history).toEqual([]);
      expect(profile.completedCount).toBe(0);
      expect(profile.leaderCount).toBe(0);
    });
  });

  it('없는 유저 → NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      await expect(
        getProfile('00000000-0000-0000-0000-000000000000', tx),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
