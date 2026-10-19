// 개발자 콘솔의 페르소나 전환 엔드포인트 (contracts/mock-auth.md, FR-027).
// 게이트는 NODE_ENV가 아니라 개발자 콘솔 하나다 — 비밀번호로 콘솔에 들어온 세션만
// 페르소나를 바꿀 수 있다. 그 밖에는 404로 라우트 존재 자체를 숨긴다 (CLAUDE.md §6.1).
import { NextResponse } from 'next/server';
import { MOCK_COOKIE_NAME, PERSONAS, isPersonaSwitchEnabled } from '@/lib/auth';

export async function POST(request: Request) {
  if (!isPersonaSwitchEnabled()) {
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
