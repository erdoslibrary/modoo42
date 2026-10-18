// getCurrentUser() 세션 추상화 (CLAUDE.md §6.1).
// Phase 0~3: 개발 환경 Mock 인증. modoo42_mock_user 쿠키의 페르소나를 users 레코드로 매핑.
// Phase 4: GitHub OAuth로 대체.
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/db';
import { users } from '@/db/schema';

export const MOCK_COOKIE_NAME = 'modoo42_mock_user';

type Campus = (typeof users.$inferSelect)['campus'];
type User = typeof users.$inferSelect;

// 페르소나 → 고정 유저 정의 (data-model.md seed). guest는 비로그인이라 목록에 없다.
export const PERSONAS: Record<string, { intraId: string; campus: Campus }> = {
  gs_leader: { intraId: 'gs_leader', campus: 'GS' },
  gs_member: { intraId: 'gs_member', campus: 'GS' },
  seoul_member: { intraId: 'seoul_member', campus: 'SEOUL' },
};

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
 * - 유효 페르소나: 고정 intra_id로 Upsert 후 유저 반환 (멱등).
 * - guest / 없음 / 손상 / 미지값: null (비로그인), 예외 없음.
 */
export async function resolvePersonaUser(
  persona: string | null | undefined,
  db: DbLike = defaultDb,
): Promise<User | null> {
  if (!persona || !(persona in PERSONAS)) return null;
  const { intraId, campus } = PERSONAS[persona];

  await db
    .insert(users)
    .values({ intraId, campus })
    .onConflictDoNothing({ target: users.intraId });

  const [user] = await db.select().from(users).where(eq(users.intraId, intraId));
  return user ?? null;
}

/**
 * 현재 세션 유저. 개발 환경에서 modoo42_mock_user 쿠키를 읽어 해석한다.
 * 비개발 환경에서는 Mock 경로를 타지 않는다 (Phase 4 OAuth 세션으로 대체).
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isMockAuthEnabled()) return null;
  const persona = cookies().get(MOCK_COOKIE_NAME)?.value;
  return resolvePersonaUser(persona);
}
