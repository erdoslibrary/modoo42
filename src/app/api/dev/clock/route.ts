// 개발 시계 이동·복귀 (FR-027, contracts/dev-console-api.md C4·C5).
//
// 게이트가 닫히면 404다. 게이트는 열렸지만 유효한 콘솔 세션이 없으면 403 — 쿠키만
// 심어서 시각을 바꿀 수 없다 (TC-DEV-10).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { offsetForTarget, realNow, serverNow } from '@/lib/clock';
import { posts } from '@/db/schema';
import { AppError, toErrorResponse } from '@/lib/errors';
import {
  CLOCK_COOKIE_NAME,
  hasValidConsoleSession,
  isDevConsoleEnabled,
} from '@/lib/dev/console-session';
import { requestDatabase } from '@/lib/dev/sandbox';
import {
  POST_REQUIRED_PRESETS,
  PresetContextError,
  SCENARIO_PRESETS,
  presetTime,
  type ScenarioPreset,
} from '@/lib/dev/presets';

export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

// at과 preset은 배타다. 절대 시각에는 범위 제한을 두지 않는다.
const clockRequestSchema = z
  .object({
    at: z.string().optional(),
    preset: z.enum(SCENARIO_PRESETS).optional(),
    postId: z.uuid().optional(),
  })
  .superRefine((value, ctx) => {
    const hasAt = value.at !== undefined;
    const hasPreset = value.preset !== undefined;
    if (hasAt === hasPreset) {
      ctx.addIssue({ code: 'custom', message: 'at 또는 preset 중 하나만 보낸다.' });
      return;
    }
    if (hasAt && Number.isNaN(new Date(value.at!).getTime())) {
      ctx.addIssue({ code: 'custom', message: 'at이 ISO 8601 시각이 아니다.' });
    }
    if (hasPreset && POST_REQUIRED_PRESETS.includes(value.preset!) && !value.postId) {
      ctx.addIssue({ code: 'custom', message: '이 시나리오에는 postId가 필요하다.' });
    }
  });

/** 프리셋 기준 글. 현재 요청의 핸들에서 읽는다 — 콘솔 세션이면 dev_sandbox다. */
async function loadPresetPost(postId: string) {
  const [row] = await requestDatabase()
    .select({ endDate: posts.endDate, expiresAt: posts.expiresAt })
    .from(posts)
    .where(eq(posts.id, postId));
  if (!row) throw new AppError('NOT_FOUND', '게시글이 존재하지 않습니다.');
  return row;
}

async function targetTimeOf(
  input: { at?: string; preset?: ScenarioPreset; postId?: string },
  now: Date,
): Promise<Date> {
  if (input.at !== undefined) return new Date(input.at);

  const post = input.postId ? await loadPresetPost(input.postId) : undefined;
  try {
    return presetTime(input.preset!, { now, post });
  } catch (err) {
    if (err instanceof PresetContextError) throw new AppError('BAD_REQUEST', err.message);
    throw err;
  }
}

export async function POST(request: Request) {
  if (!isDevConsoleEnabled()) return notFound();

  try {
    if (!hasValidConsoleSession()) {
      throw new AppError('FORBIDDEN', '콘솔 세션이 필요합니다.');
    }

    const parsed = clockRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError('BAD_REQUEST', '입력이 올바르지 않습니다.');

    // 프리셋의 기준 시각은 **유효 시각**이다 — "다음 KST 자정"·"당월 15일"은 지금 보고 있는
    // 시각에서 나아가야 한다. 실제 시각을 기준으로 삼으면 이미 옮긴 시계가 되돌아간다.
    // 반면 오프셋 환산의 기준은 **실제 시각**이다 — 그래야 점프가 누적되지 않고 왕복한다.
    const target = await targetTimeOf(parsed.data, serverNow());
    const offsetMs = offsetForTarget(target, realNow());

    const response = NextResponse.json({ offsetMs, effectiveAt: target.toISOString() });
    // 서명하지 않는다 (research.md R5). 유효한 콘솔 세션이 있을 때만 반영되므로
    // 위조해서 얻을 것이 없다.
    response.cookies.set(CLOCK_COOKIE_NAME, String(offsetMs), {
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE() {
  if (!isDevConsoleEnabled()) return notFound();

  if (!hasValidConsoleSession()) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const response = NextResponse.json({ offsetMs: 0 });
  response.cookies.set(CLOCK_COOKIE_NAME, '', { sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
