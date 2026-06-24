-- =============================================
-- v10: public スキーマ全テーブルの RLS 有効化
-- =============================================
-- Supabase Security Advisor の警告
--   "Table public.<name> is public, but RLS has not been enabled"
-- への対応。
--
-- 本アプリは全 DB アクセスをバックエンド (SUPABASE_SERVICE_KEY =
-- service_role) 経由で行っており、フロントから supabase-js で
-- 直接アクセスする箇所はない。service_role は RLS をバイパスする
-- ため、ポリシーを作成しない＝deny-all で問題ない。
--
-- これにより anon / authenticated ロール（PostgREST 経由）からの
-- 直接アクセスはすべて拒否される。
-- =============================================

do $$
declare
  t record;
begin
  for t in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end$$;
