import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as hallOfFame } from '@/app/api/hall-of-fame/route';
import { GET as leaderboard } from '@/app/api/leaderboard/route';

const { getCurrentUser, listHallOfFame, getLeaderboard } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listHallOfFame: vi.fn(),
  getLeaderboard: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ getCurrentUser }));
vi.mock('@/lib/posts', () => ({ listHallOfFame, getLeaderboard }));

const UID = '7b2e9d14-6a3f-4c58-8e71-2d9a0b4c6f83';
const get = (query = '') => new Request(`http://localhost:3000/api/hall-of-fame${query}`);

beforeEach(() => {
  getCurrentUser.mockReset();
  listHallOfFame.mockReset().mockResolvedValue([]);
  getLeaderboard.mockReset().mockResolvedValue([]);
});

describe('GET /api/hall-of-fame', () => {
  it('비로그인 → 403', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await hallOfFame(get())).status).toBe(403);
    expect(listHallOfFame).not.toHaveBeenCalled();
  });

  it('kind 기본값 completed, kind=postmortem 전달', async () => {
    getCurrentUser.mockResolvedValue({ id: UID });
    expect((await hallOfFame(get())).status).toBe(200);
    expect(listHallOfFame).toHaveBeenLastCalledWith('completed');
    expect((await hallOfFame(get('?kind=postmortem'))).status).toBe(200);
    expect(listHallOfFame).toHaveBeenLastCalledWith('postmortem');
  });

  it('잘못된 kind → 400', async () => {
    getCurrentUser.mockResolvedValue({ id: UID });
    expect((await hallOfFame(get('?kind=foo'))).status).toBe(400);
    expect(listHallOfFame).not.toHaveBeenCalled();
  });
});

describe('GET /api/leaderboard', () => {
  it('비로그인 → 403', async () => {
    getCurrentUser.mockResolvedValue(null);
    expect((await leaderboard()).status).toBe(403);
    expect(getLeaderboard).not.toHaveBeenCalled();
  });

  it('로그인 → 200', async () => {
    getCurrentUser.mockResolvedValue({ id: UID });
    expect((await leaderboard()).status).toBe(200);
  });
});
