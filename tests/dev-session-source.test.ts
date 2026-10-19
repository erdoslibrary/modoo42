// 패널 인증 섹션의 세션 해석 소스 (FR-027, data-model.md §5).
// getCurrentUser()의 우선순위는 바꾸지 않는다 — 표시만 파생한다.
import { beforeAll, describe, expect, it } from 'vitest';
import { createSessionToken } from '@/lib/session';
import { sessionSourceOf } from '@/lib/auth';

const USER_ID = '00000000-0000-4000-8000-000000000001';

beforeAll(() => {
  process.env.GITHUB_CLIENT_SECRET ??= 'test-secret';
});

describe('세션 해석 소스 파생 (FR-027)', () => {
  it('유효한 modoo42_session이 있으면 session이다 — 페르소나보다 우선한다', () => {
    const session = createSessionToken(USER_ID, new Date());
    expect(sessionSourceOf({ session })).toBe('session');
    expect(sessionSourceOf({ session, persona: 'gs_member' })).toBe('session');
  });

  it('세션이 없고 유효한 페르소나만 있으면 persona다', () => {
    expect(sessionSourceOf({ persona: 'gs_leader' })).toBe('persona');
    expect(sessionSourceOf({ persona: 'github_only' })).toBe('persona');
  });

  it('둘 다 없거나 값이 손상되면 비로그인이다', () => {
    expect(sessionSourceOf({})).toBe('anonymous');
    expect(sessionSourceOf({ persona: 'bogus_value' })).toBe('anonymous');
    expect(sessionSourceOf({ persona: 'guest' })).toBe('anonymous');
    // 서명이 깨진 세션 쿠키는 세션으로 보지 않는다.
    expect(sessionSourceOf({ session: 'forged.0.sig' })).toBe('anonymous');
    expect(sessionSourceOf({ session: 'forged.0.sig', persona: 'gs_member' })).toBe('persona');
  });

  it('만료된 세션 쿠키는 세션으로 보지 않는다', () => {
    const issuedAt = new Date('2026-01-01T00:00:00Z');
    const session = createSessionToken(USER_ID, issuedAt);
    // realNow()가 발급 시점보다 30일 넘게 지난 현재이므로 만료다.
    expect(sessionSourceOf({ session })).toBe('anonymous');
  });
});
