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
      expect(user!.login).toBe('gs_leader');
      expect(user!.githubId).toBe('mock:gs_leader');
      expect(user!.campus).toBe('GS');
      // 42 추가 인증은 §1.3 보류다. intra_id는 전환 전 행에 백필로 남아 있을 수 있지만(research R4)
      // 인증 시각은 어느 경로에서도 채우지 않는다.
      expect(user!.intraVerifiedAt).toBeNull();
    });
  });

  it('seoul_member → SEOUL 캠퍼스', async () => {
    await withRollback(async (tx) => {
      const user = await resolvePersonaUser('seoul_member', tx);
      expect(user!.campus).toBe('SEOUL');
    });
  });

  it('TC-IDENT-05: 페르소나 4종 캠퍼스가 GS / GS / SEOUL / null (data-model.md §6)', async () => {
    await withRollback(async (tx) => {
      const leader = await resolvePersonaUser('gs_leader', tx);
      const member = await resolvePersonaUser('gs_member', tx);
      const cadet = await resolvePersonaUser('seoul_member', tx);
      const githubOnly = await resolvePersonaUser('github_only', tx);
      expect([leader!.campus, member!.campus, cadet!.campus, githubOnly!.campus]).toEqual([
        'GS',
        'GS',
        'SEOUL',
        null,
      ]);
      expect(githubOnly!.login).toBe('github_only');
      // 새로 만들어지는 페르소나 행은 42 식별자를 채우지 않는다 (FR-012a).
      expect(githubOnly!.intraId).toBeNull();
      expect(githubOnly!.intraVerifiedAt).toBeNull();
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
      const rows = await tx.select().from(users).where(eq(users.githubId, 'mock:gs_member'));
      expect(rows).toHaveLength(1);
    });
  });
});
