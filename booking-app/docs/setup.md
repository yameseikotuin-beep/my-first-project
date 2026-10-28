# 初期セットアップ・公開手順

整骨院・整体院向け WEB 予約システム（`booking-app/`）を、無料プランの Supabase と Vercel で公開するまでの手順です。
上から順に進めてください。所要時間の目安は 30〜60 分です。

> この手順の中で、**あなた（店舗側）が行う必要がある作業**には ✋ を付けています。
> アカウント作成・認証情報の取得は、開発者（AI を含む）では代行できません。

---

## 0. 必要なもの

| もの | 用途 | 料金 |
| --- | --- | --- |
| GitHub アカウント | ソースコードの保管・Vercel との連携 | 無料 |
| Supabase アカウント | データベース・管理者ログイン | 無料プランで開始可 |
| Vercel アカウント | アプリの公開 | Hobby（無料）プランで開始可 |
| Node.js 20.9 以上 | 手元で動かす場合のみ | 無料 |

### 無料プランの主な制約（2026年10月時点の確認事項）

料金・制限は変更されることがあります。**開始前に必ず各社の料金ページで最新の内容を確認してください。**

- **Supabase Free**
  - 1週間ほどアクセスがないとプロジェクトが**一時停止**されます。停止中は予約画面がエラーになります（ダッシュボードから再開できます）。毎日予約が入る運用なら通常は問題ありませんが、心配な場合は有料プランを検討してください。
  - データベース容量・プロジェクト数に上限があります（予約データだけなら数年分でも余裕があります）。
  - 自動バックアップは有料プランの機能です。無料プランでは「8. バックアップ」の手順で定期的にデータを書き出してください。
- **Vercel Hobby**
  - **個人・非商用の利用**が前提の規約です。店舗の業務で使う場合は **Pro プラン**が必要になる可能性があります。規約（Fair Use / Terms）を確認してください。
  - 関数の実行時間・転送量に上限があります（この規模の予約システムでは通常問題になりません）。

---

## 1. Supabase のプロジェクトを作る ✋

1. <https://supabase.com/> にログインし、「New project」を選ぶ
2. 次のように設定する
   - **Name**：任意（例：`clinic-booking`）
   - **Database Password**：長く推測されにくいものを設定し、安全な場所に保管する
   - **Region**：`Northeast Asia (Tokyo)` を推奨
3. 作成が終わるまで数分待つ

## 2. データベースを作る ✋

Supabase の左メニュー **SQL Editor** を開き、次のファイルの中身を **ファイル名の順に** 1つずつ貼り付けて「Run」を押します。

1. `supabase/migrations/20261027000000_booking_core.sql`（テーブル・制約・RLS・予約処理の関数）
2. `supabase/migrations/20261027000100_initial_data.sql`（メニュー6件・施術スペース3件の初期データ）
3. `supabase/migrations/20261028000000_customer_email.sql`（予約時のメールアドレス入力欄）

「Success. No rows returned」と表示されれば成功です。
Supabase CLI を使っている場合は、`booking-app` フォルダで `npx supabase link` の後に `npx supabase db push` でも適用できます。

> `supabase/tests/` のファイルは手元のテスト専用です。Supabase では**実行しないでください**。

確認：左メニュー **Table Editor** に `bookings`・`services`・`rooms` などの表ができていること。

## 3. 認証（ログイン）の設定 ✋

管理画面のログインに Supabase Auth を使います。お客様はログイン不要です。

| 設定場所 | 設定 |
| --- | --- |
| Authentication → Sign In / Providers → **Email** | 有効（初期状態で有効） |
| Authentication → Sign In / Providers → **Allow new users to sign up** | **オフ**にする（管理者以外が勝手にアカウントを作れないように） |
| Authentication → Sign In / Providers → Email → パスワードの最低文字数 | 12 以上を推奨 |
| Authentication → URL Configuration → **Site URL** | 公開後のアプリの URL（例：`https://clinic-booking.vercel.app`）。公開前は `http://localhost:3000` のままでよい |

## 4. 管理者アカウントを作る ✋

