// OAuth 콜백 (FR-015, trd.md §2.2-2~5). state 상수 시간 비교 → 토큰 교환 → 프로필 조회
// → users Upsert → 30일 서명 세션 쿠키 발급 순이다.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { syncGithubUser } from '@/lib/auth';
import { realNow } from '@/lib/clock';
import { GITHUB_TOKEN_URL, GITHUB_USER_URL, appBaseUrl, callbackUrl } from '@/lib/oauth';
import {
  OAUTH_STATE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  safeEqual,
  sessionCookieOptions,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 실패해도 state 쿠키는 반드시 파기한다 (1회용). */
function fail(request: Request, reason: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${reason}`, appBaseUrl(request)));
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, '', sessionCookieOptions(0));
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = cookies().get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (url.searchParams.get('error')) return fail(request, 'denied');
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    return fail(request, 'state');
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(request, 'config');

  try {
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl(request),
      }),
      cache: 'no-store',
    });
    const tokenBody = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenBody.access_token;
    if (!accessToken) return fail(request, 'token');

    const profileResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'modoo42',
      },
      cache: 'no-store',
    });
    if (!profileResponse.ok) return fail(request, 'profile');
    const profile = (await profileResponse.json()) as { id?: number; login?: string };
    if (typeof profile.id !== 'number' || !profile.login) return fail(request, 'profile');

    // avatar_url은 수집하지 않는다 (CLAUDE.md §7.2). campus는 42 추가 인증 전까지 null이다.
    const user = await syncGithubUser(String(profile.id), profile.login);

    const response = NextResponse.redirect(new URL('/dashboard', appBaseUrl(request)));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      // 세션 발급·만료는 개발 시계를 따르지 않는다 (FR-006). 항상 실제 시각이다.
      createSessionToken(user.id, realNow()),
      sessionCookieOptions(SESSION_MAX_AGE),
    );
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, '', sessionCookieOptions(0));
    return response;
  } catch {
    return fail(request, 'exchange');
  }
}
