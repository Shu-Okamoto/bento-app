-- =============================================
-- v16: 管理者によるスーパー代理注文の監査ログ
-- =============================================
-- 既存の proxied_by_member_id は members を参照するため、
-- 管理者（admins テーブル）による代理注文には対応できない。
-- 管理者代理注文用に proxied_by_admin_id と proxy_reason を追加。
-- =============================================

alter table public.orders
  add column if not exists proxied_by_admin_id uuid references public.admins(id) on delete set null;

alter table public.orders
  add column if not exists proxy_reason text;
