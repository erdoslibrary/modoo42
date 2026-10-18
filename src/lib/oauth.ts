// GitHub OAuth 2.0 엔드포인트와 앱 베이스 URL 조립 (trd.md §2.2).
export const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * 콜백 URL 조립에 쓰는 앱 베이스 URL.
 * NEXT_PUBLIC_APP_URL이 1순위다 — 배포 도메인은 GitHub OAuth App에 등록한 값과 글자 단위로
 * 같아야 한다. 미설정이면 요청 origin으로 떨어진다.
 */
export function appBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return new URL(request.url).origin;
}

export function callbackUrl(request: Request): string {
  return `${appBaseUrl(request)}/api/auth/callback`;
}
