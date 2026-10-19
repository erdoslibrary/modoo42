// 샌드박스 비우기 · 스냅샷 · 표식 (FR-028, contracts/sandbox-isolation.md S2~S6).
//
// 복구 수단이 없는 유일한 동작이다. 파괴적 문장은 **항상 스키마를 수식**하고
// search_path에 의존하지 않으며, 실행 전에 대상 스키마 이름을 상수와 대조해 단정한다.
// 단정이 실패하면 SQL을 한 줄도 실행하지 않는다 (TC-DEV-06).
import { sql } from 'drizzle-orm';
import { DEV_SANDBOX_SCHEMA, SANDBOX_TTL_MS } from '@/lib/dev/sandbox';

/** execute()만 쓰므로 db·tx 양쪽을 받는다. 테스트는 호출 수를 세는 대역을 넘긴다. */
type Executor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

export type SnapshotRows = { users: number; posts: number; participants: number };
export type SandboxSession = { startedAt: Date; expiresAt: Date };

/**
 * 파괴적 실행 전 단정 (S6-1). 대상 스키마가 상수와 **정확히 같아야** 한다.
 * 상수가 식별자 형태이므로 이 검사를 통과한 값은 수식 문자열로 조립해도 안전하다.
 */
function assertSandboxSchema(schema: string): void {
  if (schema !== DEV_SANDBOX_SCHEMA) {
    throw new Error(`대상 스키마가 ${DEV_SANDBOX_SCHEMA}가 아니다: ${schema}. 실행을 중단한다.`);
  }
}

/** 파괴적 문장은 public을 건드리지 않는다 (S6-2). 읽기 전용 스냅샷 문장과 분리해 둔다. */
function assertNoPublicReference(statement: string): void {
  if (statement.includes('public.')) {
    throw new Error('파괴적 문장에 public. 수식이 들어 있다. 실행을 중단한다.');
  }
}

/**
 * S3 비우기. 순서는 participants → posts → users (posts.leader_id가 onDelete: 'restrict').
 * 한 문장으로 끝낸다 — 쪼개면 중간 실패 시 외래키 때문에 복구가 막힌다.
 */
export async function resetSandbox(db: Executor, schema: string): Promise<void> {
  assertSandboxSchema(schema);
  const statement = `TRUNCATE ${schema}.participants, ${schema}.posts, ${schema}.users`;
  assertNoPublicReference(statement);
  await db.execute(sql.raw(statement));
}

/**
 * S4 스냅샷 (public → dev_sandbox). 삽입 순서는 users → posts → participants다.
 * 컬럼을 전부 명시 열거하고 SELECT *를 쓰지 않는다 — public에 컬럼이 추가되면
 * 조용히 어긋나지 않고 큰 소리로 실패해야 한다.
 *
 * chat_url은 전건 NULL이 아니라 **플랫폼 보존 더미 값**으로 치환한다. chatPlatform이
 * 컬럼이 아니라 chat_url에서 파생되므로(deriveChatPlatform), 전건 NULL로 만들면 플랫폼
 * 배지가 사라지고 참여 확인 카피가 "오프라인 전용"으로 바뀐다 (S4 근거).
 */
