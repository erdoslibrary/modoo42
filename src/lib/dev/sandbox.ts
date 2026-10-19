// 요청 핸들 선택 (FR-028, contracts/sandbox-isolation.md S7).
//
// 콘솔 세션 쿠키가 유효한 요청의 모든 읽기·쓰기는 dev_sandbox 스키마를 본다.
// 대상 스키마 이름 문자열은 이 파일의 상수 하나에만 둔다 — 두 번째로 적지 않는다.
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { db as publicDb, schema } from '@/db';
import { hasValidConsoleSession, isDevConsoleEnabled } from '@/lib/dev/console-session';
import type { Database } from '@/lib/posts';

export const DEV_SANDBOX_SCHEMA = 'dev_sandbox';

/** 표식 테이블 TTL (ms). 2창 실시간 검증과 시연 1회를 덮는다 (research.md R9). */
export const SANDBOX_TTL_MS = 2 * 60 * 60 * 1000;

// 샌드박스 전용 postgres 클라이언트. 모듈 수준에서 1개만 만든다 (연결 풀 중복 방지, S7).
// search_path만 다르고 테이블 정의는 같으므로 Drizzle 스키마를 그대로 재사용한다.
let sandboxDb: Database | null = null;

function sandboxDatabase(): Database {
  if (sandboxDb) return sandboxDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 설정되지 않았다. .env.local을 확인한다.');
  }
  // search_path에 public을 넣지 않는다 — 넣으면 dev_sandbox에 없는 테이블이 조용히
  // 운영 테이블로 떨어진다. extensions는 확장 함수 조회용 폴백이다.
  const client = postgres(connectionString, {
    connection: { search_path: `${DEV_SANDBOX_SCHEMA}, extensions` },
  });
  sandboxDb = drizzle(client, { schema });
  return sandboxDb;
}

/**
 * 현재 요청이 써야 할 DB 핸들.
 * - 게이트 닫힘 또는 콘솔 세션 무효 → public 핸들
 * - 콘솔 세션 유효 → dev_sandbox 핸들
 *
 * 쿠키 삭제가 운영 복귀 경로다. 별도 "복귀" 동작을 만들지 않는다.
 */
export function requestDatabase(): Database {
  if (!isDevConsoleEnabled()) return publicDb;
  if (!hasValidConsoleSession()) return publicDb;
  return sandboxDatabase();
}

/** 현재 요청의 실시간 구독 스키마. 피드 RSC가 클라이언트로 내려보낸다 (R11). */
export function requestSchemaName(): 'public' | typeof DEV_SANDBOX_SCHEMA {
  if (!isDevConsoleEnabled()) return 'public';
  if (!hasValidConsoleSession()) return 'public';
  return DEV_SANDBOX_SCHEMA;
}
