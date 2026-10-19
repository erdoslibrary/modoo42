import { describe, it, expect } from 'vitest';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, getPostDetail, joinPost, listPosts, postmortemPost } from '@/lib/posts';
import { participants, posts, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const input = {
  type: 'STUDY' as const,
  title: '마스킹 테스트',
  tags: ['자유'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/secret',
  referenceUrl: 'https://github.com/x/y',
};

describe('링크 가시성 (FR-006, SC-005)', () => {
  it('비참여자 상세 → chatUrl 키 없음, chatPlatform·referenceUrl은 공개', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const outsider = await resolvePersonaUser('seoul_member', tx);
      const post = await createPost(input, leader!.id, tx, new Date());

      const detail = await getPostDetail(post.id, outsider!.id, tx);
      expect('chatUrl' in detail).toBe(false);
      expect(detail.chatPlatform).toBe('kakao');
      expect(detail.referenceUrl).toBe('https://github.com/x/y');
      expect(detail.expiresAt).toBeNull(); // LIVE 전용 필드. STUDY는 null.
    });
  });

  it('참여자(리더) 상세 → chatUrl 포함', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const post = await createPost(input, leader!.id, tx, new Date());

      const detail = await getPostDetail(post.id, leader!.id, tx);
      expect(detail.chatUrl).toBe('https://open.kakao.com/o/secret');
    });
  });

  it('TC-IDENT-04: 상세의 유저 투영은 login·campus뿐이고 42 식별자는 싣지 않는다', async () => {
    await withRollback(async (tx) => {
      const tag = `det_${Date.now()}`;
      const [leader] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag })
        .returning({ id: users.id });
      const post = await createPost(input, leader.id, tx, new Date());

      const detail = await getPostDetail(post.id, leader.id, tx);
      expect(detail.leader).toEqual({ login: tag, campus: null });
      expect(detail.participants).toEqual([{ login: tag, campus: null }]);
      for (const u of [detail.leader, ...(detail.participants as unknown[])] as Record<string, unknown>[]) {
        expect('intraId' in u).toBe(false);
        expect('intraVerifiedAt' in u).toBe(false);
        expect('githubId' in u).toBe(false);
      }
    });
  });

  it('존재하지 않는 글 상세 → NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      const viewer = await resolvePersonaUser('gs_member', tx);
      await expect(
        getPostDetail('00000000-0000-0000-0000-000000000000', viewer!.id, tx),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  it('리스트 → 모든 항목에 chatUrl 키 없음', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      await createPost(input, leader!.id, tx, new Date());

      const rows = await listPosts({ type: 'STUDY' }, tx, new Date());
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect('chatUrl' in r).toBe(false);
      }
    });
  });

  it('FR-021 (007b): 리더 본인 조회 시에만 리더 제외 JOINED 팀원이 verdictMembers로 포함되고, 비리더 조회 시에는 키가 없다', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      const member = (await resolvePersonaUser('gs_member', tx))!;
      const outsider = (await resolvePersonaUser('seoul_member', tx))!;
      const post = await createPost(input, leader.id, tx, new Date());
      await joinPost(post.id, member.id, tx, new Date());

      const asLeader = await getPostDetail(post.id, leader.id, tx);
      expect(asLeader.verdictMembers).toEqual([
        { userId: member.id, login: member.login, campus: member.campus },
      ]);
      // 일반 participants 배열은 여전히 userId 없이 PublicUser만 유지한다 (TC-IDENT-04).
      expect(asLeader.participants).toEqual([
        { login: leader.login, campus: leader.campus },
        { login: member.login, campus: member.campus },
      ]);

      const asMember = await getPostDetail(post.id, member.id, tx);
      expect('verdictMembers' in asMember).toBe(false);

      const asOutsider = await getPostDetail(post.id, outsider.id, tx);
      expect('verdictMembers' in asOutsider).toBe(false);
    });
  });

  it('FR-021 (007b): 상세 조회는 proofUrl과 postmortemText를 반환한다', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      const post = await createPost(input, leader.id, tx, new Date());
      const endDate = new Date('2026-10-31T23:59:59.999+09:00');
      await tx
        .update(posts)
        .set({ endDate, proofUrl: 'https://github.com/modoo42/proof' })
        .where(eq(posts.id, post.id));

      await postmortemPost(
        post.id,
        leader.id,
        '일정 조율 실패로 중단했습니다.',
        tx,
        new Date('2026-10-20T12:00:00+09:00'),
      );

      const detail = await getPostDetail(post.id, leader.id, tx);
      expect(detail.proofUrl).toBe('https://github.com/modoo42/proof');
      expect(detail.postmortemText).toBe('일정 조율 실패로 중단했습니다.');
    });
  });
});


describe('참여자 정렬 결정성 (FR-014)', () => {
  it('TC-DETAIL-01: 참여자 순서가 joined_at → login 오름차순으로 고정되고 리더가 첫 행이다', async () => {
    await withRollback(async (tx) => {
      const leader = (await resolvePersonaUser('gs_leader', tx))!;
      const post = await createPost(input, leader.id, tx, new Date());

      // joined_at이 같은 행 3개를 넣어 2차 키(login)를 강제로 검증한다.
      // 삽입 순서와 login 순서를 어긋나게 둬서 삽입 순서로 나오면 실패하도록 만든다.
      const tag = `ord_${Date.now()}`;
      const [leaderRow] = await tx
        .select({ joinedAt: participants.joinedAt })
        .from(participants)
        .where(eq(participants.postId, post.id));
      const sameTime = new Date(leaderRow.joinedAt.getTime() + 1_000);
      for (const name of ['zz', 'aa', 'mm']) {
        const [u] = await tx
          .insert(users)
          .values({ githubId: `gh_${name}_${tag}`, login: `${name}_${tag}` })
          .returning({ id: users.id });
        await tx
          .insert(participants)
          .values({ postId: post.id, userId: u.id, status: 'JOINED', joinedAt: sameTime });
      }

      const first = await getPostDetail(post.id, leader.id, tx);
      const second = await getPostDetail(post.id, leader.id, tx);
      const logins = first.participants.map((p) => p.login);

      expect(logins).toEqual(second.participants.map((p) => p.login));
      // 리더 행은 createPost가 가장 먼저 기록하므로 joined_at이 앞서 자연히 첫 행이다.
      expect(logins[0]).toBe(leader.login);
      const tail = logins.slice(1);
      expect(tail).toEqual([...tail].sort());
    });
  });
});
