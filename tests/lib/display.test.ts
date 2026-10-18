// 화면 표기 파생 (data-model.md §5). CLI 출력과 같은 문자열을 쓰므로 포맷을 여기서 고정한다.
import { describe, it, expect } from 'vitest';
import {
  remainingLabel,
  ddayLabel,
  initials,
  headcountLabel,
  cycleLabel,
  periodLabel,
} from '@/lib/display';

const KST = 9 * 60 * 60 * 1000;
/** KST 벽시계 값으로 UTC Date를 만든다. */
const kst = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(Date.UTC(y, m - 1, d, h, min) - KST);

describe('remainingLabel — LIVE 핑 남은 시간', () => {
  const now = kst(2026, 10, 18, 12, 0);

  it('1분 미만은 1분 남음으로 올린다', () => {
    expect(remainingLabel(new Date(now.getTime() + 10_000), now)).toBe('1분 남음');
  });

  it('이미 지난 시각도 1분 남음으로 고정한다 (음수 표기 금지)', () => {
    expect(remainingLabel(new Date(now.getTime() - 60_000), now)).toBe('1분 남음');
  });

  it('60분 미만은 분으로 표기한다', () => {
    expect(remainingLabel(new Date(now.getTime() + 42 * 60_000), now)).toBe('42분 남음');
  });

  it('정시는 시간만 표기한다', () => {
    expect(remainingLabel(new Date(now.getTime() + 120 * 60_000), now)).toBe('2시간 남음');
  });

  it('시간과 분을 함께 표기한다', () => {
    expect(remainingLabel(new Date(now.getTime() + 75 * 60_000), now)).toBe('1시간 15분 남음');
  });
});

describe('ddayLabel — 단기 파티 D-Day', () => {
  it('KST 날짜 차이로 센다', () => {
    expect(ddayLabel(kst(2026, 10, 21, 23, 59), kst(2026, 10, 18, 1, 0))).toBe('D-3');
  });

  it('같은 KST 날짜는 D-Day다', () => {
    expect(ddayLabel(kst(2026, 10, 18, 23, 59), kst(2026, 10, 18, 9, 0))).toBe('D-Day');
  });

  it('지난 날짜도 D-Day로 표기한다 (음수 금지)', () => {
    expect(ddayLabel(kst(2026, 10, 15, 23, 59), kst(2026, 10, 18, 9, 0))).toBe('D-Day');
  });
});

describe('initials — 이니셜 뱃지 (CLAUDE.md §7.2)', () => {
  // 디자인 원본(myprofile.html)은 borlee를 'BR'로 그렸지만 그건 손으로 만든 약자다.
  // 규칙 SSOT는 CLAUDE.md §7.2 "login 앞 2자리"이므로 'BO'가 맞다.
  it('영문 앞 2자를 대문자로 올린다', () => {
    expect(initials('borlee')).toBe('BO');
  });

  it('숫자·하이픈은 그대로 쓴다', () => {
    expect(initials('42-foo')).toBe('42');
  });

  it('1자 핸들은 1자만 돌려준다', () => {
    expect(initials('a')).toBe('A');
  });

  it('빈 문자열은 빈 문자열이다', () => {
    expect(initials('')).toBe('');
  });
});

describe('headcountLabel — 인원 표기', () => {
  it('정원이 없으면(LIVE 핑) null이다', () => {
    expect(headcountLabel(1, null)).toBeNull();
  });

  it('현재/정원을 명 단위로 표기한다', () => {
    expect(headcountLabel(4, 6)).toBe('4/6명');
  });
});

describe('cycleLabel / periodLabel — 기간 표기', () => {
  it('정규 스터디 카드는 해당 월 1일~말일을 표기한다', () => {
    expect(cycleLabel(kst(2026, 11, 30, 23, 59))).toBe('26.11.1~11.30');
  });

  it('2월은 말일이 28일이다 (2026년)', () => {
    expect(cycleLabel(kst(2026, 2, 28, 23, 59))).toBe('26.2.1~2.28');
  });

  it('기간이 없으면 null이다', () => {
    expect(cycleLabel(null)).toBeNull();
  });

  it('프로필 이력은 연·월만 표기한다', () => {
    expect(periodLabel(kst(2026, 9, 30, 23, 59))).toBe('26.09');
  });
});
