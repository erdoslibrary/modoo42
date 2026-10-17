import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL이 설정되지 않았다. .env.local을 확인한다.');
}

// 단일 postgres 클라이언트. Phase 1 참여 트랜잭션이 db.transaction() + .for('update')로 쓴다 (trd.md §4.1).
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
export { schema };
