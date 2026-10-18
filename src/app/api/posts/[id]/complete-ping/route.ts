// LIVE 핑 작성자의 조기 완료. contracts/posts-complete-ping.md.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { completeLivePing } from '@/lib/posts';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const result = await completeLivePing(params.id, user.id);
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
