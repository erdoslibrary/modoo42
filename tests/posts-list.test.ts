import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { createPost, listPosts } from '@/lib/posts';
import { posts, users } from '@/db/schema';

// 공용 Supabase에 다른 글이 섞여 있다. 개수가 아니라 테스트가 만든 id의 포함/불포함으로 단언한다.
const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id as string);

const studyInput = {
  type: 'STUDY' as const,
  title: '목록 필터 테스트',
  tags: ['모각코'],
  locationType: 'ONLINE' as const,
  maxMembers: 6,
  chatUrl: 'https://open.kakao.com/o/list',
};

describe('목록 조회 Lazy Filter (Test Suite 4)', () => {
  it('TC-LIVE-04: 만료·CLOSED LIVE 핑은 목록에서 제외되고 상태는 전이되지 않는다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-01-15T03:00:00.000Z');
      const min = 60_000;

      const livePing = async (status: 'RECRUITING' | 'CLOSED', expiresAt: Date) => {
        const [row] = await tx
          .insert(posts)
          .values({
            leaderId: leader!.id,
            type: 'LIVE',
            title: `핑 ${status} ${expiresAt.toISOString()}`,
            tags: [],
            locationType: 'OFFLINE_GS',
            maxMembers: null,
            chatUrl: null,
            expiresAt,
            status,
          })
          .returning({ id: posts.id });
        return row.id;
      };

      const active = await livePing('RECRUITING', new Date(now.getTime() + 10 * min));
      const expired = await livePing('RECRUITING', new Date(now.getTime() - 1 * min));
      const closed = await livePing('CLOSED', new Date(now.getTime() + 10 * min));
      const study = await createPost(studyInput, leader!.id, tx, new Date());

      // (a) 활성 핑만 노출. type 필터 유무와 무관.
      const all = await listPosts({}, tx, now);
      expect(ids(all)).toContain(active);
      expect(ids(all)).not.toContain(expired);
      expect(ids(all)).not.toContain(closed);

      const liveOnly = await listPosts({ type: 'LIVE' }, tx, now);
      expect(ids(liveOnly)).toContain(active);
      expect(ids(liveOnly)).not.toContain(expired);
      expect(ids(liveOnly)).not.toContain(closed);

      const activeItem = all.find((r) => r.id === active)!;
      expect(activeItem.expiresAt).toEqual(new Date(now.getTime() + 10 * min));

      // (b) 만료는 상태 전이가 아니다 (Lazy Filter).
      const [expiredRow] = await tx.select().from(posts).where(eq(posts.id, expired));
      expect(expiredRow.status).toBe('RECRUITING');

      // (c) status=CLOSED 조회에서도 LIVE는 제외된다.
      const closedList = await listPosts({ status: 'CLOSED' }, tx, now);
      expect(ids(closedList)).not.toContain(closed);

      // 회귀: STUDY 글은 영향받지 않고 expiresAt은 null이다.
      const studyItem = all.find((r) => r.id === study.id);
      expect(studyItem).toBeDefined();
      expect(studyItem!.expiresAt).toBeNull();
    });
  });

  it('TC-LIVE-04: 만료 시각이 now를 지나면 같은 핑이 목록에서 사라진다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-02-20T03:00:00.000Z');
      const expiresAt = new Date(now.getTime() + 30 * 60_000);

      const [row] = await tx
        .insert(posts)
        .values({
          leaderId: leader!.id,
          type: 'LIVE',
          title: '30분 핑',
          tags: [],
          locationType: 'OFFLINE_GS',
          maxMembers: null,
          chatUrl: null,
          expiresAt,
          status: 'RECRUITING',
        })
        .returning({ id: posts.id });

      expect(ids(await listPosts({ type: 'LIVE' }, tx, now))).toContain(row.id);

      const later = new Date(expiresAt.getTime() + 1);
      expect(ids(await listPosts({ type: 'LIVE' }, tx, later))).not.toContain(row.id);
    });
  });

  it('TC-IDENT-04: 목록의 leader는 login·campus이며 캠퍼스 없는 작성자도 노출된다', async () => {
    await withRollback(async (tx) => {
      const tag = `lst_${Date.now()}`;
      const [leader] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag })
        .returning({ id: users.id });
      const study = await createPost(studyInput, leader.id, tx, new Date());

      const rows = await listPosts({ type: 'STUDY' }, tx, new Date());
      const item = rows.find((r) => r.id === study.id)!;
      expect(item.leader).toEqual({ login: tag, campus: null });
    });
  });
});
