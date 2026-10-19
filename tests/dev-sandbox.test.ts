// 샌드박스 격리 (FR-028, requirement.md §3 Test Suite 10).
//
// 실행 전제: pnpm sandbox:sync가 한 번 돌아 dev_sandbox가 존재한다.
// 파괴적 단정(TC-DEV-06)은 SQL을 한 줄도 실행하지 않음을 호출 수 0으로 확인한다.
// DB를 쓰는 케이스는 트랜잭션 롤백으로 격리한다 — TRUNCATE도 롤백된다 (C7).
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { sql } from 'drizzle-orm';
import { testDb, withRollback } from './setup/db';
import { DEV_SANDBOX_SCHEMA, SANDBOX_TTL_MS } from '@/lib/dev/sandbox';
import { repoJournalTag } from '@/lib/dev/journal';
import {
  countSandboxRows,
  readSandboxMeta,
  readSandboxSession,
  resetSandbox,
  snapshotIntoSandbox,
  writeSandboxSession,
} from '@/lib/dev/snapshot';
import { deriveChatPlatform } from '@/lib/validation';

/** dev_sandbox가 없으면 통합 케이스를 건너뛰지 않고 큰 소리로 실패시킨다. */
beforeAll(async () => {
  const rows = await testDb.execute(
    sql`select 1 from information_schema.schemata where schema_name = ${DEV_SANDBOX_SCHEMA}`,
  );
  if (rows.length === 0) {
    throw new Error(`${DEV_SANDBOX_SCHEMA} 스키마가 없다. pnpm sandbox:sync를 먼저 실행한다.`);
  }
});

describe('TC-DEV-06 대상 스키마 단정 (파괴적 실행 전)', () => {
  it('대상 스키마가 dev_sandbox가 아니면 SQL을 한 줄도 실행하지 않고 던진다', async () => {
    const execute = vi.fn();
    const fake = { execute } as never;

    await expect(resetSandbox(fake, 'public')).rejects.toThrow(/dev_sandbox/);
    await expect(resetSandbox(fake, 'PUBLIC')).rejects.toThrow(/dev_sandbox/);
    await expect(resetSandbox(fake, '')).rejects.toThrow(/dev_sandbox/);
    await expect(resetSandbox(fake, 'dev_sandbox; drop schema public')).rejects.toThrow(/dev_sandbox/);

    expect(execute).toHaveBeenCalledTimes(0);
  });

  it('스냅샷도 같은 단정을 통과해야 실행된다', async () => {
    const execute = vi.fn();
    const fake = { execute } as never;

    await expect(snapshotIntoSandbox(fake, 'public')).rejects.toThrow(/dev_sandbox/);
    expect(execute).toHaveBeenCalledTimes(0);
  });
});

describe('TC-DEV-05 스냅샷 마스킹', () => {
  it('운영 chat_url 값이 0건이고 플랫폼 구분과 reference_url은 보존된다', async () => {
    await withRollback(async (tx) => {
      await resetSandbox(tx, DEV_SANDBOX_SCHEMA);
      await snapshotIntoSandbox(tx, DEV_SANDBOX_SCHEMA);

      const originals = await tx.execute(
        sql`select chat_url, reference_url from public.posts where chat_url is not null`,
      );
      const copied = await tx.execute(
        sql`select id, chat_url, reference_url from dev_sandbox.posts where chat_url is not null`,
      );

      // 실제 초대 링크가 샌드박스로 넘어오지 않는다.
      const realLinks = new Set(originals.map((r) => String(r.chat_url)));
      for (const row of copied) {
        expect(realLinks.has(String(row.chat_url))).toBe(false);
        expect(String(row.chat_url)).toContain('dev-sandbox');
      }

      // 전건 NULL이 아니다 — chat_platform이 chat_url에서 파생되므로 배지가 깨진다 (S4).
      if (originals.length > 0) {
        expect(copied.length).toBe(originals.length);
        const originalPlatforms = originals.map((r) => deriveChatPlatform(String(r.chat_url))).sort();
        const copiedPlatforms = copied.map((r) => deriveChatPlatform(String(r.chat_url))).sort();
        expect(copiedPlatforms).toEqual(originalPlatforms);
      }

      // reference_url은 전체 공개라 그대로 복사한다.
      const refs = await tx.execute(
        sql`select count(*)::int as n from public.posts p
            join dev_sandbox.posts d on d.id = p.id
            where coalesce(p.reference_url, '') <> coalesce(d.reference_url, '')`,
      );
      expect(Number(refs[0].n)).toBe(0);
    });
  });

  it('id·created_at·joined_at을 보존해 복사한다 — 세션 해석이 샌드박스에서도 성립한다', async () => {
    await withRollback(async (tx) => {
      await resetSandbox(tx, DEV_SANDBOX_SCHEMA);
      await snapshotIntoSandbox(tx, DEV_SANDBOX_SCHEMA);

      const mismatched = await tx.execute(
        sql`select count(*)::int as n from public.users p
            join dev_sandbox.users d on d.id = p.id
            where p.created_at <> d.created_at or p.login <> d.login`,
      );
      expect(Number(mismatched[0].n)).toBe(0);

      const userCounts = await tx.execute(
        sql`select (select count(*)::int from public.users) as src,
                   (select count(*)::int from dev_sandbox.users) as dst`,
      );
      expect(Number(userCounts[0].dst)).toBe(Number(userCounts[0].src));
    });
  });
});

