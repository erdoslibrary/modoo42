// 로그아웃 (FR-015). 세션 쿠키를 즉시 파기하고 랜딩으로 보낸다.
import { NextResponse } from 'next/server';
import { appBaseUrl } from '@/lib/oauth';
import { MOCK_COOKIE_NAME } from '@/lib/auth';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';

function clear(request: Request) {
  const response = NextResponse.redirect(new URL('/login', appBaseUrl(request)));
  response.cookies.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
  response.cookies.set(MOCK_COOKIE_NAME, '', sessionCookieOptions(0));
  return response;
}

export async function POST(request: Request) {
  return clear(request);
}

export async function GET(request: Request) {
  return clear(request);
}
