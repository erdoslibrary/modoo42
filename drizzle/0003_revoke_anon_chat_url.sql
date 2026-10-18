-- Realtime 페이로드에서 chat_url을 막는다 (NFR-004, 헌법 V / CLAUDE.md §6.2).
--
-- 실측 결과(006 브랜치 T057/T064): Supabase Realtime의 postgres_changes는 복제 슬롯을
-- wal2json 플러그인으로 읽기 때문에 `supabase_realtime` publication의 컬럼 목록이
-- 페이로드를 걸러내지 못한다. anon 키로 구독한 브라우저에 posts의 모든 컬럼이 왔고
-- chat_url도 포함됐다. 실제 필터는 realtime.apply_rls가 보는 **컬럼 단위 SELECT 권한**이다.
--
-- PostgreSQL은 테이블 단위 SELECT가 있으면 컬럼 단위 REVOKE가 효과가 없으므로,
-- 테이블 권한을 걷어내고 공개해도 되는 컬럼만 다시 부여한다.
-- 부여 목록은 publication 컬럼 목록과 같은 8개다 — 피드 카드가 쓰는 값이 전부 여기 있다.
-- 서버(Route Handler·Drizzle)는 postgres 역할로 붙으므로 영향을 받지 않는다.

REVOKE SELECT ON TABLE "posts" FROM "anon", "authenticated";
--> statement-breakpoint
GRANT SELECT (
  "id",
  "type",
  "max_members",
  "current_members",
  "expires_at",
  "status",
  "created_at",
  "updated_at"
) ON TABLE "posts" TO "anon", "authenticated";