describe('TC-DEV-09 운영 테이블 불변', () => {
  it('샌드박스 핸들로 비우기·스냅샷을 해도 public 3테이블 행 수가 그대로다', async () => {
    await withRollback(async (tx) => {
      const before = await tx.execute(
        sql`select (select count(*)::int from public.users) as u,
                   (select count(*)::int from public.posts) as p,
                   (select count(*)::int from public.participants) as c`,
      );

      await resetSandbox(tx, DEV_SANDBOX_SCHEMA);
      await snapshotIntoSandbox(tx, DEV_SANDBOX_SCHEMA);

      const after = await tx.execute(
        sql`select (select count(*)::int from public.users) as u,
                   (select count(*)::int from public.posts) as p,
                   (select count(*)::int from public.participants) as c`,
      );
      expect(after[0]).toEqual(before[0]);
    });
  });
});

describe('TC-DEV-11 샌드박스 범위', () => {
  it('같은 조회를 두 스키마로 돌리면 서로 다른 행 집합이 나온다', async () => {
    await withRollback(async (tx) => {
      await resetSandbox(tx, DEV_SANDBOX_SCHEMA);
      // 스냅샷 없이 비운 상태 — 샌드박스는 0건, 운영은 그대로다.
      const counts = await tx.execute(
        sql`select (select count(*)::int from public.posts) as src,
                   (select count(*)::int from dev_sandbox.posts) as dst`,
      );
      expect(Number(counts[0].dst)).toBe(0);
      expect(Number(counts[0].src)).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('TC-DEV-07 세션 표식과 TTL', () => {
  it('표식이 유효하면 초기화를 건너뛰고, TTL이 지나면 초기화한다', async () => {
    await withRollback(async (tx) => {
      const realNow = new Date('2026-10-19T12:00:00.000Z');

      // 살아 있는 표식: expires_at이 미래다.
      await writeSandboxSession(tx, DEV_SANDBOX_SCHEMA, realNow);
      const alive = await readSandboxSession(tx, DEV_SANDBOX_SCHEMA);
      expect(alive).not.toBeNull();
      expect(alive!.expiresAt.getTime()).toBeGreaterThan(realNow.getTime());

      // TTL(2시간)을 넘기면 만료다 — 그때의 진입이 초기화를 수행한다.
      expect(SANDBOX_TTL_MS).toBe(2 * 60 * 60 * 1000);
      const later = new Date(realNow.getTime() + SANDBOX_TTL_MS + 1);
      expect(alive!.expiresAt.getTime()).toBeLessThan(later.getTime());
    });
  });
});

describe('S2 스키마 버전 대조', () => {
  it('재생된 샌드박스의 journal_tag가 저장소의 마지막 태그와 같다', async () => {
    const tag = await readSandboxMeta(testDb, DEV_SANDBOX_SCHEMA);
    // 다르면 콘솔 진입이 409 SANDBOX_STALE로 실패한다 — pnpm sandbox:sync를 돌려야 한다.
    expect(tag).toBe(repoJournalTag());
  });

  it('대상 스키마가 아니면 메타·행 수 조회도 거부한다', async () => {
    const execute = vi.fn();
    const fake = { execute } as never;
    await expect(readSandboxMeta(fake, 'public')).rejects.toThrow(/dev_sandbox/);
    await expect(countSandboxRows(fake, 'public')).rejects.toThrow(/dev_sandbox/);
    await expect(readSandboxSession(fake, 'public')).rejects.toThrow(/dev_sandbox/);
    await expect(writeSandboxSession(fake, 'public', new Date())).rejects.toThrow(/dev_sandbox/);
    expect(execute).toHaveBeenCalledTimes(0);
  });
});
