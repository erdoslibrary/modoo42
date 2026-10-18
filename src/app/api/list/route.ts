// 터미널 CLI 조회 (비인증). contracts/cli-list.md.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, toErrorResponse } from '@/lib/errors';
import { listForCli } from '@/lib/posts';
import { renderCliText, type CliData, type CliItem } from '@/lib/cli-format';

const formatSchema = z.enum(['ansi', 'plain', 'json']).default('ansi');

const NO_STORE = { 'cache-control': 'no-store' };

// 공개 엔드포인트라 노출 필드를 한 번 더 좁힌다 (헌법 V). chat_url·설명은 싣지 않는다.
function project(item: CliItem): CliItem {
  return {
    id: item.id,
    title: item.title,
    place: item.place,
    tags: item.tags,
    currentMembers: item.currentMembers,
    maxMembers: item.maxMembers,
    endDate: item.endDate,
    expiresAt: item.expiresAt,
    leader: { login: item.leader.login, campus: item.leader.campus },
  };
}

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get('format');
    const parsed = formatSchema.safeParse(raw ?? undefined);
    if (!parsed.success) throw new AppError('BAD_REQUEST', 'format은 ansi, plain, json만 가능하다.');
    const format = parsed.data;

    const now = new Date();
    const fetched = await listForCli(undefined, now);
    const data: CliData = {
      pings: fetched.pings.map(project),
      parties: fetched.parties.map(project),
      studies: fetched.studies.map(project),
    };

    if (format === 'json') {
      return NextResponse.json({ generatedAt: now.toISOString(), ...data }, { headers: NO_STORE });
    }

    return new Response(renderCliText(data, { color: format === 'ansi', now }), {
      headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE },
    });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status, headers: NO_STORE });
  }
}
