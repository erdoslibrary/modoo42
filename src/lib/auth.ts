// getCurrentUser() 세션 추상화 (CLAUDE.md §6.1).
// Phase 4: modoo42_session 서명 쿠키가 1순위다. 개발 환경에서는 쿠키가 없을 때만
// modoo42_mock_user 페르소나로 떨어진다 (trd.md §2.1-3).
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { users } from '@/db/schema';
// 페르소나 정의는 personas.ts 한 곳에 있다 (FR-016). guest는 비로그인이라 목록에 없다.
import { PERSONAS } from '@/lib/personas';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/session';

export const MOCK_COOKIE_NAME = 'modoo42_mock_user';

type User = typeof users.$inferSelect;

export { PERSONAS };

export function isMockAuthEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
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
  db: DbLike = defaultDb,
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
      .set({ login: `stale:${owner.githubId}`, updatedAt: new Date() })
      .where(eq(users.id, owner.id));
  }

  await tx
    .insert(users)
    .values({ githubId, login })
    .onConflictDoUpdate({ target: users.githubId, set: { login, updatedAt: new Date() } });

  const [user] = await tx.select().from(users).where(eq(users.githubId, githubId));
  if (!user) throw new Error('users Upsert 후 레코드를 찾지 못했습니다.');
  return user;
}

/** upsertGithubUser를 단일 트랜잭션으로 실행한다. */
export async function syncGithubUser(githubId: string, login: string): Promise<User> {
  return defaultDb.transaction((tx) => upsertGithubUser(githubId, login, tx));
}

/** 서명 세션 쿠키를 해석한다. 서명·만료가 깨졌거나 유저가 없으면 null이다. */
async function resolveSessionUser(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  let userId: string | null = null;
  try {
    userId = verifySessionToken(token);
  } catch {
    // GITHUB_CLIENT_SECRET 미설정 등 서명 키 문제는 비로그인으로 떨어뜨린다.
    return null;
  }
  if (!userId) return null;

  const [user] = await defaultDb.select().from(users).where(eq(users.id, userId));
  return user ?? null;
}

/**
 * 현재 세션 유저. modoo42_session 서명 쿠키를 먼저 해석하고, 없을 때만 개발 환경의
 * modoo42_mock_user 페르소나로 떨어진다. 상용에서는 Mock 경로를 타지 않는다.
 */
export async function getCurrentUser(): Promise<User | null> {
  const jar = cookies();

  const sessionUser = await resolveSessionUser(jar.get(SESSION_COOKIE_NAME)?.value);
  if (sessionUser) return sessionUser;

  if (!isMockAuthEnabled()) return null;
  return resolvePersonaUser(jar.get(MOCK_COOKIE_NAME)?.value);
}
