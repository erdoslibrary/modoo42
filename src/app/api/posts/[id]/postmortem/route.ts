// 리더의 실패 회고(Post-mortem) 등록. contracts/posts-postmortem.md (specs/003-completion-lifecycle).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serverNow } from '@/lib/clock';
import { requestDatabase } from '@/lib/dev/sandbox';
import { AppError, toErrorResponse } from '@/lib/errors';
import { postmortemSchema } from '@/lib/validation';
import { postmortemPost } from '@/lib/posts';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const parsed = postmortemSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '회고는 1~1000자로 작성합니다.');

    const result = await postmortemPost(params.id, user.id, parsed.data.text, requestDatabase(), serverNow());
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
