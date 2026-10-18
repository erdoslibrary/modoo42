// 화면·CLI 공용 표기 파생 (data-model.md §5). 순수 함수만 둔다 — @/db를 import하지 않으므로
// 클라이언트 컴포넌트와 CLI 포매터가 같은 모듈을 쓴다 (research.md R2).
// remainingLabel·ddayLabel은 cli-format.ts에서 이동했다. 출력 문자열을 바꾸면 CLI 계약이 깨진다.
import { toKstWall } from '@/lib/end-date';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** LIVE 핑 남은 시간. 1분 미만과 이미 지난 시각은 '1분 남음'으로 올린다. */
export function remainingLabel(expiresAt: Date, now: Date): string {
  const minutes = Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 남음`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간 남음` : `${h}시간 ${m}분 남음`;
}

/** 단기 파티 D-Day. KST 달력 날짜 차이로 세고 0 이하는 'D-Day'다. */
export function ddayLabel(endDate: Date, now: Date): string {
  const endWall = toKstWall(endDate);
  const nowWall = toKstWall(now);
  const endDay = Date.UTC(endWall.getUTCFullYear(), endWall.getUTCMonth(), endWall.getUTCDate());
  const nowDay = Date.UTC(nowWall.getUTCFullYear(), nowWall.getUTCMonth(), nowWall.getUTCDate());
  const days = Math.round((endDay - nowDay) / 86_400_000);
  return days <= 0 ? 'D-Day' : `D-${days}`;
}

/**
 * 이니셜 뱃지 (CLAUDE.md §7.2). 핸들 앞 2자를 쓰고 영문만 대문자로 올린다.
 * 외부 프로필 이미지를 쓰지 않는 대신의 표시 수단이다.
 */
export function initials(login: string): string {
  return login.slice(0, 2).toUpperCase();
}

/** 인원 표기. 정원이 없는 LIVE 핑은 null이다. */
export function headcountLabel(current: number | null, max: number | null): string | null {
  if (current === null || max === null) return null;
  return `${current}/${max}명`;
}

/** 정규 스터디 카드의 기간 표기. end_date가 속한 KST 달의 1일~말일을 보여준다. */
export function cycleLabel(endDate: Date | null): string | null {
  if (!endDate) return null;
  const wall = toKstWall(endDate);
  const year = wall.getUTCFullYear() % 100;
  const month = wall.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(wall.getUTCFullYear(), month, 0)).getUTCDate();
  return `${year}.${month}.1~${month}.${lastDay}`;
}

/** 프로필 이력의 기간 표기. 연·월만 쓴다. */
export function periodLabel(date: Date | null): string | null {
  if (!date) return null;
  const wall = toKstWall(date);
  return `${wall.getUTCFullYear() % 100}.${pad2(wall.getUTCMonth() + 1)}`;
}
