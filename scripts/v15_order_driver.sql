-- =============================================
-- v15: 注文単位のドライバー指定（フリー会員向け）
-- =============================================
-- フリー会員の注文は事業所が一律「フリー」のため、事業所単位の
-- ドライバー指定では対応できない。注文単位で手動指定できるよう
-- orders に driver_number カラムを追加する。
--
-- 事業所会員の注文は driver_number = null のままで、従来通り
-- offices.driver_number によるドライバー振り分けを使用する。
-- =============================================

alter table public.orders
  add column if not exists driver_number smallint;

alter table public.orders
  drop constraint if exists orders_driver_number_range;
alter table public.orders
  add constraint orders_driver_number_range
  check (driver_number is null or driver_number between 1 and 3);
