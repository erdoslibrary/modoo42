// 로그인 시작 (FR-015, trd.md §2.2-1). state 난수를 단기 쿠키에 심고 GitHub 인가 화면으로 보낸다.
// PKCE를 쓰지 않는다 — GitHub OAuth App이 지원하지 않으므로 state 검증이 CSRF 방어다.
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { GITHUB_AUTHORIZE_URL, appBaseUrl, callbackUrl } from '@/lib/oauth';
import {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_MAX_AGE,
  sessionCookieOptions,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId || !process.env.GITHUB_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/login?error=config', appBaseUrl(request)));
  }

  const state = randomBytes(32).toString('base64url');
  const authorize = new URL(GITHUB_AUTHORIZE_URL);
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callbackUrl(request));
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);

  const response = NextResponse.redirect(authorize.toString());
  response.cookies.set(
    OAUTH_STATE_COOKIE_NAME,
    state,
    sessionCookieOptions(OAUTH_STATE_MAX_AGE),
  );
  return response;
}
