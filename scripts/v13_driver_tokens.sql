-- =============================================
-- v13: ドライバー画面のトークン管理
-- =============================================
-- 配達員に渡すURL（/driver/:token）の鍵となるランダム文字列。
-- 1つのdriver_numberに対して複数のトークンを発行可能。
-- 個別に削除（再発行）すれば旧URLは即無効化される。
-- =============================================

create table if not exists public.driver_tokens (
  token text primary key,
  driver_number smallint not null check (driver_number between 1 and 3),
  label text,
  created_at timestamptz not null default now()
);

create index if not exists driver_tokens_driver_number_idx
  on public.driver_tokens (driver_number);

alter table public.driver_tokens enable row level security;
