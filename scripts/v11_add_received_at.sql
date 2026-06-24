-- =============================================
-- v11: orders に受領日時を追加
-- =============================================
-- 配達済になった注文に対して、注文者本人が「受領」を
-- 確認した日時を記録する。

alter table public.orders
  add column if not exists received_at timestamptz;
