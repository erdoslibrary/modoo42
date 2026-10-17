// 개발 환경 전용 Mock 인증 엔드포인트 (contracts/mock-auth.md).
// 상용에서는 404로 차단한다 — 노출 시 인증 우회가 되기 때문이다 (CLAUDE.md §6.1).
import { NextResponse } from 'next/server';
import { MOCK_COOKIE_NAME, PERSONAS, isMockAuthEnabled } from '@/lib/auth';

export async function POST(request: Request) {
  if (!isMockAuthEnabled()) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  let persona: unknown;
  try {
    persona = (await request.json())?.persona;
  } catch {
    persona = undefined;
  }

  if (persona === 'guest') {
    const res = NextResponse.json({ persona: 'guest' });
    res.cookies.delete(MOCK_COOKIE_NAME);
    return res;
  }

  if (typeof persona === 'string' && persona in PERSONAS) {
    const res = NextResponse.json({ persona });
    res.cookies.set(MOCK_COOKIE_NAME, persona, {
      path: '/',
      sameSite: 'lax',
    });
    return res;
  }

  // 미지/누락 persona: 기존 세션 유지 (FR-005).
  return NextResponse.json({ error: 'BAD_REQUEST' }, { status: 400 });
}
