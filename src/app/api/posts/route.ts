// 게시글 리스트 조회(GET) + 개설(POST). contracts/posts-list.md, posts-create.md.
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { serverNow } from '@/lib/clock';
import { requestDatabase } from '@/lib/dev/sandbox';
import { AppError, toErrorResponse } from '@/lib/errors';
import { createPostRequestSchema } from '@/lib/validation';
import { createPost, createLivePing, listPosts, type ListFilter } from '@/lib/posts';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const sp = new URL(request.url).searchParams;
    const filter: ListFilter = {};
    const type = sp.get('type');
    if (type === 'STUDY' || type === 'PARTY' || type === 'LIVE') filter.type = type;
    const status = sp.get('status');
    if (status === 'RECRUITING' || status === 'CLOSED' || status === 'COMPLETED' || status === 'CANCELLED') {
      filter.status = status;
    }
    const sort = sp.get('sort');
    if (sort === 'deadline' || sort === 'latest') filter.sort = sort;

    const posts = await listPosts(filter, requestDatabase(), serverNow());
    return NextResponse.json({ posts });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const parsed = createPostRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '입력이 올바르지 않습니다.');

    const database = requestDatabase();
    const now = serverNow();
    const created =
      parsed.data.type === 'LIVE'
        ? await createLivePing(parsed.data, user.id, database, now)
        : await createPost(parsed.data, user.id, database, now);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
