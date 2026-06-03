-- =============================================
-- v9: ポイント機能 + フリー会員ルール
-- =============================================

-- 会員のポイント残高
alter table members add column if not exists points integer default 0 not null;

-- 注文ごとの獲得・使用ポイント
alter table orders add column if not exists points_earned integer default 0 not null;
alter table orders add column if not exists points_used   integer default 0 not null;

-- ポイント設定（id=1 の1行のみで運用）
create table if not exists point_settings (
  id integer primary key default 1,
  rate_normal integer default 1 not null,    -- 通常レート（%）
  rate_campaign integer default 3 not null,  -- キャンペーン時レート（%）
  campaign_active boolean default false not null,
  updated_at timestamptz default now()
);

insert into point_settings (id) values (1)
on conflict (id) do nothing;
