-- =============================================
-- べんとうオーダーシステム - Supabase スキーマ
-- Supabase の SQL Editor に貼り付けて実行してください
-- =============================================

-- 管理者テーブル
create table admins (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 事業所テーブル
create table offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  address text,
  phone text,
  contact_name text,
  email text,
  billing_type text default 'bulk', -- 'bulk'=一括 / 'individual'=個人
  created_at timestamptz default now()
);

-- 会員テーブル
create table members (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references offices(id) on delete cascade,
  name text not null,
  department text,
  phone text not null,
  address text,
  password_hash text not null,
  created_at timestamptz default now()
);

-- 商品テーブル
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null,
  image_url text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- 商品オプションテーブル
create table product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  name text not null,
  price integer not null default 0
);

-- 注文テーブル
create table orders (
  id uuid primary key default gen_random_uuid(),
  office_id uuid references offices(id),
  member_id uuid references members(id),
  product_id uuid references products(id),
  quantity integer not null default 1,
  delivery_date date not null,
  total_price integer not null,
  is_delivered boolean default false,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- 注文オプション（選択済みオプションの記録）
create table order_options (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  name text not null,
  price integer not null default 0
);

-- 休日設定テーブル（1行のみ使用）
create table holidays (
  id uuid primary key default gen_random_uuid(),
  closed_sat boolean default true,
  closed_sun boolean default true,
  closed_hol boolean default true,
  extra_dates date[] default '{}'
);

-- 初期休日設定を挿入
insert into holidays (closed_sat, closed_sun, closed_hol) values (true, true, true);

-- =============================================
-- 管理者アカウントの初期作成
-- ※ password は別途 bcrypt でハッシュ化して入れてください
-- 例（Node.js）: require('bcryptjs').hashSync('yourpassword', 10)
-- =============================================
-- insert into admins (email, password_hash) values ('admin@example.com', '$2a$10$...');

-- =============================================
-- サンプルデータ（テスト用）
-- =============================================
insert into products (name, price, is_active, sort_order) values
  ('幕の内弁当', 650, true, 1),
  ('唐揚げ弁当', 600, true, 2),
  ('焼き魚弁当', 700, true, 3),
  ('ヘルシー野菜弁当', 580, true, 4);

-- 幕の内弁当のオプション（product_idは上記のIDに置き換え）
-- insert into product_options (product_id, name, price) values
--   ('...uuid...', 'ごはん大盛', 50),
--   ('...uuid...', 'みそ汁追加', 80);
