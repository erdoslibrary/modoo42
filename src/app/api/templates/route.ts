// 템플릿 프리셋 목록 조회. contracts/templates-list.md (specs/003-completion-lifecycle).
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AppError, toErrorResponse } from '@/lib/errors';
import { listTemplates } from '@/lib/templates';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError('FORBIDDEN', '로그인이 필요합니다.');
    return NextResponse.json(listTemplates());
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
