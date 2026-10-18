import { describe, it, expect } from 'vitest';
import { renderCliText, stripControl, type CliItem, type CliData } from '@/lib/cli-format';

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst('2026-10-18T14:00:00'); // KST 14:00

const item = (over: Partial<CliItem> = {}): CliItem => ({
  id: 'id-1',
  title: '제목',
  place: null,
  tags: [],
  currentMembers: null,
  maxMembers: null,
  endDate: null,
  expiresAt: null,
  leader: { intraId: 'gs_leader', campus: 'GS' },
  ...over,
});

const data = (over: Partial<CliData> = {}): CliData => ({
  pings: [],
  parties: [],
  studies: [],
  ...over,
});

const plain = (d: CliData) => renderCliText(d, { color: false, now: NOW });

describe('stripControl — 터미널 제어 문자 제거 (research R11)', () => {
  it('C0·DEL·C1 제어 문자를 모두 제거하고 순서를 보존한다', () => {
    expect(stripControl('a\x1b]0;pwn\x07b\nc\x7fd\x9be')).toBe('a]0;pwnbcde');
  });

  it('일반 한글·공백·기호는 남긴다', () => {
    expect(stripControl('클러스터 2층 #해커톤')).toBe('클러스터 2층 #해커톤');
  });
});

describe('renderCliText — 헤더와 섹션 (contracts/cli-list.md)', () => {
  it('헤더에 KST 현재 시각을 적는다', () => {
    expect(plain(data())).toContain('모두의 42 — 2026-10-18 14:00 KST');
  });

  it('섹션 순서는 LIVE 핑 → 단기 파티 → 정규 스터디이고 개수를 적는다', () => {
    const out = plain(
      data({
        pings: [item({ expiresAt: new Date(NOW.getTime() + 10 * 60_000) })],
        parties: [item({ endDate: kst('2026-10-21T23:59:59.999') }), item()],
        studies: [item()],
      }),
    );
    expect(out).toContain('[LIVE 핑] 1');
    expect(out).toContain('[단기 파티] 2');
    expect(out).toContain('[정규 스터디] 1');
    expect(out.indexOf('[LIVE 핑]')).toBeLessThan(out.indexOf('[단기 파티]'));
    expect(out.indexOf('[단기 파티]')).toBeLessThan(out.indexOf('[정규 스터디]'));
  });

  it('빈 섹션은 (없음)으로 표기한다', () => {
    const out = plain(data({ studies: [item()] }));
    expect(out).toContain('[LIVE 핑] 0');
    expect(out).toContain('(없음)');
  });

  it('세 섹션이 모두 비면 안내 한 줄을 적는다', () => {
    expect(plain(data())).toContain('모집 중인 글이 없습니다.');
  });
});

describe('renderCliText — LIVE 핑 남은 시간', () => {
  const ping = (ms: number) =>
    plain(data({ pings: [item({ expiresAt: new Date(NOW.getTime() + ms) })] }));

  it('28분 뒤 만료 → 28분 남음', () => {
    expect(ping(28 * 60_000)).toContain('28분 남음');
  });

  it('72분 뒤 만료 → 1시간 12분 남음', () => {
    expect(ping(72 * 60_000)).toContain('1시간 12분 남음');
  });

  it('30초 뒤 만료 → 1분 남음 (분 단위 올림)', () => {
    expect(ping(30_000)).toContain('1분 남음');
  });

  it('정확히 2시간 뒤 만료 → 2시간 남음', () => {
    expect(ping(120 * 60_000)).toContain('2시간 남음');
  });
});

describe('renderCliText — 단기 파티 D-Day', () => {
  const party = (endDate: Date) => plain(data({ parties: [item({ endDate })] }));

  it('3일 뒤 마감 → D-3', () => {
    expect(party(kst('2026-10-21T23:59:59.999'))).toContain('D-3');
  });

  it('당일 마감 → D-Day', () => {
    expect(party(kst('2026-10-18T23:59:59.999'))).toContain('D-Day');
  });
});

describe('renderCliText — 항목 필드', () => {
  it('LIVE 항목에 내용·위치·작성자가 들어간다', () => {
    const out = plain(
      data({
        pings: [
          item({
            title: 'philosopher 데드락 30분 헬프 구합니다',
            place: '클러스터 2층',
            expiresAt: new Date(NOW.getTime() + 28 * 60_000),
            leader: { intraId: 'gs_leader', campus: 'GS' },
          }),
        ],
      }),
    );
    expect(out).toContain('philosopher 데드락 30분 헬프 구합니다');
    expect(out).toContain('@ 클러스터 2층');
    expect(out).toContain('(gs_leader·GS)');
  });

  it('파티·스터디 항목에 인원과 태그가 들어간다', () => {
    const out = plain(
      data({
        parties: [
          item({
            title: '오픈소스 해커톤 팀원 모집',
            tags: ['해커톤'],
            currentMembers: 1,
            maxMembers: 4,
            place: '코엑스',
            endDate: kst('2026-10-21T23:59:59.999'),
            leader: { intraId: 'seoul_member', campus: 'SEOUL' },
          }),
        ],
      }),
    );
    expect(out).toContain('1/4명');
    expect(out).toContain('#해커톤');
    expect(out).toContain('(seoul_member·SEOUL)');
  });

  it('스터디 항목에 마감일을 ~M/D로 적는다', () => {
    const out = plain(
      data({
        studies: [
          item({
            title: 'born2solve 알고리즘 정복',
            currentMembers: 3,
            maxMembers: 10,
            endDate: kst('2026-10-31T23:59:59.999'),
          }),
        ],
      }),
    );
    expect(out).toContain('~10/31');
    expect(out).toContain('3/10명');
  });

  it('place가 null이면 @ 표기를 생략한다', () => {
    const out = plain(data({ studies: [item({ place: null })] }));
    expect(out).not.toContain('@');
  });

  it('제어 문자가 섞인 입력도 한 줄을 유지한다', () => {
    const out = plain(
      data({
        pings: [
          item({
            title: 'a\x1b]0;pwn\x07b\nc\x7f\x9bd',
            place: 'e\nf',
            tags: ['g\x1bh'],
            expiresAt: new Date(NOW.getTime() + 10 * 60_000),
            leader: { intraId: 'i\nj', campus: 'GS' },
          }),
        ],
      }),
    );
    expect(out).not.toMatch(/\x1b\]/);
    expect(out).not.toContain('\x07');
    expect(out).not.toContain('\x7f');
    expect(out).not.toContain('\x9b');
    expect(out).toContain('a]0;pwnbcd');
    expect(out).toContain('@ ef');
    expect(out).toContain('(ij·GS)');
    // 핑 1건이므로 LIVE 섹션 제목 다음 줄 하나로 끝나야 한다.
    const lines = out.split('\n');
    const sectionIdx = lines.findIndex((l) => l.includes('[LIVE 핑]'));
    expect(lines[sectionIdx + 1]).toContain('a]0;pwnbcd');
    expect(lines[sectionIdx + 2]).toBe('');
  });
});

describe('renderCliText — ANSI 색', () => {
  const d = data({ pings: [item({ expiresAt: new Date(NOW.getTime() + 10 * 60_000) })] });

  it('color: false면 이스케이프 문자가 없다', () => {
    expect(renderCliText(d, { color: false, now: NOW })).not.toContain('\x1b');
  });

  it('color: true면 SGR 코드가 있고 리셋으로 끝난다', () => {
    const out = renderCliText(d, { color: true, now: NOW });
    expect(out).toContain('\x1b[');
    expect(out.endsWith('\x1b[0m')).toBe(true);
  });
});
