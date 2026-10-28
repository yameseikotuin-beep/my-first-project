# 整骨院・整体院向け WEB 予約システム

お客様がスマートフォン・パソコンからメニュー・日付・空き時間を選んで予約でき、
店舗は管理画面で予約・営業時間・休業日・メニュー・施術スペース・施術者を管理できる、自院専用の予約システムです。

- 技術：Next.js 16（App Router）・TypeScript・Tailwind CSS／Supabase（PostgreSQL・Auth）／Vercel
- 無料プランから始められる構成です（制約は `docs/setup.md` を参照）

## 画面

| URL | 内容 |
| --- | --- |
| `/` | 予約：①メニュー選択 |
| `/book/[メニュー]` | ②日付選択・③空き時間 |
| `/book/[メニュー]/confirm?start=…` | ④お客様情報の入力・⑤確認・⑥確定 |
| `/book/complete` | ⑦予約完了（予約番号） |
| `/admin/login` | 管理者ログイン |
| `/admin` | ダッシュボード（本日の件数・一覧・直近の予約） |
| `/admin/bookings` | 予約一覧（期間・ステータス・名前/電話で絞り込み） |
| `/admin/bookings/new` | 予約の手動登録（電話・来店） |
| `/admin/bookings/[id]` | 予約の詳細・変更・キャンセル・ステータス変更 |
| `/admin/calendar` | 予約カレンダー（日別＝スペースごと／週別） |
| `/admin/services` | メニュー管理 |
| `/admin/rooms` | 施術スペース管理（利用停止・利用可能時間） |
| `/admin/practitioners` | 施術者管理（有効/無効・対応メニュー・出勤時間・休み） |
| `/admin/hours` | 曜日ごとの営業時間・最終受付・受付停止時間・祝日/臨時休業/特定日の営業時間 |
| `/admin/settings` | 店舗名・電話番号・予約枠の間隔・受付期間・締切・電話番号ごとの予約上限 |

## 予約の重複防止の仕組み

1. 空き時間の表示も予約確定も、同じデータベース関数（`_available_slots` / `_find_resources`）で判定する
2. 予約確定（`create_booking` / `admin_save_booking`）では、その日の予約処理をロック（`pg_advisory_xact_lock`）してから最新の状態で再確認し、条件を満たすスペース・施術者を割り当てて保存する
3. 最終防衛線として、データベースの排他制約（`EXCLUDE USING gist`）で「同じスペース」「同じ施術者」の確定済み予約の時間帯が重ならないことを保証する（キャンセル済みは対象外）
4. 割り当てができない場合は予約を確定しない

## セキュリティ

- 未ログイン（お客様）はテーブルを一切読み書きできない。メニュー・空き時間・予約登録は、必要な情報だけを返す関数経由のみ
- 管理者は `public.admins` に登録された利用者のみ。RLS・管理用関数・各画面・各サーバー処理のすべてで確認
- 予約の登録・変更は管理者でも直接テーブルに書けず、重複確認を行う関数経由のみ
- Supabase の秘密鍵（service_role）は使わない。必須の環境変数は公開用の URL・キーの2つだけ
- 予約のお知らせメール（任意）：WEB予約の確定時に、お客様へ予約完了メール、院へ新しい予約の通知を Gmail から送る。Gmail のアプリパスワードはサーバー側の環境変数だけに置く。送信に失敗しても予約は確定する
- 入力値はブラウザ・サーバー・データベースの3か所で検証。見えない入力欄と電話番号ごとの予約上限でいたずら予約を抑止
- エラー画面に内部情報を表示しない。CSP（nonce）・各種セキュリティヘッダーを設定
- 集める個人情報は氏名・電話番号・メールアドレス（WEB予約では必須、電話予約では任意）・備考（任意）のみ

## フォルダ構成

```
supabase/migrations/   データベース構築用 SQL（Supabase の SQL Editor で順に実行）
supabase/tests/        データベースのテスト（手元専用）
src/app/(public)/      お客様向け予約画面
src/app/admin/         管理画面
src/features/          画面の部品とサーバー処理
src/lib/               時刻（日本時間）・入力検証・Supabase 接続など
scripts/               テスト用スクリプト（scripts/e2e/fake-supabase.mjs はテスト専用）
tests/                 単体テスト・画面の自動テスト
docs/                  手順書・マニュアル・テスト結果
```

## ドキュメント

- [初期セットアップ・Supabase の設定・管理者アカウントの作成・Vercel への公開](docs/setup.md)
- [運用マニュアル](docs/operations.md)
- [テスト結果](docs/test-report.md)
- 環境変数の例：[.env.example](.env.example)

## 開発

```bash
npm install
cp .env.example .env.local   # 値を記入
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run test:db              # PostgreSQL のコマンドが必要
npm run build && npm run test:e2e
```

## 初期開発で実装していないもの

次は実装していません：LINE 通知、予約の変更・キャンセル時のメール、オンライン決済、お客様による担当者指定、お客様自身による WEB 上での予約変更・キャンセル（店舗へ電話連絡し、管理画面で操作する運用）。
