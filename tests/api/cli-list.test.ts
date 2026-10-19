import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/list/route';

// 비인증 엔드포인트. getCurrentUser를 아예 호출하지 않아야 한다.
const { getCurrentUser, listForCli } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listForCli: vi.fn(),
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
vi.mock('@/lib/posts', () => ({ listForCli }));

// chatUrl을 일부러 섞어 라우트 투영이 다시 걸러내는지 확인한다 (방어 테스트).
const fixture = () => ({
  pings: [
    {
      id: 'ping-1',
      title: 'philosopher 데드락 헬프',
      place: '클러스터 2층',
      tags: [],
      currentMembers: 1,
      maxMembers: null,
      endDate: null,
      expiresAt: new Date('2030-01-01T00:30:00.000Z'),
      leader: { login: 'gs_leader', campus: 'GS' },
      chatUrl: 'https://open.kakao.com/o/leak',
      description: '새면 안 되는 설명',
    },
  ],
  parties: [
    {
      id: 'party-1',
      title: '해커톤 팀원 모집',
      place: '코엑스',
      tags: ['해커톤'],
      currentMembers: 1,
      maxMembers: 4,
      endDate: new Date('2030-01-04T14:59:59.999Z'),
      expiresAt: null,
      leader: { login: 'seoul_member', campus: 'SEOUL' },
      chatUrl: 'https://discord.gg/leak',
    },
  ],
  studies: [],
});

const req = (qs = '') => new Request(`http://localhost:3000/api/list${qs}`);

beforeEach(() => {
  getCurrentUser.mockReset();
  listForCli.mockReset();
  listForCli.mockResolvedValue(fixture());
});

describe('GET /api/list — CLI 조회 (TC-CLI-01)', () => {
  it('쿠키 없이 200, 인증을 조회하지 않는다', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('기본 형식은 ANSI 텍스트다', async () => {
    const res = await GET(req());
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    const body = await res.text();
    expect(body).toContain('\x1b[');
    expect(body).toContain('philosopher 데드락 헬프');
  });

  it('format=plain은 이스케이프 문자가 없다', async () => {
    const res = await GET(req('?format=plain'));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toContain('\x1b');
    expect(body).toContain('해커톤 팀원 모집');
  });

  it('format=json은 구조화된 JSON을 준다', async () => {
    const res = await GET(req('?format=json'));
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toHaveProperty('generatedAt');
    expect(body.pings).toHaveLength(1);
    expect(body.parties).toHaveLength(1);
    expect(body.studies).toHaveLength(0);
    expect(body.pings[0]).toMatchObject({ id: 'ping-1', place: '클러스터 2층' });
    expect(body.parties[0].leader).toEqual({ login: 'seoul_member', campus: 'SEOUL' });
  });

  it('허용되지 않은 format은 400', async () => {
    const res = await GET(req('?format=xml'));
    expect(res.status).toBe(400);
  });

  it('모든 응답에 cache-control: no-store', async () => {
    for (const qs of ['', '?format=plain', '?format=json', '?format=xml']) {
      const res = await GET(req(qs));
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it.each(['', '?format=plain', '?format=json'])(
    '%s 응답에 chat_url·설명이 없다 (헌법 V)',
    async (qs) => {
      const res = await GET(req(qs));
      const body = await res.text();
      expect(body).not.toContain('chatUrl');
      expect(body).not.toContain('open.kakao.com');
      expect(body).not.toContain('discord.gg');
      expect(body).not.toContain('새면 안 되는 설명');
    },
  );

  it('0건이면 안내 문구를 준다', async () => {
    listForCli.mockResolvedValue({ pings: [], parties: [], studies: [] });
    const res = await GET(req('?format=plain'));
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain('모집 중인 글이 없습니다.');
  });
});
