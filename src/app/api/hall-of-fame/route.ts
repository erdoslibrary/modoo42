// 🏆명예의 전당 / 🪦Post-mortem 목록. contracts/hall-of-fame.md (specs/003-completion-lifecycle).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { listHallOfFame } from '@/lib/posts';

const kindSchema = z.enum(['completed', 'postmortem']).default('completed');

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');

    const raw = new URL(request.url).searchParams.get('kind') ?? undefined;
    const parsed = kindSchema.safeParse(raw);
    if (!parsed.success) throw new AppError('BAD_REQUEST', 'kind는 completed 또는 postmortem입니다.');

    return NextResponse.json(await listHallOfFame(parsed.data));
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
