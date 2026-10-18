// 브라우저 Supabase 클라이언트 (Realtime 구독 전용, research.md R10).
// 이 모듈은 클라이언트 컴포넌트에서만 import한다. 쓰기·조회는 Route Handler를 쓴다.
import { createBrowserClient } from '@supabase/ssr';

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cached: BrowserClient | null = null;

/**
 * 싱글턴 브라우저 클라이언트. 채널은 1개(posts-channel)만 열기 때문에
 * 컴포넌트마다 새 클라이언트를 만들지 않는다.
 */
export function getSupabaseBrowserClient(): BrowserClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY가 필요하다 (.env.local).',
    );
  }

  cached = createBrowserClient(url, key);
  return cached;
}
