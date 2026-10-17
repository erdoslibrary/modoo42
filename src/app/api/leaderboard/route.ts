// 성실 멤버 랭킹 TOP 5. contracts/leaderboard.md (specs/003-completion-lifecycle).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { getLeaderboard } from '@/lib/posts';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');
    return NextResponse.json(await getLeaderboard());
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
