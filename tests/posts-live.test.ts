import { describe, it, expect } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { withRollback, createRacePool } from './setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import {
  createPost,
  createLivePing,
  completeLivePing,
  listForCli,
  listPosts,
  joinPost,
  updatePost,
  cancelPost,
  toggleStatus,
} from '@/lib/posts';
import { AppError } from '@/lib/errors';
import { posts, users } from '@/db/schema';

// now는 공용 DB의 오늘 데이터와 겹치지 않게 먼 미래로 둔다 (tasks.md 공통 규칙).
const MIN = 60_000;
const ping = (over: Partial<{ text: string; place: string; durationMinutes: 30 | 60 | 120 | 180 }> = {}) => ({
  text: 'philosopher 데드락 30분 헬프 구합니다',
  place: '클러스터 2층',
  durationMinutes: 60 as 30 | 60 | 120 | 180,
  ...over,
});

const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id as string);

describe('LIVE 핑 생성 (Test Suite 4)', () => {
  it('TC-LIVE-01: 정규 필드 매핑 — expires_at, max_members·chat_url null, 참여자 레코드 없음', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-03-05T03:00:00.000Z');

      const created = await createLivePing(ping(), leader!.id, tx, now);
      expect(created.status).toBe('RECRUITING');
      expect(created.expiresAt).toEqual(new Date(now.getTime() + 60 * MIN));

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.type).toBe('LIVE');
      expect(row.status).toBe('RECRUITING');
      expect(row.title).toBe('philosopher 데드락 30분 헬프 구합니다');
      expect(row.place).toBe('클러스터 2층');
      expect(row.expiresAt).toEqual(new Date(now.getTime() + 60 * MIN));
      expect(row.createdAt).toEqual(now);
      expect(row.maxMembers).toBeNull();
      expect(row.chatUrl).toBeNull();
      expect(row.referenceUrl).toBeNull();
      expect(row.description).toBeNull();
      expect(row.templateId).toBeNull();
      expect(row.endDate).toBeNull();
      expect(row.tags).toEqual([]);

      // LIVE에는 참여 개념이 없다 (research R5).
      const parts = await tx.query.participants.findMany({ where: (p, { eq: e }) => e(p.postId, created.id) });
      expect(parts).toHaveLength(0);

      expect(ids(await listPosts({ type: 'LIVE' }, tx, now))).toContain(created.id);
    });
  });

  it('TC-LIVE-01: location_type은 작성자 캠퍼스로 자동 설정된다 (research R4)', async () => {
    await withRollback(async (tx) => {
      const gs = await resolvePersonaUser('gs_leader', tx);
      const seoul = await resolvePersonaUser('seoul_member', tx);
      const now = new Date('2030-03-06T03:00:00.000Z');

      const a = await createLivePing(ping(), gs!.id, tx, now);
      const b = await createLivePing(ping(), seoul!.id, tx, now);

      const [rowA] = await tx.select().from(posts).where(eq(posts.id, a.id));
      const [rowB] = await tx.select().from(posts).where(eq(posts.id, b.id));
      expect(rowA.locationType).toBe('OFFLINE_GS');
      expect(rowB.locationType).toBe('OFFLINE_SEOUL');
    });
  });

  it('TC-IDENT-02: 캠퍼스 미인증(null) 작성자의 핑은 차단 없이 OFFLINE_ETC로 기록된다', async () => {
    await withRollback(async (tx) => {
      const tag = `etc_${Date.now()}`;
      const [nocampus] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag })
        .returning();
      expect(nocampus.campus).toBeNull();
      const now = new Date('2030-03-07T03:00:00.000Z');

      const created = await createLivePing(ping(), nocampus.id, tx, now);

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.locationType).toBe('OFFLINE_ETC');
      expect(row.status).toBe('RECRUITING');
    });
  });

  it.each([
    [30, '2030-04-01T03:00:00.000Z'],
    [60, '2030-04-02T03:00:00.000Z'],
    [120, '2030-04-03T03:00:00.000Z'],
    [180, '2030-04-04T03:00:00.000Z'],
  ] as const)('TC-LIVE-01: 유효시간 %i분 → expires_at = now + %i분', async (durationMinutes, iso) => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date(iso);
      const created = await createLivePing(ping({ durationMinutes }), leader!.id, tx, now);
      expect(created.expiresAt).toEqual(new Date(now.getTime() + durationMinutes * MIN));
    });
  });
});

