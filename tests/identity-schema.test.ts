// 유저 식별 스키마 전환 (FR-016). Test Suite 5.
// 스키마 제약 자체를 검증하므로 information_schema를 직접 읽는다.
import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { createPost, joinPost } from '@/lib/posts';
import { users } from '@/db/schema';

type ColumnMeta = { column_name: string; is_nullable: 'YES' | 'NO' };

describe('유저 식별 스키마 (Test Suite 5)', () => {
  it('TC-IDENT-01: github_id·login은 NOT NULL, 42 컬럼 3개는 nullable', async () => {
    await withRollback(async (tx) => {
      const rows = (await tx.execute(sql`
        select column_name, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'users'
      `)) as unknown as ColumnMeta[];
      const nullable = new Map(rows.map((r) => [r.column_name, r.is_nullable]));

      expect(nullable.get('github_id')).toBe('NO');
      expect(nullable.get('login')).toBe('NO');
      expect(nullable.get('intra_id')).toBe('YES');
      expect(nullable.get('campus')).toBe('YES');
      expect(nullable.get('intra_verified_at')).toBe('YES');
    });
  });

  it('TC-IDENT-01: location_type 열거형에 OFFLINE_ETC가 있다', async () => {
    await withRollback(async (tx) => {
      const rows = (await tx.execute(sql`
        select enumlabel from pg_enum e
        join pg_type t on t.oid = e.enumtypid
        where t.typname = 'location_type'
      `)) as unknown as { enumlabel: string }[];

      expect(rows.map((r) => r.enumlabel)).toContain('OFFLINE_ETC');
    });
  });

  it('TC-IDENT-03: github_id·login에 null 행이 없고 리더 연결이 끊긴 글이 없다', async () => {
    await withRollback(async (tx) => {
      const [counts] = (await tx.execute(sql`
        select
          (select count(*) from users where github_id is null)::int as null_github,
          (select count(*) from users where login is null)::int as null_login,
          (select count(*) from posts p
             left join users u on u.id = p.leader_id
           where u.id is null)::int as orphan_posts
      `)) as unknown as { null_github: number; null_login: number; orphan_posts: number }[];

      expect(counts.null_github).toBe(0);
      expect(counts.null_login).toBe(0);
      expect(counts.orphan_posts).toBe(0);
    });
  });

  it('TC-IDENT-03: 백필된 기존 행은 github_id = mock:<intra_id>, login = intra_id', async () => {
    await withRollback(async (tx) => {
      const rows = (await tx.execute(sql`
        select intra_id, github_id, login from users where intra_id is not null
      `)) as unknown as { intra_id: string; github_id: string; login: string }[];

      // 전환 전 유저는 Mock 페르소나 3종뿐이다 (005-baseline.txt: users 3).
      expect(rows.length).toBeGreaterThanOrEqual(3);
      for (const r of rows) {
        expect(r.github_id).toBe(`mock:${r.intra_id}`);
        expect(r.login).toBe(r.intra_id);
      }
    });
  });

  it('TC-IDENT-01: 42 컬럼 3개가 모두 null인 유저를 만들 수 있다', async () => {
    await withRollback(async (tx) => {
      const tag = `ident_${Date.now()}`;
      const [row] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}`, login: tag })
        .returning();

      expect(row.intraId).toBeNull();
      expect(row.campus).toBeNull();
      expect(row.intraVerifiedAt).toBeNull();
    });
  });

  it('TC-IDENT-01: 같은 github_id로 두 번째 유저를 만들 수 없다', async () => {
    await withRollback(async (tx) => {
      const tag = `dupgh_${Date.now()}`;
      await tx.insert(users).values({ githubId: `gh_${tag}`, login: `${tag}_a` });

      // Drizzle이 PostgresError를 DrizzleQueryError로 감싸므로 cause를 본다.
      await expect(
        tx.insert(users).values({ githubId: `gh_${tag}`, login: `${tag}_b` }),
      ).rejects.toMatchObject({ cause: { code: '23505', constraint_name: 'users_github_id_unique' } });
    });
  });

  it('TC-IDENT-01: 같은 login으로 두 번째 유저를 만들 수 없다', async () => {
    await withRollback(async (tx) => {
      const tag = `duplogin_${Date.now()}`;
      await tx.insert(users).values({ githubId: `gh_${tag}_a`, login: tag });

      await expect(
        tx.insert(users).values({ githubId: `gh_${tag}_b`, login: tag }),
      ).rejects.toMatchObject({ cause: { code: '23505', constraint_name: 'users_login_unique' } });
    });
  });

  it('TC-IDENT-01: 42 정보가 없는 유저도 글 작성·참여가 된다', async () => {
    await withRollback(async (tx) => {
      const tag = `noc_${Date.now()}`;
      const [leader] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}_leader`, login: `${tag}_leader` })
        .returning({ id: users.id });
      const [member] = await tx
        .insert(users)
        .values({ githubId: `gh_${tag}_member`, login: `${tag}_member` })
        .returning({ id: users.id });

      const post = await createPost(
        {
          type: 'STUDY',
          title: '캠퍼스 없는 리더의 스터디',
          tags: ['모각코'],
          locationType: 'ONLINE',
          maxMembers: 4,
          chatUrl: 'https://open.kakao.com/o/join',
        },
        leader.id,
        tx,
      );
      expect(post.status).toBe('RECRUITING');

      const joined = await joinPost(post.id, member.id, tx);
      expect(joined.chatUrl).toBe('https://open.kakao.com/o/join');
    });
  });
});
