// 게시글 상세 조회(GET) + 리더 수정(PUT). contracts/posts-get.md, posts-update.md.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { updatePostSchema } from '@/lib/validation';
import { getPostDetail, updatePost } from '@/lib/posts';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const detail = await getPostDetail(params.id, user.id);
    return NextResponse.json(detail);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const parsed = updatePostSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '입력이 올바르지 않습니다.');

    const updated = await updatePost(params.id, user.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