describe('LIVE 핑 1일 1회 제한 (Test Suite 4)', () => {
  it('TC-LIVE-02: 같은 KST 날짜 두 번째 생성 → BAD_REQUEST', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-05-10T03:00:00.000Z');

      await createLivePing(ping(), leader!.id, tx, now);
      await expect(
        createLivePing(ping(), leader!.id, tx, new Date(now.getTime() + 60 * MIN)),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      const rows = await tx
        .select()
        .from(posts)
        .where(and(eq(posts.leaderId, leader!.id), eq(posts.type, 'LIVE')));
      expect(rows).toHaveLength(1);
    });
  });

  it('TC-LIVE-02: 조기 완료·만료된 핑도 당일 1회로 센다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-05-11T03:00:00.000Z');

      const first = await createLivePing(ping(), leader!.id, tx, now);
      // 조기 완료 처리하고 만료 시각도 과거로 돌린다.
      await tx
        .update(posts)
        .set({ status: 'CLOSED', expiresAt: new Date(now.getTime() - MIN) })
        .where(eq(posts.id, first.id));

      await expect(
        createLivePing(ping(), leader!.id, tx, new Date(now.getTime() + 120 * MIN)),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });
  });

  it('TC-LIVE-02: KST 자정을 넘기면 새로 생성할 수 있다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const lateNight = new Date('2030-05-12T14:59:00.000Z'); // KST 23:59
      const afterMidnight = new Date('2030-05-12T15:00:00.000Z'); // KST 다음날 00:00

      await createLivePing(ping(), leader!.id, tx, lateNight);
      const second = await createLivePing(ping(), leader!.id, tx, afterMidnight);
      expect(second.status).toBe('RECRUITING');
    });
  });

  it('TC-LIVE-02: 같은 날 스터디를 개설한 유저도 LIVE 핑 1건은 올릴 수 있다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-05-13T03:00:00.000Z');

      await createPost(
        {
          type: 'STUDY',
          title: '스터디 먼저',
          tags: ['모각코'],
          locationType: 'ONLINE',
          maxMembers: 6,
          chatUrl: 'https://open.kakao.com/o/x',
        },
        leader!.id,
        tx,
        now,
      );

      const created = await createLivePing(ping(), leader!.id, tx, now);
      expect(created.status).toBe('RECRUITING');
    });
  });

  it('TC-LIVE-02: 다른 유저의 당일 핑은 제한에 영향을 주지 않는다', async () => {
    await withRollback(async (tx) => {
      const gs = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const now = new Date('2030-05-14T03:00:00.000Z');

      await createLivePing(ping(), gs!.id, tx, now);
      const created = await createLivePing(ping(), other!.id, tx, now);
      expect(created.status).toBe('RECRUITING');
    });
  });

});

