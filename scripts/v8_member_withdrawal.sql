-- =============================================
-- v8: 会員の論理削除（退会）対応
-- =============================================
-- members に withdrawn_at を追加
-- NULL: 在籍中
-- 値あり: 退会済み（退会日時）
alter table members add column if not exists withdrawn_at timestamptz null;

-- ログイン時の絞り込み高速化
create index if not exists idx_members_active
  on members(office_id, phone) where withdrawn_at is null;
