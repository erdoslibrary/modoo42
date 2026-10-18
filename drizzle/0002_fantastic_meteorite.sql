-- 유저 식별 스키마 전환 (FR-016). specs/005-user-identity-schema/data-model.md §4 순서.
-- 기존 행이 있는 테이블에 NOT NULL 컬럼을 더하므로 "추가 → 백필 → 제약" 3단으로 나눈다.
-- drizzle-kit 생성물의 ADD COLUMN ... NOT NULL을 그대로 쓰면 다음 오류로 실패한다:
--   column "github_id" of relation "users" contains null values

-- ① 열거형 값 추가. 이 마이그레이션 안에서 이 값을 쓰지 않는다 (같은 트랜잭션에서 사용하면
--    unsafe use of new value of enum type으로 거부된다).
ALTER TYPE "public"."location_type" ADD VALUE 'OFFLINE_ETC' BEFORE 'HYBRID';--> statement-breakpoint

-- ② 식별 컬럼을 제약 없이 추가한다.
ALTER TABLE "users" ADD COLUMN "github_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "intra_verified_at" timestamp with time zone;--> statement-breakpoint

-- ③ 기존 행 백필. 전환 전 유저는 Mock 페르소나뿐이며 intra_id가 유일하므로 파생값도 유일하다.
--    'mock:' 접두사는 실제 GitHub 숫자 식별자와 형태가 겹치지 않는다 (research R3).
UPDATE "users" SET "github_id" = 'mock:' || "intra_id", "login" = "intra_id" WHERE "github_id" IS NULL;--> statement-breakpoint

-- ④ 필수·유일 제약 적용.
ALTER TABLE "users" ALTER COLUMN "github_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "login" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_github_id_unique" UNIQUE("github_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_unique" UNIQUE("login");--> statement-breakpoint

-- ⑤ 42 추가 인증 컬럼의 기존 제약 완화 (§1.3 착수 전까지 null이 정상이다).
ALTER TABLE "users" ALTER COLUMN "intra_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "campus" DROP NOT NULL;
