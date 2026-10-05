# AI肌分析・美容管理アプリ（skin-app）

一般ユーザーのセルフ肌分析、サロンスタッフの肌分析・カウンセリング、管理者の顧客・施術管理を1つにまとめた Web アプリ（PWA）です。

> **現在の状況：第3段階（肌の見た目の分析）まで実装済み。** 項目ごとの評価はモック（未検証）です。
> 完成した機能・未確認の項目は [docs/stage2-report.md](docs/stage2-report.md)、[docs/stage3-report.md](docs/stage3-report.md) を参照してください。

本アプリは、美容目的で**画像上の見た目の特徴**を評価・記録し、カウンセリングを補助するためのものです。皮膚疾患の診断や治療の判断は行いません。

## 設計書

| 文書 | 内容 |
| --- | --- |
| [01-requirements.md](docs/01-requirements.md) | 要件定義、権限の一覧、開発段階、**要確認事項** |
| [02-screens.md](docs/02-screens.md) | デザインの方針、画面一覧、画面の流れ |
| [03-architecture.md](docs/03-architecture.md) | システム構成、技術スタック、画像解析モジュール、Claude API 連携 |
| [04-database.md](docs/04-database.md) | テーブル設計、RLS、写真の保存場所、削除の仕組み |
| [05-security.md](docs/05-security.md) | 同意、認証・認可、データ保護、AI出力の安全対策、監査ログ、退会手順 |
| [setup.md](docs/setup.md) | 導入手順（Supabase の設定、環境変数、起動、確認用コマンド） |
| [stage2-report.md](docs/stage2-report.md) | 第2段階の実装報告（完成・仮の値・未確認の項目） |
| [stage3-report.md](docs/stage3-report.md) | 第3段階の実装報告（分析・AI 連携・モックの範囲） |

## 開発段階と進み具合

| 段階 | 内容 | 状況 |
| --- | --- | --- |
| 1 | 要件・画面・構成・DB・セキュリティ設計 | ✅ 承認済み |
| 2 | 認証、権限、基本画面、顧客台帳、撮影・アップロード | ✅ 実装済み（実際の Supabase・スマホで動作確認済み） |
| 3 | 画像解析の仕組み（モック）、Claude 連携、分析レポート | ✅ 実装済み（Claude API との実際の通信は未確認） |
| 4 | セルフ管理、カウンセリング、施術履歴、前後比較、PDF | 未着手 |
| 5 | テスト、脆弱性確認、権限確認、実機確認、導入手順書 | 未着手 |

## 使い方（開発）

```bash
cd skin-app
cp .env.example .env.local   # Supabase の値を記入
npm install
npm run dev
```

詳しくは [docs/setup.md](docs/setup.md) を参照してください。

## フォルダ構成

```
skin-app/
├─ docs/                 設計書・導入手順・実装報告
├─ supabase/migrations/  データベースの定義（テーブル・RLS・関数）
├─ supabase/tests/       RLS のテスト
├─ scripts/              補助スクリプト（MediaPipe のファイルの用意、RLS のテスト）
├─ src/app/              画面（me=一般ユーザー、staff=スタッフ、admin=管理者）
├─ src/features/         機能ごとの部品と処理（撮影、同意、顧客、写真、管理）
├─ src/lib/              Supabase 接続、権限、入力検証、監査ログ
└─ tests/unit/           単体テスト
```
