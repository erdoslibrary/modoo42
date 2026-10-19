// 원클릭 참여. contracts/posts-join.md. 구현 원본 trd.md §4.1.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serverNow } from '@/lib/clock';
import { requestDatabase } from '@/lib/dev/sandbox';
import { AppError, toErrorResponse } from '@/lib/errors';
import { joinPost } from '@/lib/posts';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const result = await joinPost(params.id, user.id, requestDatabase(), serverNow());
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
