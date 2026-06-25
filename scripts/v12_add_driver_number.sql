-- =============================================
-- v12: offices にドライバー割り当てを追加
-- =============================================
-- 各事業所をドライバー1〜3に割り振り、ドライバー画面（公開URL
-- /driver/1, /driver/2, /driver/3）で本日の未配達のみを表示する
-- ために使用する。未割り当ての事業所はどのドライバー画面にも出ない。

alter table public.offices
  add column if not exists driver_number smallint;

alter table public.offices
  drop constraint if exists offices_driver_number_range;
alter table public.offices
  add constraint offices_driver_number_range
  check (driver_number is null or driver_number between 1 and 3);
