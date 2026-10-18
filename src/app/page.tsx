// 루트 게이트 (FR-015). 인증 유저는 대시보드로, 미인증 유저는 소개 랜딩으로 보낸다 (trd.md §2.2-6).
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const me = await getCurrentUser();
  redirect(me ? '/dashboard' : '/login');
}
