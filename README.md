# 里の味みかわ 弁当注文アプリ

事業所向け弁当注文PWA。React + Node.js + Supabaseで構築。

---

## 本番環境

| 役割 | URL |
|------|-----|
| フロントエンド（Vercel） | https://order.satonoaji-mikawa.net |
| フロントエンド（Vercel直） | https://bento-app-eta.vercel.app |
| バックエンド（Render） | https://bento-app-qt5c.onrender.com |
| データベース | Supabase（PostgreSQL） |
| ドメイン管理 | ムームードメイン |

---

## 技術スタック

### フロントエンド
- React + Vite + PWA（vite-plugin-pwa）
- React Router v6
- CSS-in-JS（インラインスタイル）

### バックエンド
- Node.js + Express
- JWT認証
- Nodemailer（Gmail SMTP）
- LINE Messaging API

### インフラ
- Vercel（フロントエンド）
- Render（バックエンド・無料プラン）
- Supabase（PostgreSQL）

---

## ディレクトリ構造

```
bento-app/
├── frontend/
│   ├── public/
│   │   ├── logo.JPG
│   │   ├── favicon.ico
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── apple-touch-icon.png
│   ├── src/
│   │   ├── App.jsx                    # ルーティング
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── context/
│   │   │   ├── AuthContext.jsx        # JWT認証状態管理
│   │   │   └── OfficeContext.jsx      # 事業所情報（サブドメイン対応）
│   │   ├── components/
│   │   │   ├── MemberLayout.jsx       # 会員画面レイアウト
│   │   │   ├── AdminLayout.jsx        # 管理画面レイアウト（PC/SP対応）
│   │   │   └── Toast.jsx              # トースト通知
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx          # 事業所会員ログイン
│   │   │   ├── RegisterPage.jsx       # 事業所会員登録
│   │   │   ├── FreeLoginPage.jsx      # フリー会員ログイン
│   │   │   ├── FreeRegisterPage.jsx   # フリー会員登録
│   │   │   ├── AdminLoginPage.jsx     # 管理者ログイン
│   │   │   ├── OrderPage.jsx          # 注文画面
│   │   │   ├── HistoryPage.jsx        # 注文履歴
│   │   │   ├── ProfilePage.jsx        # マイページ
│   │   │   └── admin/
│   │   │       ├── index.js           # エクスポート集約
│   │   │       ├── Dashboard.jsx      # ダッシュボード
│   │   │       ├── Orders.jsx         # 注文管理
│   │   │       ├── PrintPage.jsx      # 注文票印刷（A4横）
│   │   │       ├── BillingPrintPage.jsx # 請求書印刷（A4縦）
│   │   │       ├── Offices.jsx        # 事業所管理
│   │   │       └── AdminPages.jsx     # 商品・会員・請求・設定管理
│   │   └── utils/
│   │       ├── api.js                 # API通信（JWT自動付与）
│   │       └── date.js                # 日付ユーティリティ（タイムゾーン対応）
│   ├── index.html
│   ├── vite.config.js                 # PWA設定含む
│   └── vercel.json                    # SPAルーティング設定
│
├── backend/
│   ├── src/
│   │   ├── index.js                   # Expressサーバー・CORS設定
│   │   ├── routes/
│   │   │   ├── auth.js                # ログイン・登録
│   │   │   ├── orders.js              # 注文CRUD・締切チェック
│   │   │   ├── products.js            # 商品管理
│   │   │   ├── offices.js             # 事業所管理
│   │   │   ├── members.js             # 会員管理
│   │   │   ├── admin.js               # 管理者
│   │   │   ├── holidays.js            # 休日設定
│   │   │   └── line.js                # LINE Webhook・通知設定
│   │   ├── middleware/
│   │   │   ├── auth.js                # JWT検証ミドルウェア
│   │   │   └── office.js             # サブドメインからofficeSlug取得
│   │   └── utils/
│   │       ├── supabase.js            # Supabaseクライアント
│   │       └── notify.js             # メール・LINE通知
│   └── package.json
│
└── scripts/
    ├── supabase_schema.sql            # 初期スキーマ
    ├── add_features.sql               # フリー会員・提供曜日
    ├── v6_add_features.sql            # 表示対象・備考欄
    └── enable_rls.sql                 # RLS設定
```

---

## データベーススキーマ

```sql
admins(id, email, password_hash)
offices(id, name, slug, short_name, address, phone, contact_name, email, billing_type)
members(id, office_id, name, department, phone, address, password_hash, member_type)
products(id, name, price, image_url, is_active, sort_order, available_days, show_for_office, show_for_free)
product_options(id, product_id, name, price)
orders(id, member_id, office_id, product_id, quantity, delivery_date, total_price, is_delivered, delivered_at, note)
order_options(id, order_id, name, price)
holidays(id, closed_sat, closed_sun, closed_hol, extra_dates)
notification_settings(id, email_enabled, email_address, line_enabled, line_user_id)
```

