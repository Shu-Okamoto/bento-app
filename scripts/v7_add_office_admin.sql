-- =============================================
-- v7: 事業所担当者ロール追加
-- =============================================
-- 1. 事業所担当者フラグを members に追加
alter table members add column if not exists is_office_admin boolean default false;

-- 担当者の高速検索用インデックス（部分インデックスで小さく保つ）
create index if not exists idx_members_office_admin
  on members(office_id) where is_office_admin = true;

-- 2. 代理注文の監査列
-- 担当者が会員代わりに作成・キャンセルした注文を追跡
-- 注意：外部キー制約は付けない。
--   理由1: orders.member_id と同じ members を参照するため、PostgREST の
--          自動JOIN（`members(...)`）が曖昧になり既存ルートが壊れる
--   理由2: 担当者が退会してもキャンセル監査記録は保持したい
alter table orders add column if not exists proxied_by_member_id uuid;
