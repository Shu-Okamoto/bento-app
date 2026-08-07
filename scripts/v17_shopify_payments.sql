-- =============================================
-- v17: Shopify連携によるフリー会員のその場決済
-- =============================================
-- フリー会員がカート確定時にクレジットカードで即時決済できるようにする。
--
-- 決済フロー：
--   1. カート確定 → payment_sessions に pending で保存（注文はまだ作らない）
--   2. Shopifyの下書き注文（Draft Order）を作成し invoice_url へ誘導
--   3. 支払い完了 → Shopify Webhook（orders/paid）→ orders を作成し paid へ
--   4. 未払いのまま expires_at を過ぎたセッションは expired（ポイントは返却）
--
-- 「決済が完了してから注文を作る」設計なので、
-- 未決済のカートが注文一覧・印刷・請求に混ざることはない。
-- =============================================

-- ---------------------------------------------
-- 決済セッション
-- ---------------------------------------------
create table if not exists public.payment_sessions (
  token text primary key,
  member_id uuid references public.members(id) on delete set null,
  office_id uuid references public.offices(id) on delete set null,
  provider text not null default 'shopify',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'expired', 'cancelled')),

  -- 金額はすべて円（整数）。amount = subtotal - points_used が実際の請求額。
  subtotal integer not null default 0,
  points_used integer not null default 0,
  amount integer not null default 0,

  -- 決済確定時に注文を復元するためのカート内容のスナップショット
  -- [{ product_id, product_name, unit_price, quantity, options:[{name,price}], note, delivery_date }]
  items jsonb not null default '[]'::jsonb,

  shopify_draft_order_id text,
  shopify_order_id text,
  shopify_order_name text,
  invoice_url text,

  -- 注文作成に失敗した場合の記録（決済は成立しているため要手動対応）
  finalize_error text,
  order_count integer not null default 0,

  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  paid_at timestamptz
);

create index if not exists payment_sessions_member_idx
  on public.payment_sessions (member_id, created_at desc);
create index if not exists payment_sessions_status_idx
  on public.payment_sessions (status, expires_at);
create index if not exists payment_sessions_shopify_order_idx
  on public.payment_sessions (shopify_order_id);

alter table public.payment_sessions enable row level security;

-- ---------------------------------------------
-- 注文側の決済情報
-- ---------------------------------------------
-- payment_method（cash / credit）は v9 以前から存在。
-- ここでは「実際に入金されたか」を表す payment_status を追加する。
alter table public.orders
  add column if not exists payment_status text not null default 'unpaid';

alter table public.orders
  add column if not exists paid_at timestamptz;

alter table public.orders
  add column if not exists shopify_order_id text;

alter table public.orders
  add column if not exists payment_session_token text;

create index if not exists orders_payment_session_idx
  on public.orders (payment_session_token);

-- ---------------------------------------------
-- 決済設定（id=1 の1行のみで運用）
-- ---------------------------------------------
create table if not exists public.payment_settings (
  id smallint primary key default 1 check (id = 1),
  -- 管理画面のトグル。Shopifyの環境変数が未設定なら実際には無効のまま。
  credit_enabled boolean not null default false,
  -- フリー会員の最低注文金額（円）
  free_min_total integer not null default 3000,
  updated_at timestamptz not null default now()
);

insert into public.payment_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.payment_settings enable row level security;