describe('LIVE 핑 조기 완료 (Test Suite 4)', () => {
  const setup = async (
    tx: Parameters<Parameters<typeof withRollback>[0]>[0],
    now: Date,
  ) => {
    const leader = await resolvePersonaUser('gs_leader', tx);
    const other = await resolvePersonaUser('gs_member', tx);
    const created = await createLivePing(ping(), leader!.id, tx, now);
    return { leader: leader!, other: other!, created };
  };

  it('TC-LIVE-03: 작성자 완료 → CLOSED 전이 및 활성 목록 즉시 제외', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-07-01T03:00:00.000Z');
      const { leader, created } = await setup(tx, now);
      expect(ids(await listPosts({ type: 'LIVE' }, tx, now))).toContain(created.id);

      const result = await completeLivePing(created.id, leader.id, tx, new Date());
      expect(result).toMatchObject({ id: created.id, status: 'CLOSED' });

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.status).toBe('CLOSED');
      expect(ids(await listPosts({ type: 'LIVE' }, tx, now))).not.toContain(created.id);
    });
  });

  it('TC-LIVE-03: 작성자가 아니면 403 FORBIDDEN, 상태 불변', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-07-02T03:00:00.000Z');
      const { other, created } = await setup(tx, now);

      await expect(completeLivePing(created.id, other.id, tx, new Date())).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.status).toBe('RECRUITING');
    });
  });

  it('TC-LIVE-03: 이미 CLOSED인 핑 재호출은 멱등 성공', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-07-03T03:00:00.000Z');
      const { leader, created } = await setup(tx, now);

      await completeLivePing(created.id, leader.id, tx, new Date());
      const again = await completeLivePing(created.id, leader.id, tx, new Date());
      expect(again).toMatchObject({ id: created.id, status: 'CLOSED' });
    });
  });

  it('TC-LIVE-03: 만료 시각이 지난 RECRUITING 핑도 CLOSED로 전이된다', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-07-04T03:00:00.000Z');
      const { leader, created } = await setup(tx, now);
      await tx
        .update(posts)
        .set({ expiresAt: new Date(now.getTime() - MIN) })
        .where(eq(posts.id, created.id));

      const result = await completeLivePing(created.id, leader.id, tx, new Date());
      expect(result.status).toBe('CLOSED');
    });
  });

  it('TC-LIVE-03: LIVE가 아닌 글은 400 BAD_REQUEST (리더 본인이어도)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const study = await createPost(
        {
          type: 'STUDY',
          title: '핑 아님',
          tags: ['모각코'],
          locationType: 'ONLINE',
          maxMembers: 6,
          chatUrl: 'https://open.kakao.com/o/x',
        },
        leader!.id,
        tx,
        new Date(),
      );

      await expect(completeLivePing(study.id, leader!.id, tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('TC-LIVE-03: 없는 글은 404 NOT_FOUND', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      await expect(
        completeLivePing('3f6c1a52-8d4e-4b7a-9c21-5e0f7a8b9c10', leader!.id, tx, new Date()),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});

describe('LIVE 핑 쓰기 동작 차단 (research R6)', () => {
  it('참여·수정·취소·토글 모두 400 BAD_REQUEST, 행은 불변', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-08-01T03:00:00.000Z');
      const leader = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const created = await createLivePing(ping(), leader!.id, tx, now);

      await expect(joinPost(created.id, other!.id, tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(updatePost(created.id, leader!.id, { title: 'x' }, tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(cancelPost(created.id, leader!.id, '사유', tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
      await expect(toggleStatus(created.id, leader!.id, 'CLOSED', tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.status).toBe('RECRUITING');
      expect(row.currentMembers).toBe(1);
      expect(row.title).toBe('philosopher 데드락 30분 헬프 구합니다');
    });
  });

  it('유형 검사가 권한 검사보다 먼저다 — 비작성자 수정도 400', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-08-02T03:00:00.000Z');
      const leader = await resolvePersonaUser('gs_leader', tx);
      const other = await resolvePersonaUser('gs_member', tx);
      const created = await createLivePing(ping(), leader!.id, tx, now);

      await expect(updatePost(created.id, other!.id, { title: 'x' }, tx, new Date())).rejects.toMatchObject({
        code: 'BAD_REQUEST',
      });
    });
  });

  it('CLOSED 핑은 재모집으로 되돌릴 수 없다', async () => {
    await withRollback(async (tx) => {
      const now = new Date('2030-08-03T03:00:00.000Z');
      const leader = await resolvePersonaUser('gs_leader', tx);
      const created = await createLivePing(ping(), leader!.id, tx, now);
      await completeLivePing(created.id, leader!.id, tx, new Date());

      await expect(
        toggleStatus(created.id, leader!.id, 'RECRUITING', tx, new Date()),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      const [row] = await tx.select().from(posts).where(eq(posts.id, created.id));
      expect(row.status).toBe('CLOSED');
    });
  });
});

describe('CLI 조회 데이터 (Test Suite 4)', () => {
  it('TC-CLI-01: 모집 중 글·활성 핑만 묶이고 chat_url 계열 필드가 없다', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const now = new Date('2030-09-01T03:00:00.000Z');

      const insertPing = async (status: 'RECRUITING' | 'CLOSED', offsetMin: number) => {
        const [row] = await tx
          .insert(posts)
          .values({
            leaderId: leader!.id,
            type: 'LIVE',
            title: `핑 ${offsetMin}`,
            tags: [],
            locationType: 'OFFLINE_GS',
            place: '클러스터 2층',
            maxMembers: null,
            chatUrl: null,
            expiresAt: new Date(now.getTime() + offsetMin * MIN),
            status,
          })
          .returning({ id: posts.id });
        return row.id;
      };

      const insertPost = async (
        type: 'STUDY' | 'PARTY',
        status: 'RECRUITING' | 'CLOSED' | 'CANCELLED',
        endOffsetDays: number,
      ) => {
        const [row] = await tx
          .insert(posts)
          .values({
            leaderId: leader!.id,
            type,
            title: `${type} ${status} ${endOffsetDays}`,
            tags: ['모각코'],
            locationType: 'ONLINE',
            maxMembers: 6,
            chatUrl: 'https://open.kakao.com/o/secret',
            description: '노출되면 안 되는 설명',
            referenceUrl: 'https://github.com/x/y',
            endDate: new Date(now.getTime() + endOffsetDays * 24 * 60 * MIN),
            status,
          })
          .returning({ id: posts.id });
        return row.id;
      };

      const pingSoon = await insertPing('RECRUITING', 10);
      const pingLater = await insertPing('RECRUITING', 90);
      const pingExpired = await insertPing('RECRUITING', -5);
      const pingClosed = await insertPing('CLOSED', 30);
      const partyNear = await insertPost('PARTY', 'RECRUITING', 2);
      const partyFar = await insertPost('PARTY', 'RECRUITING', 9);
      const partyClosed = await insertPost('PARTY', 'CLOSED', 3);
      const study = await insertPost('STUDY', 'RECRUITING', 20);
      const studyCancelled = await insertPost('STUDY', 'CANCELLED', 20);

      const data = await listForCli(tx, now);
      const pingIds = data.pings.map((p) => p.id);
      const partyIds = data.parties.map((p) => p.id);
      const studyIds = data.studies.map((s) => s.id);

      // 활성 핑만, 만료 임박순.
      expect(pingIds).toContain(pingSoon);
      expect(pingIds).toContain(pingLater);
      expect(pingIds).not.toContain(pingExpired);
      expect(pingIds).not.toContain(pingClosed);
      expect(pingIds.indexOf(pingSoon)).toBeLessThan(pingIds.indexOf(pingLater));

      // 모집 중 파티만, 마감 임박순.
      expect(partyIds).toContain(partyNear);
      expect(partyIds).toContain(partyFar);
      expect(partyIds).not.toContain(partyClosed);
      expect(partyIds.indexOf(partyNear)).toBeLessThan(partyIds.indexOf(partyFar));

      // 모집 중 스터디만.
      expect(studyIds).toContain(study);
      expect(studyIds).not.toContain(studyCancelled);

      // 헌법 V: 공개 응답에 링크·설명을 싣지 않는다.
      for (const row of [...data.pings, ...data.parties, ...data.studies]) {
        expect(Object.keys(row).sort()).toEqual(
          [
            'currentMembers',
            'endDate',
            'expiresAt',
            'id',
            'leader',
            'maxMembers',
            'place',
            'tags',
            'title',
          ].sort(),
        );
        expect(row.leader.login).toBeTruthy();
      }

      const soon = data.pings.find((p) => p.id === pingSoon)!;
      expect(soon.place).toBe('클러스터 2층');
      expect(soon.expiresAt).toEqual(new Date(now.getTime() + 10 * MIN));
    });
  });
});
// 동시성 테스트는 파일 맨 끝에 둔다. DATABASE_URL이 Supabase 트랜잭션 풀러(6543)라
// 별도 풀을 열면 공유 testClient의 prepared statement가 무효화되어 이후 테스트가
// "prepared statement does not exist"로 깨진다 (posts-join.test.ts TC-RACE-01과 같은 배치).
describe('LIVE 핑 동시 생성 (Test Suite 4)', () => {
  it('TC-LIVE-02: 동시 생성 10건 중 정확히 1건만 성공한다', async () => {
    const pool = createRacePool(10);
    let userId = '';
    const now = new Date('2030-06-01T03:00:00.000Z');
    try {
      const raceTag = `race_live_${Date.now()}`;
      const [u] = await pool.db
        .insert(users)
        .values({ githubId: `gh_${raceTag}`, login: raceTag, campus: 'GS' })
        .returning({ id: users.id });
      userId = u.id;

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => createLivePing(ping(), userId, pool.db, now)),
      );
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(ok).toHaveLength(1);
      expect(failed).toHaveLength(9);
      for (const f of failed) {
        expect((f as PromiseRejectedResult).reason).toBeInstanceOf(AppError);
        expect((f as PromiseRejectedResult).reason.code).toBe('BAD_REQUEST');
      }

      const rows = await pool.db
        .select()
        .from(posts)
        .where(and(eq(posts.leaderId, userId), eq(posts.type, 'LIVE')));
      expect(rows).toHaveLength(1);
    } finally {
      // leader_id는 onDelete: restrict이므로 글을 먼저 지운다.
      if (userId) {
        await pool.db.delete(posts).where(eq(posts.leaderId, userId));
        await pool.db.delete(users).where(eq(users.id, userId));
      }
      await pool.client.end({ timeout: 5 });
    }
  });
});
