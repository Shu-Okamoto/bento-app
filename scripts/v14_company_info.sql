-- =============================================
-- v14: 自社情報（請求書印刷の請求元として使用）
-- =============================================
-- 1行のみ保持する設計（id=1固定）。
-- 会社名・住所・適格請求書発行事業者登録番号・振込先口座情報。
-- =============================================

create table if not exists public.company_info (
  id smallint primary key default 1 check (id = 1),
  company_name text,
  address text,
  invoice_number text,
  bank_info text,
  updated_at timestamptz not null default now()
);

insert into public.company_info (id) values (1)
  on conflict (id) do nothing;

alter table public.company_info enable row level security;