**注意：** 全テーブルでRLS無効。バックエンドはservice_roleキーを使用。

---

## 環境変数（Render）

```
SUPABASE_URL              Supabase プロジェクトURL
SUPABASE_SERVICE_KEY      Supabase service_roleキー
JWT_SECRET                JWT署名シークレット
PORT                      3001
FRONTEND_URL              https://order.satonoaji-mikawa.net
LINE_CHANNEL_SECRET       LINE Messaging API チャンネルシークレット
LINE_CHANNEL_TOKEN        LINE Messaging API アクセストークン
GMAIL_USER                Gmailアドレス
GMAIL_APP_PASSWORD        Gmailアプリパスワード（16文字・スペースなし）
```

---

## URL設計

### 会員向け
```
/o/:slug/register    事業所会員登録
/o/:slug/login       事業所会員ログイン
/o/:slug/home        注文画面（PWA start_url）
/o/:slug/history     注文履歴
/o/:slug/profile     マイページ

/free/register       フリー会員登録
/free/login          フリー会員ログイン
/free/home           フリー会員注文画面
/free/history        フリー会員注文履歴
/free/profile        フリー会員マイページ
```

### 管理者向け
```
/admin/login         管理者ログイン
/admin               ダッシュボード
/admin/orders        注文管理
/admin/print         注文票印刷（A4横）
/admin/billing-print 請求書印刷（A4縦・事業所別）
/admin/products      商品管理
/admin/members       会員管理
/admin/offices       事業所管理
/admin/billing       請求管理
/admin/settings      設定（休日・通知）
```

---

## 主な機能

### 会員機能
- 事業所別マルチテナント（slug方式）
- フリー会員（合計3,000円以上から注文可能）
- 注文（商品・オプション・個数・配達日・備考）
- 注文編集・キャンセル（締切前のみ）
- 締切：前営業日15:00 JST

### 商品管理
- 提供曜日設定（例：火・金のみ）
- 表示対象設定（事業所会員向け／フリー会員向け）
- オプション設定（例：大盛り +50円）

### 管理機能
- 注文管理・配達完了マーク
- 注文票印刷（A4横・事業所別・所属順）
- 請求書印刷（A4縦・会員別集計＋明細）
- 月次集計・CSV出力
- 休日設定（土日祝・臨時休業）

### 通知
- Gmail SMTP（複数アドレス・カンマ区切り対応）
- LINE Messaging API（友だち追加で自動設定）

### PWA
- ホーム画面追加対応
- iPhoneはSafariから追加（必須）
- Cookie + localStorage でログイン状態を永続化（iOS ITP対策）
- 事業所ごとのURLが起点：`/o/:slug/home`

---

## 重要な実装メモ

### タイムゾーン
RenderサーバーはUTC。日付計算は全て`Date.UTC()`を使用。
締切（JST 15:00）= UTC 06:00として処理。

### iOS Safari対応
- inputのフォントサイズ16px以上（ズーム防止）
- `type="text" inputMode="tel"`（ハイフン入力可能）
- `env(safe-area-inset-bottom)`（ホームバー対応）

### 管理者パスワード認証
bcryptjsが不安定なためSupabaseの`check_admin_password`関数（pgcrypto使用）で認証。

```sql
create extension if not exists pgcrypto;
create or replace function check_admin_password(input_email text, input_password text)
returns boolean ...
```

### CORS
現在`origin: true`（全許可）。運用安定後に特定ドメインに絞ること。

---

## デプロイ手順

### フロントエンド（Vercel）
1. GitHubにpush
2. Vercelが自動デプロイ
3. カスタムドメイン：`order.satonoaji-mikawa.net`（ムームーDNSでCNAME設定済み）

### バックエンド（Render）
1. GitHubにpush
2. Renderが自動デプロイ（または手動：Manual Deploy）
3. 無料プランは15分スリープあり（有料化推奨）

---

## 運用フロー

```
1. 管理画面で事業所登録（slug・short_name設定）
2. QRコード付き案内チラシを作成・配布
   URL: https://order.satonoaji-mikawa.net/o/:slug/register
3. 会員がQRコードから登録
4. ログイン後にホーム画面追加（iPhoneはSafariから）
5. 翌日以降、アイコンタップで注文
6. 管理画面で注文確認・印刷・配達完了マーク
7. 月末に請求書印刷・CSV出力
```

---

## 初期管理者アカウント
```
メール: admin@example.com
パスワード: admin1234
```
※本番運用前に必ず変更すること

---

## 今後の課題

- Renderの有料化（事業所が増えたらスリープ解消のため）
- CORSを特定ドメインのみに絞る
- ワイルドカードサブドメイン（`*.order.satonoaji-mikawa.net`）の完全対応
- 管理者パスワード変更機能の追加
