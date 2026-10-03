# 導入手順（開発・検証環境）

> 第2段階時点の手順です。本番公開前の最終的な手順書は第5段階で作成します。

## 1. 必要なもの

- Node.js 20.9 以上（開発では 22 を使用）
- Supabase のプロジェクト（無料プランで可。リージョンは東京 `ap-northeast-1` を推奨）
- RLS のテストを手元で動かす場合：PostgreSQL 15 以上のコマンド（`initdb`、`pg_ctl`、`psql`）

## 2. Supabase の設定

### 2.1 データベース

Supabase の **SQL Editor** で、次のファイルを **ファイル名の順に** 実行します。

1. `supabase/migrations/20261003000000_stage2_core.sql`（テーブル・RLS・関数・写真の保存場所）
2. `supabase/migrations/20261003000100_consent_documents_v1.sql`（同意文 v1。**雛形**）

Supabase CLI を使っている場合は `supabase db push` でも適用できます。

> `supabase/tests/00_supabase_stub.sql` は手元のテスト専用です。Supabase では実行しないでください。

### 2.2 認証（Authentication）

| 設定場所 | 設定 |
| --- | --- |
| Authentication → Sign In / Providers → Email | メール認証を有効、「Confirm email」を有効 |
| Authentication → Sign In / Providers → Email | パスワードの最低文字数を 10 以上に。漏えい済みパスワードの検査を使えるプランなら有効に |
| Authentication → URL Configuration → Site URL | アプリの URL（例：`https://example.vercel.app`） |
| Authentication → URL Configuration → Redirect URLs | `https://example.vercel.app/auth/confirm`（開発時は `http://localhost:3000/auth/confirm` も追加） |

#### メールのテンプレート

スタッフの招待とパスワード再設定はサーバー側で確認するため、Authentication → Emails のテンプレートのリンクを次のように変更してください（本文は日本語に書き換えてください）。

| テンプレート | リンク |
| --- | --- |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Reset Password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |

招待とパスワード再設定のリンクを開くと、パスワードの設定画面（`/update-password`）に移動します。

### 2.3 最初の管理者

1. アプリの「新規登録」から管理者になる人のアカウントを作り、メールの確認を済ませる
2. Supabase の SQL Editor で次を実行する（メールアドレスは置き換える）

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@example.com');
```

3. 2人目以降のスタッフ・管理者は、アプリの「管理メニュー → スタッフ・権限」から招待する

> 管理者・スタッフの業務アカウントは、セルフ撮影（一般ユーザー向けの機能）を使えません。個人として使う場合は別のアカウントを作ってください。

## 3. アプリの起動

```bash
cd skin-app
cp .env.example .env.local   # 値を記入する
npm install
npm run dev                  # http://localhost:3000
```

`npm run dev` と `npm run build` の前に `scripts/prepare-assets.mjs` が自動で実行され、端末内の顔検出に使う MediaPipe のファイル（WASM とモデル、約 40MB）を `public/mediapipe/` に用意します。モデルのダウンロードに失敗した場合も起動はでき、顔の向き・距離の自動確認だけが無効になります。

### 環境変数

| 変数 | 必須 | 内容 |
| --- | --- | --- |
| `SUPABASE_URL` | ○ | Supabase の Project URL（例：`https://xxxx.supabase.co`） |
| `SUPABASE_ANON_KEY` | ○ | Supabase の公開用キー（`eyJ…` の anon key または `sb_publishable_…`）。ブラウザに渡してよい値 |
| `SITE_URL` | 独自ドメインのときだけ | アプリの URL（認証メールのリンク先）。Vercel では本番の URL が自動で使われるため通常は不要。サーバー専用 |
| `SUPABASE_SERVICE_ROLE_KEY` | スタッフ招待に必要 | **サーバーだけ**に設定する。`NEXT_PUBLIC_` を付けない |

Supabase の値が未設定の場合、ログインが必要な画面は「初期設定が必要です」の画面に移動します。

## 4. 確認用のコマンド

```bash
npm run lint        # ESLint
npm run typecheck   # 型チェック
npm test            # 単体テスト（Vitest）
npm run test:rls    # RLS のテスト（手元の PostgreSQL を一時的に起動して実行）
npm run build       # 本番ビルド
```

## 5. Vercel への配置（例）

1. Vercel でリポジトリを読み込み、**Root Directory** を `skin-app` にする
2. 環境変数（§3）を設定する。名前に `NEXT_PUBLIC_` を付けると Vercel が保存を止めることがあるため、付けない名前（`SUPABASE_URL` など）で登録する。値を変更したあとは「Redeploy」（公開し直し）で反映する。`SUPABASE_SERVICE_ROLE_KEY` は Production / Preview のサーバー用にだけ設定する
3. デプロイ後、Supabase の Site URL と Redirect URLs をデプロイ先の URL に合わせる

カメラはブラウザの仕様により HTTPS（または `localhost`）でしか使えません。スマートフォンの実機で試す場合は、Vercel のプレビュー環境など HTTPS の URL を使ってください。