1. Supabase の **Authentication → Users** で「Add user」→「Create new user」を選ぶ
2. 管理者のメールアドレスとパスワードを入力し、「Auto Confirm User」にチェックを入れて作成する
3. **SQL Editor** で次を実行する（メールアドレスは置き換える）

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'owner@example.com';
```

`INSERT 0 1` と表示されれば成功です。管理者を増やす場合は、同じ手順を繰り返します。

管理者を外す場合：

```sql
delete from public.admins
where user_id = (select id from auth.users where email = 'staff@example.com');
```

> `admins` に登録されていないアカウントは、ログインできても管理画面を使えません（サーバー側とデータベースの両方で確認しています）。

## 5. 接続情報を控える ✋

Supabase の **Project Settings → API**（または **Data API** / **API Keys**）で、次の2つを控えます。

| 控える値 | 画面での名前 | 環境変数名 |
| --- | --- | --- |
| Project URL | `https://xxxx.supabase.co` | `SUPABASE_URL` |
| 公開用キー | `anon` `public` キー（`eyJ…`）または Publishable key（`sb_publishable_…`） | `SUPABASE_ANON_KEY` |

> **`service_role` キー・Secret key は使いません。** どこにも設定しないでください。
> 公開用キーはブラウザに渡っても問題ない値です（データは RLS とデータベースの関数で保護しています）。

## 6. 手元で動かす（任意）

```bash
cd booking-app
cp .env.example .env.local   # SUPABASE_URL と SUPABASE_ANON_KEY を記入する
npm install
npm run dev                  # http://localhost:3000
```

- 予約画面：<http://localhost:3000/>
- 管理画面：<http://localhost:3000/admin>（4. で作ったアカウントでログイン）

## 7. Vercel で公開する ✋

1. このリポジトリを GitHub に置いた状態で、<https://vercel.com/> にログインし「Add New → Project」から取り込む
2. 設定画面で次のように指定する
   - **Root Directory**：`booking-app`（「Edit」から選ぶ）
   - **Framework Preset**：Next.js（自動で選ばれる）
   - **Environment Variables**：
     - `SUPABASE_URL` = 5. の Project URL
     - `SUPABASE_ANON_KEY` = 5. の公開用キー
3. 「Deploy」を押す。数分で `https://〇〇.vercel.app` が発行される
4. Supabase の **Authentication → URL Configuration → Site URL** を、発行された URL に変更する
5. 公開 URL で次を確認する
   - `/` で予約画面が開き、メニューが表示される
   - `/admin` でログイン画面が表示され、管理者アカウントでログインできる
   - 管理画面の「予約受付の設定」で店舗名・電話番号を設定する
   - テスト予約を1件入れて、管理画面に表示されることを確認し、キャンセルする

お客様には、公開 URL（例：`https://clinic-booking.vercel.app/`）を案内します。
独自ドメインを使う場合は Vercel の **Settings → Domains** で追加します。

### 公開後に必ず見直す設定

- [ ] 管理画面「予約受付の設定」：店舗名・電話番号・受付期間・締切・予約枠の間隔
- [ ] 管理画面「営業時間・休業日」：曜日ごとの営業時間・最終受付・昼休み・祝日
- [ ] 管理画面「メニュー」：初期データの**料金・施術時間は仮の値**です。必ず実際の値に変更する
- [ ] 管理画面「施術スペース」：実際のベッド・個室の数に合わせる
- [ ] 施術者で予約を管理する場合は「施術者」で有効にし、施術者・出勤時間を登録する
- [ ] Supabase の「Allow new users to sign up」がオフになっている

## 8. バックアップ

無料プランでは自動バックアップがないため、月に1回程度、データを書き出して保管してください。

- 簡単な方法：Supabase の **Table Editor** で `bookings` などを開き、「Export → CSV」
- まとめて保存する方法（Supabase CLI）：`npx supabase db dump --data-only -f backup.sql`

書き出したファイルにはお客様の氏名・電話番号・メールアドレスが含まれます。パスワード付きの場所に保管してください。

## 9. 更新（アプリを新しくする）

1. GitHub の `main` ブランチに変更が入ると、Vercel が自動で公開し直す
2. `supabase/migrations/` に新しいファイルが追加された場合は、**先に** Supabase の SQL Editor で実行してから公開する（まだ実行していないファイルだけを、ファイル名の順に実行する）
