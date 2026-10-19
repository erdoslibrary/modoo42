// 리더의 완주 벌크 판정. contracts/posts-complete.md (specs/003-completion-lifecycle).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serverNow } from '@/lib/clock';
import { requestDatabase } from '@/lib/dev/sandbox';
import { AppError, toErrorResponse } from '@/lib/errors';
import { completePostSchema } from '@/lib/validation';
import { completePost } from '@/lib/posts';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const parsed = completePostSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '판정 입력이 올바르지 않습니다.');

    const { evaluations, proofUrl } = parsed.data;
    const result = await completePost(params.id, user.id, evaluations, proofUrl, requestDatabase(), serverNow());
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
