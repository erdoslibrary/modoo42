import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { withRollback } from './setup/db';
import { getLeaderboard } from '@/lib/posts';
import { users } from '@/db/schema';

// 공용 Supabase라 다른 유저가 섞여 있다. 테스트 유저 카운트를 매우 크게 넣어 상위 5명을 확정적으로 점유한다.
const BIG = 1_000_000;

describe('성실 멤버 랭킹 TOP 5 (FR-010, research R8)', () => {
  it('완주 횟수 DESC → 리더 횟수 DESC → intra_id ASC, 정확히 5명, rank 1~5', async () => {
    await withRollback(async (tx) => {
      const tag = `lb${Date.now()}`;
      const rows = [
        { intraId: `${tag}_e`, completedCount: BIG + 3, leaderCount: 0 }, // 1위: 완주 최다
        { intraId: `${tag}_b`, completedCount: BIG + 2, leaderCount: 5 }, // 2위: 완주 동률 중 리더 많음
        { intraId: `${tag}_a`, completedCount: BIG + 2, leaderCount: 1 }, // 3위: 완주·리더 동률 → intra_id 순
        { intraId: `${tag}_c`, completedCount: BIG + 2, leaderCount: 1 }, // 4위
        { intraId: `${tag}_d`, completedCount: BIG + 1, leaderCount: 9 }, // 5위
        { intraId: `${tag}_f`, completedCount: BIG, leaderCount: 0 }, // 6위: 컷
      ];
      await tx.insert(users).values(rows.map((r) => ({ ...r, campus: 'GS' as const })));

      const board = await getLeaderboard(tx);
      expect(board).toEqual([
        { rank: 1, intraId: `${tag}_e`, campus: 'GS', completedCount: BIG + 3, leaderCount: 0 },
        { rank: 2, intraId: `${tag}_b`, campus: 'GS', completedCount: BIG + 2, leaderCount: 5 },
        { rank: 3, intraId: `${tag}_a`, campus: 'GS', completedCount: BIG + 2, leaderCount: 1 },
        { rank: 4, intraId: `${tag}_c`, campus: 'GS', completedCount: BIG + 2, leaderCount: 1 },
        { rank: 5, intraId: `${tag}_d`, campus: 'GS', completedCount: BIG + 1, leaderCount: 9 },
      ]);
      for (const item of board) expect(item).not.toHaveProperty('avatarUrl');
    });
  });

  it('완주·리더 기록이 모두 0인 유저는 포함하지 않는다', async () => {
    await withRollback(async (tx) => {
      // 기록 있는 유저가 5명 미만이 되도록, 테스트 전용 유저 외에는 판정하지 않는다.
      const zeroId = `lbzero${Date.now()}`;
      await tx.insert(users).values({ intraId: zeroId, campus: 'SEOUL' });
      const [zero] = await tx.select().from(users).where(eq(users.intraId, zeroId));
      expect(zero.completedCount).toBe(0);
      expect(zero.leaderCount).toBe(0);

      const board = await getLeaderboard(tx);
      expect(board.map((b) => b.intraId)).not.toContain(zeroId);
      expect(board.length).toBeLessThanOrEqual(5);
      for (const item of board) expect(item.completedCount + item.leaderCount).toBeGreaterThan(0);
    });
  });
});
