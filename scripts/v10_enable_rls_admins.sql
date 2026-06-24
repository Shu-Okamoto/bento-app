-- =============================================
-- v10: admins テーブルの RLS 有効化
-- =============================================
-- Supabase Security Advisor の警告
--   "Table public.admins is public, but RLS has not been enabled"
-- への対応。
--
-- バックエンドは SUPABASE_SERVICE_KEY（service_role）で接続しており
-- RLS をバイパスするため、ポリシーを作成しない＝deny-all で問題ない。
-- これにより anon / authenticated からの PostgREST 直接アクセスは
-- すべて拒否される。
-- =============================================

alter table public.admins enable row level security;
