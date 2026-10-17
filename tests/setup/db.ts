// 테스트 DB 하네스 (CLAUDE.md §9). 공용 Supabase 인스턴스에 붙으므로 TRUNCATE/DROP 하지
// 않는다. 각 테스트는 트랜잭션으로 감싸 롤백해 격리한다.
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { beforeAll, afterAll } from 'vitest';
import * as schema from '@/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL이 설정되지 않았다. .env.local을 확인한다.');
}

// 테스트 전용 클라이언트. max 1로 커넥션을 고정해 롤백 격리를 단순화한다.
export const testClient = postgres(connectionString, { max: 1 });
export const testDb = drizzle(testClient, { schema });

type TxDb = Parameters<Parameters<typeof testDb.transaction>[0]>[0];

/**
 * 테스트 바디를 트랜잭션 안에서 실행하고, 끝나면 무조건 롤백한다.
 * 성공/실패와 무관하게 DB에 아무 흔적도 남기지 않는다.
 */
export async function withRollback(fn: (tx: TxDb) => Promise<void>): Promise<void> {
  const ROLLBACK = Symbol('rollback');
  try {
    await testDb.transaction(async (tx) => {
      await fn(tx);
      throw ROLLBACK; // 커밋 대신 롤백을 강제한다.
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

beforeAll(async () => {
  // 접속 확인 (붙지 못하면 여기서 바로 실패시킨다).
  await testClient`select 1`;
});

afterAll(async () => {
  await testClient.end({ timeout: 5 });
});
