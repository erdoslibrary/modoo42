import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from '../setup/db';
import { resolvePersonaUser } from '@/lib/auth';
import { users } from '@/db/schema';

describe('resolvePersonaUser (FR-003, FR-007)', () => {
  it('유효 페르소나 gs_leader → GS 캠퍼스 유저를 Upsert 후 반환', async () => {
    await withRollback(async (tx) => {
      const user = await resolvePersonaUser('gs_leader', tx);
      expect(user).not.toBeNull();
      expect(user!.intraId).toBe('gs_leader');
      expect(user!.campus).toBe('GS');
    });
  });

  it('seoul_member → SEOUL 캠퍼스', async () => {
    await withRollback(async (tx) => {
      const user = await resolvePersonaUser('seoul_member', tx);
      expect(user!.campus).toBe('SEOUL');
    });
  });

  it('세 페르소나 캠퍼스가 각각 GS / GS / SEOUL (data-model seed)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const cadet = await resolvePersonaUser('seoul_member', tx);
      expect([leader!.campus, member!.campus, cadet!.campus]).toEqual(['GS', 'GS', 'SEOUL']);
    });
  });

  it('guest → null (비로그인)', async () => {
    await withRollback(async (tx) => {
      expect(await resolvePersonaUser('guest', tx)).toBeNull();
    });
  });

  it('쿠키 없음(null/undefined) → null, 예외 없음', async () => {
    await withRollback(async (tx) => {
      expect(await resolvePersonaUser(null, tx)).toBeNull();
      expect(await resolvePersonaUser(undefined, tx)).toBeNull();
    });
  });

  it('알 수 없는 페르소나 값 → null', async () => {
    await withRollback(async (tx) => {
      expect(await resolvePersonaUser('bogus_value', tx)).toBeNull();
    });
  });

  it('멱등: 같은 페르소나 두 번 호출해도 유저가 중복 생성되지 않는다', async () => {
    await withRollback(async (tx) => {
      const first = await resolvePersonaUser('gs_member', tx);
      const second = await resolvePersonaUser('gs_member', tx);
      expect(second!.id).toBe(first!.id);
      const rows = await tx.select().from(users).where(eq(users.intraId, 'gs_member'));
      expect(rows).toHaveLength(1);
    });
  });
});
