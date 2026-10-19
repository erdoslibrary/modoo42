// 개발자 콘솔 진입·종료 (FR-028, contracts/dev-console-api.md C2·C3).
//
// 게이트가 닫히면 모든 메서드가 404다 — 라우트 존재 자체를 숨긴다. 판정은 핸들러
// 첫 줄에서 하고 미들웨어로 중복 차단을 만들지 않는다 (research.md R3).
import { NextResponse } from 'next/server';
import { realNow } from '@/lib/clock';
import {
  CLOCK_COOKIE_NAME,
  CONSOLE_COOKIE_NAME,
  consolePassword,
  createConsoleToken,
  isConsolePassword,
  isDevConsoleEnabled,
} from '@/lib/dev/console-session';
import { repoJournalTag } from '@/lib/dev/journal';
import { DEV_SANDBOX_SCHEMA } from '@/lib/dev/sandbox';
import {
  countSandboxRows,
  readSandboxMeta,
  readSandboxSession,
  resetSandbox,
  snapshotIntoSandbox,
  writeSandboxSession,
} from '@/lib/dev/snapshot';
import { db } from '@/db';

export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

/** 콘솔 쿠키 공통 옵션. Secure는 프로덕션 스코프에서만 붙인다 (로컬 http 개발 때문). */
function consoleCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function POST(request: Request) {
  // 1. 게이트.
  if (!isDevConsoleEnabled()) return notFound();

  let password: unknown;
  try {
    password = (await request.json())?.password;
  } catch {
    password = undefined;
  }

  // 2. 비밀번호 검증 (상수 시간).
  if (typeof password !== 'string' || !isConsolePassword(password)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 3. 스키마 버전 대조. 스키마가 없을 때도 같은 응답이다 — 자동 DDL을 실행하지 않는다.
  const expectedTag = repoJournalTag();
  let actualTag: string | null = null;
  try {
    actualTag = await readSandboxMeta(db, DEV_SANDBOX_SCHEMA);
  } catch {
    actualTag = null;
  }
  if (actualTag !== expectedTag) {
    return NextResponse.json(
      { error: 'SANDBOX_STALE', hint: 'pnpm sandbox:sync' },
      { status: 409 },
    );
  }

  // 4. 표식 판정. 살아 있으면 비우기·스냅샷을 건너뛰고 합류한다 (FR-019).
  //    비교에 realNow()를 쓴다 — 미래로 점프한 순간 자기 샌드박스를 지우지 않기 위함이다.
  const now = realNow();
  const existing = await readSandboxSession(db, DEV_SANDBOX_SCHEMA);
  const joined = existing !== null && existing.expiresAt.getTime() > now.getTime();

  const snapshotRows = joined
    ? await countSandboxRows(db, DEV_SANDBOX_SCHEMA)
    : await db.transaction(async (tx) => {
        // 비우기 + 스냅샷 + 표식은 단일 트랜잭션이다 — 중간 실패 시 빈 샌드박스가 남지 않는다.
        await resetSandbox(tx, DEV_SANDBOX_SCHEMA);
        const rows = await snapshotIntoSandbox(tx, DEV_SANDBOX_SCHEMA);
        await writeSandboxSession(tx, DEV_SANDBOX_SCHEMA, now);
        return rows;
      });

  // 5. 서명 쿠키 발급. 서명 키는 비밀번호 자체라 비밀번호가 바뀌면 자동 무효다 (R4).
  const response = NextResponse.json({ joined, snapshotRows });
  response.cookies.set(
    CONSOLE_COOKIE_NAME,
    createConsoleToken(now, consolePassword()!),
    consoleCookieOptions(60 * 60 * 24),
  );
  return response;
}

export async function DELETE() {
  if (!isDevConsoleEnabled()) return notFound();

  // 샌드박스 데이터는 지우지 않는다 — 정리 보장은 진입 쪽에 있다 (FR-015).
  // 시계 쿠키를 함께 지운다. 콘솔을 나가면 실제 시각으로 돌아와야 한다.
  const response = NextResponse.json({ ended: true });
  response.cookies.set(CONSOLE_COOKIE_NAME, '', consoleCookieOptions(0));
  response.cookies.set(CLOCK_COOKIE_NAME, '', { sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}
