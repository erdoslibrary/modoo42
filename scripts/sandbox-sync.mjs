// dev_sandbox 스키마 재생 (FR-028, contracts/sandbox-isolation.md S1).
//
//   pnpm sandbox:sync
//
// public은 건드리지 않는다. 이 스크립트는 dev_sandbox를 DROP하고 drizzle/의 기존
// 마이그레이션 SQL을 그 스키마 아래에서 다시 실행한다. drizzle-kit은 이 스키마를 보지 않는다.
//
// tsx가 저장소에 없으므로 .mjs로 쓰고 이미 있는 의존성(postgres·dotenv)만 쓴다 (research.md R7).
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

// 대상 스키마 이름. src/lib/dev/sandbox.ts의 DEV_SANDBOX_SCHEMA와 같은 값이어야 한다.
const SCHEMA = 'dev_sandbox';

// 공개 컬럼 8개. drizzle/0003_revoke_anon_chat_url.sql과 **같은 목록**이다 (S5).
// 0003을 바꿀 때 이 목록도 같은 PR에서 고친다.
const PUBLIC_COLUMNS = [
  'id',
  'type',
  'max_members',
  'current_members',
  'expires_at',
  'status',
  'created_at',
  'updated_at',
];

const DRIZZLE_DIR = 'drizzle';

function assertTargetSchema(name) {
  if (name !== SCHEMA) {
    throw new Error(`대상 스키마가 ${SCHEMA}가 아니다: ${name}. 중단한다.`);
  }
}

/** 마이그레이션 SQL을 문장 단위로 나누고 스키마 수식을 dev_sandbox로 바꾼다. */
function statementsOf(sql) {
  return sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    // 열거형 생성과 외래키 참조가 "public"."…"로 수식돼 있다. 그대로 돌리면 public에
    // 손을 대거나 이미 있는 타입과 충돌한다. 수식을 대상 스키마로 바꾼다.
    .map((s) => s.replaceAll('"public".', `"${SCHEMA}".`));
}

async function journalTag() {
  const journal = JSON.parse(
    await readFile(path.join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'),
  );
  const entries = journal.entries ?? [];
  if (entries.length === 0) throw new Error('drizzle/meta/_journal.json에 엔트리가 없다.');
  return entries[entries.length - 1].tag;
}

async function migrationFiles() {
  const files = (await readdir(DRIZZLE_DIR)).filter((f) => f.endsWith('.sql'));
  // 파일명 앞 4자리 번호 순서로 돌린다.
  return files.sort();
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL이 설정되지 않았다. .env.local을 확인한다.');

  assertTargetSchema(SCHEMA);
  const tag = await journalTag();
  const files = await migrationFiles();

  console.log(`대상 스키마: ${SCHEMA} (public은 건드리지 않는다)`);
  console.log(`마이그레이션 ${files.length}건: ${files.join(', ')}`);
  console.log(`journal 태그: ${tag}`);

  const sql = postgres(connectionString, { max: 1 });
  try {
    // ① DROP → ② CREATE.
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    await sql.unsafe(`CREATE SCHEMA "${SCHEMA}"`);

    // search_path의 첫 항목이 dev_sandbox이므로 수식 없는 CREATE TABLE이 이 스키마에 들어간다.
    // public을 넣지 않는다 — 넣으면 dev_sandbox에 없는 테이블이 조용히 운영 테이블로 떨어진다.
    // extensions는 pgcrypto 등 확장 함수 조회용 폴백이다.
    await sql.unsafe(`SET search_path = "${SCHEMA}", "extensions"`);

    // ③ 마이그레이션 재생. 열거형 값 추가(0002 ①)는 같은 트랜잭션에서 쓸 수 없으므로
    //    문장마다 따로(autocommit) 실행한다.
    for (const file of files) {
      const raw = await readFile(path.join(DRIZZLE_DIR, file), 'utf8');
      for (const statement of statementsOf(raw)) {
        await sql.unsafe(statement);
      }
      console.log(`  적용: ${file}`);
    }

    // ④ 표식 테이블 2개 (data-model.md §3). drizzle 스키마에 없고 이 스키마에만 있다.
    await sql.unsafe(`
      CREATE TABLE "${SCHEMA}"."sandbox_session" (
        "id" integer PRIMARY KEY,
        "started_at" timestamp with time zone NOT NULL,
        "expires_at" timestamp with time zone NOT NULL
      )
    `);
    await sql.unsafe(`
      CREATE TABLE "${SCHEMA}"."sandbox_meta" (
        "id" integer PRIMARY KEY,
        "journal_tag" text NOT NULL,
        "synced_at" timestamp with time zone NOT NULL
      )
    `);

    // ⑤ 컬럼 단위 SELECT 권한 복제 (S5). publication 등록만으로는 chat_url이 막히지 않는다.
    await sql.unsafe(`REVOKE SELECT ON TABLE "${SCHEMA}"."posts" FROM "anon", "authenticated"`);
    await sql.unsafe(
      `GRANT SELECT (${PUBLIC_COLUMNS.map((c) => `"${c}"`).join(', ')}) ` +
        `ON TABLE "${SCHEMA}"."posts" TO "anon", "authenticated"`,
    );

    // ⑥ publication 등록. ADD TABLE은 중복 시 에러이므로 존재를 먼저 확인한다.
    const registered = await sql`
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = ${SCHEMA} AND tablename = 'posts'
    `;
    if (registered.length === 0) {
      await sql.unsafe(`ALTER PUBLICATION supabase_realtime ADD TABLE "${SCHEMA}"."posts"`);
      console.log('  publication 등록: supabase_realtime');
    } else {
      console.log('  publication 등록: 이미 등록돼 있어 건너뜀');
    }

    // ⑦ 스키마 버전 표식. 콘솔 진입이 이 값을 저장소의 마지막 태그와 대조한다.
    await sql`
      INSERT INTO ${sql(SCHEMA)}.sandbox_meta (id, journal_tag, synced_at)
      VALUES (1, ${tag}, now())
    `;

    console.log(`완료. ${SCHEMA} 재생됨 (태그 ${tag}).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
