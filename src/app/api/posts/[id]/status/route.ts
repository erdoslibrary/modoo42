// 리더의 수동 마감/재모집 토글. contracts/posts-status.md (trd §4 표에 추가됨).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { statusToggleSchema } from '@/lib/validation';
import { toggleStatus } from '@/lib/posts';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const parsed = statusToggleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '전환할 상태가 올바르지 않습니다.');

    const result = await toggleStatus(params.id, user.id, parsed.data.status);
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
