// 터미널 CLI 출력 렌더링. contracts/cli-list.md 형식 그대로.
// DB를 import하지 않는 순수 모듈이다 (research R10).
import { toKstWall } from '@/lib/end-date';
import type { PublicUser } from '@/lib/public-user';

export type CliItem = {
  id: string;
  title: string;
  place: string | null;
  tags: string[];
  currentMembers: number | null;
  maxMembers: number | null;
  endDate: Date | null;
  expiresAt: Date | null;
  leader: PublicUser;
};

export type CliData = {
  pings: CliItem[];
  parties: CliItem[];
  studies: CliItem[];
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const ACCENT = '\x1b[32m'; // 액센트 1색. 상태 정보(남은 시간·D-Day)에만 쓴다.

/**
 * 사용자 입력에 섞인 터미널 제어 문자를 제거한다 (research R11).
 * 공개 엔드포인트를 curl하는 사람의 터미널 상태를 조작하는 주입을 막고,
 * 줄바꿈 제거로 한 항목이 여러 줄로 위장하는 것도 막는다.
 */
export function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function remainingLabel(expiresAt: Date, now: Date): string {
  const minutes = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 남음`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간 남음` : `${h}시간 ${m}분 남음`;
}

function ddayLabel(endDate: Date, now: Date): string {
  const endWall = toKstWall(endDate);
  const nowWall = toKstWall(now);
  const endDay = Date.UTC(endWall.getUTCFullYear(), endWall.getUTCMonth(), endWall.getUTCDate());
  const nowDay = Date.UTC(nowWall.getUTCFullYear(), nowWall.getUTCMonth(), nowWall.getUTCDate());
  const days = Math.round((endDay - nowDay) / 86_400_000);
  return days <= 0 ? 'D-Day' : `D-${days}`;
}

function headcount(item: CliItem): string | null {
  if (item.currentMembers === null || item.maxMembers === null) return null;
  return `${item.currentMembers}/${item.maxMembers}명`;
}

function tagList(tags: string[]): string | null {
  if (tags.length === 0) return null;
  return tags.map((t) => `#${stripControl(t)}`).join(' ');
}

function placeLabel(place: string | null): string | null {
  const cleaned = place ? stripControl(place) : '';
  return cleaned ? `@ ${cleaned}` : null;
}

function leaderLabel(item: CliItem): string {
  const login = stripControl(item.leader.login);
  // 캠퍼스 미인증 유저는 구분자까지 생략한다 — (login·) 같은 흔적을 남기지 않는다 (FR-016).
  return item.leader.campus ? `(${login}·${item.leader.campus})` : `(${login})`;
}

function itemLine(item: CliItem, kind: keyof CliData, now: Date, color: boolean): string {
  const accent = (s: string) => (color ? `${ACCENT}${s}${RESET}` : s);
  const parts: (string | null)[] = [];

  if (kind === 'pings') {
    parts.push(item.expiresAt ? accent(remainingLabel(item.expiresAt, now)) : null);
  } else if (kind === 'parties') {
    parts.push(item.endDate ? accent(ddayLabel(item.endDate, now)) : null);
  }

  parts.push(stripControl(item.title), headcount(item), tagList(item.tags), placeLabel(item.place));

  if (kind === 'studies' && item.endDate) {
    const wall = toKstWall(item.endDate);
    parts.push(`~${wall.getUTCMonth() + 1}/${wall.getUTCDate()}`);
  }

  parts.push(leaderLabel(item));
  return `  ${parts.filter(Boolean).join('  ')}`;
}

const SECTIONS: { key: keyof CliData; label: string }[] = [
  { key: 'pings', label: 'LIVE 핑' },
  { key: 'parties', label: '단기 파티' },
  { key: 'studies', label: '정규 스터디' },
];

export function renderCliText(data: CliData, opts: { color: boolean; now: Date }): string {
  const { color, now } = opts;
  const wall = toKstWall(now);
  const stamp = `${wall.getUTCFullYear()}-${pad2(wall.getUTCMonth() + 1)}-${pad2(wall.getUTCDate())} ${pad2(wall.getUTCHours())}:${pad2(wall.getUTCMinutes())}`;

  const lines: string[] = [`모두의 42 — ${stamp} KST`, ''];

  if (data.pings.length + data.parties.length + data.studies.length === 0) {
    lines.push('모집 중인 글이 없습니다.', '');
  }

  for (const { key, label } of SECTIONS) {
    const items = data[key];
    const heading = `[${label}] ${items.length}`;
    lines.push(color ? `${BOLD}${heading}${RESET}` : heading);
    if (items.length === 0) {
      lines.push('  (없음)');
    } else {
      for (const item of items) lines.push(itemLine(item, key, now, color));
    }
    lines.push('');
  }

  const body = lines.join('\n');
  return color ? `${body}${RESET}` : body;
}
