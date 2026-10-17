import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// 마이그레이션 CLI는 Next.js 런타임 밖에서 돌므로 .env.local을 직접 로드한다.
config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
