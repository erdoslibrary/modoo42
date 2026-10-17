import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// 테스트는 .env.local의 DATABASE_URL로 실제 Supabase에 붙는다 (CLAUDE.md §9).
config({ path: '.env.local' });

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/db.ts'],
    // 공용 DB 인스턴스이므로 테스트 파일 간 동시 실행을 끄고 순차로 돌린다.
    fileParallelism: false,
    // 원격 Supabase 왕복이 많은 통합 테스트(픽스처 생성 + 트랜잭션)는 기본 5초를 넘기기 쉽다.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});
