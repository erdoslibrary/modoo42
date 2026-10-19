import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as hallOfFame } from '@/app/api/hall-of-fame/route';
import { GET as leaderboard } from '@/app/api/leaderboard/route';

const { getCurrentUser, listHallOfFame, getLeaderboard } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listHallOfFame: vi.fn(),
  getLeaderboard: vi.fn(),
}));
const { FIXED_NOW, FAKE_DB } = vi.hoisted(() => ({
  FIXED_NOW: new Date('2026-10-19T03:00:00.000Z'),
  FAKE_DB: { __fake: 'db' },
}));
// 라우트를 직접 호출하면 next/headers의 cookies()가 요청 스코프 밖이라 던진다.
// 이 테스트는 라우트 배선을 보는 것이므로 시각·핸들 모듈을 대역으로 바꾼다 (FR-027).
vi.mock('@/lib/clock', () => ({ serverNow: () => FIXED_NOW, realNow: () => FIXED_NOW }));
vi.mock('@/lib/dev/sandbox', () => ({ requestDatabase: () => FAKE_DB }));
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
    expect(listHallOfFame).toHaveBeenLastCalledWith('completed', FAKE_DB);
    expect((await hallOfFame(get('?kind=postmortem'))).status).toBe(200);
    expect(listHallOfFame).toHaveBeenLastCalledWith('postmortem', FAKE_DB);
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
