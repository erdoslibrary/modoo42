import { redirect } from 'next/navigation';

// 루트는 대시보드로 보낸다. Phase 4에서 미인증 유저를 /login으로 보내는 게이트가
// middleware.ts에 붙는다 (trd.md §2.2, research.md R12).
export default function Home() {
  redirect('/dashboard');
}
