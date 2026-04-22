# 🍱 べんとうオーダーシステム

事業所向け弁当注文Webアプリ（PWA対応）

---

## 機能一覧

### 利用者（会員）
- 事業所専用URLから会員登録（名前・所属・電話・住所・パスワード）
- 商品選択・オプション選択・個数・お届け日指定で注文
- 締切チェック（前営業日15時）
- 注文履歴・配達状況の確認
- プロフィール編集
- PWA対応：ホーム画面にアイコン追加可能

### 管理者
- ダッシュボード（本日の注文数・売上・会員数）
- 注文管理（日付・事業所フィルタ・配達完了マーク）
- **注文票印刷**（事業所→所属→氏名順、チェックボックス付き）
- 商品管理（追加・編集・削除・オプション設定）
- 事業所管理（追加・URL発行・コピー）
- 会員管理（一覧・所属・連絡先）
- 請求管理（月次・事業所別・個人別・CSV出力）
- 休日設定（土日祝・臨時休業日）

---

## 技術スタック

| 役割 | 技術 | ホスティング |
|------|------|-------------|
| フロントエンド | React + Vite + PWA | Vercel（無料） |
| バックエンド | Node.js + Express | Render（無料プランあり） |
| データベース | PostgreSQL | Supabase（無料） |

---

## セットアップ手順

### 1. Supabase の設定

1. [supabase.com](https://supabase.com) でアカウント作成・プロジェクト作成
2. `Project Settings > API` から以下を控える
   - Project URL
   - service_role key（秘密鍵）
3. `SQL Editor` を開き、`scripts/supabase_schema.sql` の内容を貼り付けて実行

### 2. 管理者アカウントの作成

Node.js で以下を実行してパスワードハッシュを生成：

```js
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('yourpassword', 10));
```

Supabase の SQL Editor で実行：

```sql
insert into admins (email, password_hash)
values ('admin@example.com', '生成したハッシュ文字列');
```

### 3. バックエンドの設定

```bash
cd backend
cp .env.example .env
# .env を編集して Supabase の情報を入力
npm install
npm run dev   # 開発
npm start     # 本番
```

**.env の内容：**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
JWT_SECRET=ランダムな長い文字列
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### 4. フロントエンドの設定

```bash
cd frontend
cp .env.example .env
# .env を編集
npm install
npm run dev   # 開発
npm run build # 本番ビルド
```

**.env の内容：**
```
VITE_API_URL=http://localhost:3001   # 本番では Render の URL
```

---

## デプロイ手順

### Vercel（フロントエンド）

1. [vercel.com](https://vercel.com) でアカウント作成
2. GitHub にコードを push
3. Vercel で `frontend` フォルダをインポート
4. 環境変数 `VITE_API_URL` に Render の URL を設定

### Render（バックエンド）

1. [render.com](https://render.com) でアカウント作成
2. New > Web Service > `backend` フォルダを選択
3. Start Command: `npm start`
4. 環境変数を設定（.env の内容をすべて入力）

---

## 使い方

### 事業所への営業・URL発行

1. 管理画面 `/admin` にログイン
2. 「事業所管理」→「事業所を追加」
3. `slug`（例：`yamada-inc`）を設定すると専用URLが発行される
4. 発行URL例：`https://yourapp.vercel.app/o/yamada-inc/register`
5. このURLをQRコードやメールで事業所に共有

### 日々の運用フロー

```
会員が注文（前日15時まで）
    ↓
管理画面「注文票印刷」で配達日・事業所を選択
    ↓
ブラウザ印刷（事業所→所属→氏名順の表）
    ↓
印刷票を見ながら弁当を仕分け・配達
    ↓
「注文管理」で配達完了をチェック
    ↓
月末に「請求管理」でCSV出力・請求
```

---

## ファイル構成

```
bento-app/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── OrderPage.jsx       # 注文画面
│   │   │   ├── HistoryPage.jsx     # 注文履歴
│   │   │   ├── ProfilePage.jsx     # マイページ
│   │   │   ├── RegisterPage.jsx    # 会員登録
│   │   │   ├── LoginPage.jsx       # ログイン
│   │   │   └── admin/
│   │   │       ├── Dashboard.jsx   # 管理ダッシュボード
│   │   │       ├── Orders.jsx      # 注文管理
│   │   │       ├── PrintPage.jsx   # 注文票印刷 ★
│   │   │       ├── Offices.jsx     # 事業所管理
│   │   │       └── AdminPages.jsx  # 商品・会員・請求・設定
│   │   ├── components/
│   │   │   ├── MemberLayout.jsx    # 会員用レイアウト
│   │   │   └── AdminLayout.jsx     # 管理者用レイアウト
│   │   ├── context/AuthContext.jsx
│   │   └── utils/api.js
│   └── vite.config.js              # PWA設定含む
├── backend/
│   └── src/
│       ├── routes/                 # API エンドポイント
│       │   ├── auth.js
│       │   ├── offices.js
│       │   ├── products.js
│       │   ├── orders.js           # 締切ロジック含む
│       │   ├── members.js
│       │   ├── admin.js
│       │   └── holidays.js
│       ├── middleware/auth.js      # JWT認証
│       └── index.js
└── scripts/
    └── supabase_schema.sql        # DBスキーマ
```

---

## よくある質問

**Q: PWAとしてスマホに追加するには？**  
A: Chromeでアクセスし「ホーム画面に追加」をタップ。iPhoneはSafariで「共有→ホーム画面に追加」。

**Q: 事業所ごとにURLを変えられる？**  
A: はい。`/o/事業所スラグ/register` という形で各社に固有URLを発行できます。

**Q: 費用は？**  
A: 小規模利用なら Supabase・Vercel・Render の無料枠で運用可能（月0円）。

---

## ライセンス
MIT