export async function snapshotIntoSandbox(db: Executor, schema: string): Promise<SnapshotRows> {
  assertSandboxSchema(schema);

  await db.execute(
    sql.raw(`
      INSERT INTO ${schema}.users (
        id, github_id, login, intra_id, campus, intra_verified_at,
        completed_count, leader_count, created_at, updated_at
      )
      SELECT
        id, github_id, login, intra_id,
        campus::text::${schema}.campus_type, intra_verified_at,
        completed_count, leader_count, created_at, updated_at
      FROM public.users
    `),
  );

  await db.execute(
    sql.raw(`
      INSERT INTO ${schema}.posts (
        id, leader_id, type, template_id, template_data, title, tags, location_type,
        place, max_members, current_members, cycle, end_date, expires_at,
        chat_url, reference_url, description, status, cancel_reason,
        proof_type, proof_url, postmortem_text, created_at, updated_at
      )
      SELECT
        id, leader_id,
        type::text::${schema}.post_type,
        template_id, template_data, title, tags,
        location_type::text::${schema}.location_type,
        place, max_members, current_members, cycle, end_date, expires_at,
        CASE
          WHEN chat_url IS NULL THEN NULL
          WHEN chat_url LIKE 'https://open.kakao.com/%' THEN 'https://open.kakao.com/o/dev-sandbox'
          ELSE 'https://discord.gg/dev-sandbox'
        END,
        reference_url, description,
        status::text::${schema}.post_status,
        cancel_reason,
        proof_type, proof_url, postmortem_text, created_at, updated_at
      FROM public.posts
    `),
  );

  await db.execute(
    sql.raw(`
      INSERT INTO ${schema}.participants (id, post_id, user_id, status, joined_at)
      SELECT id, post_id, user_id, status::text::${schema}.participant_status, joined_at
      FROM public.participants
    `),
  );

  return countSandboxRows(db, schema);
}

/** 샌드박스 3테이블 행 수. 진입 응답의 snapshotRows다. */
export async function countSandboxRows(db: Executor, schema: string): Promise<SnapshotRows> {
  assertSandboxSchema(schema);
  const rows = (await db.execute(
    sql.raw(`
      SELECT (SELECT count(*)::int FROM ${schema}.users) AS users,
             (SELECT count(*)::int FROM ${schema}.posts) AS posts,
             (SELECT count(*)::int FROM ${schema}.participants) AS participants
    `),
  )) as unknown as { users: number; posts: number; participants: number }[];

  const row = rows[0];
  return {
    users: Number(row.users),
    posts: Number(row.posts),
    participants: Number(row.participants),
  };
}

/** 저장소의 마지막 마이그레이션 태그와 대조할 샌드박스 스키마 버전. 없으면 null이다. */
export async function readSandboxMeta(db: Executor, schema: string): Promise<string | null> {
  assertSandboxSchema(schema);
  const rows = (await db.execute(
    sql.raw(`SELECT journal_tag FROM ${schema}.sandbox_meta WHERE id = 1`),
  )) as unknown as { journal_tag: string }[];
  return rows[0]?.journal_tag ?? null;
}

/** 살아 있는 세션 표식. 없으면 null이다 (FR-019). */
export async function readSandboxSession(
  db: Executor,
  schema: string,
): Promise<SandboxSession | null> {
  assertSandboxSchema(schema);
  const rows = (await db.execute(
    sql.raw(`SELECT started_at, expires_at FROM ${schema}.sandbox_session WHERE id = 1`),
  )) as unknown as { started_at: string | Date; expires_at: string | Date }[];

  const row = rows[0];
  if (!row) return null;
  return { startedAt: new Date(row.started_at), expiresAt: new Date(row.expires_at) };
}

/**
 * 표식 갱신. 비교·기록에 쓰는 시각은 **실제 시각**이다 — 미래로 점프한 순간
 * 표식이 만료돼 자기 샌드박스를 지우는 것을 막는다 (research.md R9).
 */
export async function writeSandboxSession(
  db: Executor,
  schema: string,
  realNowValue: Date,
): Promise<SandboxSession> {
  assertSandboxSchema(schema);
  const startedAt = realNowValue;
  const expiresAt = new Date(realNowValue.getTime() + SANDBOX_TTL_MS);

  // raw execute 경로에 Date를 바인딩하면 postgres.js가 거부한다. ISO 문자열로 캐스트한다.
  const started = startedAt.toISOString();
  const expires = expiresAt.toISOString();
  await db.execute(
    sql.raw(`
      INSERT INTO ${schema}.sandbox_session (id, started_at, expires_at)
      VALUES (1, '${started}'::timestamptz, '${expires}'::timestamptz)
      ON CONFLICT (id) DO UPDATE
        SET started_at = '${started}'::timestamptz, expires_at = '${expires}'::timestamptz
    `),
  );

  return { startedAt, expiresAt };
}
