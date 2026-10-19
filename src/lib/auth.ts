// getCurrentUser() 세션 추상화 (CLAUDE.md §6.1).
// Phase 4: modoo42_session 서명 쿠키가 1순위다. 콘솔 게이트가 열린 환경에서만 쿠키가
// 없을 때 modoo42_mock_user 페르소나로 떨어진다 (trd.md §2.1-3, FR-027).
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { users } from '@/db/schema';
import { realNow } from '@/lib/clock';
import { hasValidConsoleSession, isDevConsoleEnabled } from '@/lib/dev/console-session';
import { requestDatabase } from '@/lib/dev/sandbox';
// 페르소나 정의는 personas.ts 한 곳에 있다 (FR-016). guest는 비로그인이라 목록에 없다.
import { PERSONAS } from '@/lib/personas';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export const MOCK_COOKIE_NAME = 'modoo42_mock_user';

type User = typeof users.$inferSelect;

export { PERSONAS };

/**
 * 페르소나 전환이 열리는 조건. 게이트는 NODE_ENV가 아니라 개발자 콘솔 하나다 —
 * 게이트를 둘로 두지 않는다 (2026-10-19 사용자 결정, FR-027).
 * 비밀번호로 콘솔에 들어온 세션만 페르소나를 바꿀 수 있다.
 */
export function isPersonaSwitchEnabled(): boolean {
  return isDevConsoleEnabled() && hasValidConsoleSession();
}

/** 유효한 Mock 페르소나 키인지 (route 입력 검증과 공유). guest 포함. */
export function isValidPersona(value: unknown): value is string {
  return value === 'guest' || (typeof value === 'string' && value in PERSONAS);
}

type DbLike = Pick<typeof defaultDb, 'insert' | 'select'>;

/**
 * 페르소나 문자열을 users 레코드로 해석한다. 핵심 로직이라 테스트에서 tx를 주입한다.
 * - 유효 페르소나: 고정 github_id로 Upsert 후 유저 반환 (멱등).
 * - guest / 없음 / 손상 / 미지값: null (비로그인), 예외 없음.
 *
 * 충돌 기준은 github_id다 — login은 유저가 변경할 수 있어 매칭 키로 쓰지 않는다 (trd.md §2.2).
 */
export async function resolvePersonaUser(
  persona: string | null | undefined,
  db: DbLike,
): Promise<User | null> {
  if (!persona || !(persona in PERSONAS)) return null;
  const { githubId, login, campus } = PERSONAS[persona];

  await db
    .insert(users)
    .values({ githubId, login, campus })
    .onConflictDoNothing({ target: users.githubId });

  const [user] = await db.select().from(users).where(eq(users.githubId, githubId));
  return user ?? null;
}

type TxLike = Pick<typeof defaultDb, 'insert' | 'select' | 'update'>;

/**
 * GitHub 프로필을 users에 Upsert한다. 충돌 기준은 github_id다 (trd.md §2.2-4).
 *
 * login은 UNIQUE인데 GitHub에서 바뀔 수 있다. 다른 github_id 행이 같은 login을 쥐고 있으면
 * (이전 주인이 핸들을 바꾼 뒤 재로그인하지 않은 경우) 그 행을 stale:<github_id>로 먼저
 * 비켜준 뒤 Upsert한다. 호출부가 트랜잭션으로 감싸 두 쓰기를 원자적으로 처리한다.
 */
export async function upsertGithubUser(
  githubId: string,
  login: string,
  tx: TxLike,
): Promise<User> {
  const [owner] = await tx.select().from(users).where(eq(users.login, login));
  if (owner && owner.githubId !== githubId) {
    await tx
      .update(users)
      .set({ login: `stale:${owner.githubId}`, updatedAt: realNow() })
      .where(eq(users.id, owner.id));
  }

  await tx
    .insert(users)
    .values({ githubId, login })
    .onConflictDoUpdate({ target: users.githubId, set: { login, updatedAt: realNow() } });

  const [user] = await tx.select().from(users).where(eq(users.githubId, githubId));
  if (!user) throw new Error('users Upsert 후 레코드를 찾지 못했습니다.');
  return user;
}

/** upsertGithubUser를 단일 트랜잭션으로 실행한다. */
export async function syncGithubUser(githubId: string, login: string): Promise<User> {
  return defaultDb.transaction((tx) => upsertGithubUser(githubId, login, tx));
}

/** 서명 세션 쿠키를 해석한다. 서명·만료가 깨졌거나 유저가 없으면 null이다. */
async function resolveSessionUser(token: string | undefined, db: DbLike): Promise<User | null> {
  if (!token) return null;
  let userId: string | null = null;
  try {
    // 세션 만료는 개발 시계를 따르지 않는다 — 미래로 점프해도 로그아웃되지 않는다 (FR-006).
    userId = verifySessionToken(token, realNow());
  } catch {
    // GITHUB_CLIENT_SECRET 미설정 등 서명 키 문제는 비로그인으로 떨어뜨린다.
    return null;
  }
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}

/**
 * 현재 세션 유저. modoo42_session 서명 쿠키를 먼저 해석하고, 없을 때만 콘솔 세션의
 * modoo42_mock_user 페르소나로 떨어진다. 콘솔 게이트가 닫히면 Mock 경로를 타지 않는다.
 *
 * 유저 조회도 요청 핸들을 쓴다 — public 핸들로 읽으면 콘솔 세션에서 posts.leader_id
 * 외래키가 샌드박스 안에서 풀리지 않는다 (contracts/sandbox-isolation.md S7).
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = cookies();
  const database = requestDatabase();

  const sessionUser = await resolveSessionUser(jar.get(SESSION_COOKIE_NAME)?.value, database);
  if (sessionUser) return sessionUser;

  if (!isPersonaSwitchEnabled()) return null;
  return resolvePersonaUser(jar.get(MOCK_COOKIE_NAME)?.value, database);
}

/** 패널 인증 섹션이 표시하는 세션 해석 소스 (FR-027, data-model.md §5). */
export type SessionSource = 'session' | 'persona' | 'anonymous';

/**
 * 쿠키 조합에서 해석 소스를 파생한다. getCurrentUser()의 우선순위를 **바꾸지 않고**
 * 표시만 추가한다. 저장하지 않고 요청마다 파생한다.
 */
export function sessionSourceOf(cookiesIn: {
  session?: string;
  persona?: string;
}): SessionSource {
  if (cookiesIn.session) {
    let userId: string | null = null;
    try {
      userId = verifySessionToken(cookiesIn.session, realNow());
    } catch {
      userId = null;
    }
    if (userId) return 'session';
  }
  if (cookiesIn.persona && cookiesIn.persona in PERSONAS) return 'persona';
  return 'anonymous';
}
