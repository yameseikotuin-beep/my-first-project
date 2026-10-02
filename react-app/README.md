# ダイエットレシピメーカー

高タンパク・低脂質のダイエットレシピを、指定したカロリー・PFC・食材から自動で考えるアプリです。
栄養値はすべて食品成分データ（日本食品標準成分表）から計算し、条件を満たしているかを検証してから表示します。

React + TypeScript + Vite で作られたアプリです。基本機能はブラウザだけで動き（サーバー・APIキー不要）、
Supabase を設定すると、端末間の同期・AI（Claude）によるレシピ考案・料理写真風の画像生成（Gemini）が使えます。

## セットアップ

```bash
cd react-app
npm install
npm run dev      # http://localhost:5173
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 型チェックと本番ビルド（`dist/` に出力。相対パスなのでサブフォルダに置いても動く） |
| `npm test` | 単体テスト（vitest。栄養計算・生成・同期・AI応答の検証など） |
| `npm run test:e2e` | 画面操作のE2Eテスト（Playwright。先に `npm run build && npm run build:e2e-cloud`） |
| `npm run test:db` | Supabase のマイグレーションの検証（ローカルの PostgreSQL 16 以上。`PGURL` で接続先を指定） |
| `npm run export-foods` | 食品データを Edge Function 用の JSON に書き出す（食品データを更新したら実行） |
| `npm run lint` | oxlint |

## 機能

| 機能 | 画面 |
| --- | --- |
| カロリー・PFC指定でレシピ生成（食事区分・時間・ジャンル・難易度・人数・調理方法・使いたい／避けたい食材・アレルギー） | カロリーからレシピを考える |
| 食材指定でレシピ生成（使い切りたい食材、追加食材の許可／最小限／禁止、使える調味料の限定） | 食材からレシピを考える |
| PFC・食物繊維・食塩相当量の計算、PFCエネルギー比、目標との比較、検証結果 | レシピ詳細 |
| 自動調整（±100kcal、P+10g、F−5g、C−10g、低脂質、高タンパク、時短）・食材の置き換え・人数変更・手動編集 | レシピ詳細 |
| 保存・お気に入り・履歴・検索（料理名、食材、カロリー、P、F、調理時間） | レシピ |
| 1日の食事プラン（3〜5食、配分、外食、1／3／7日分、達成率と過不足） | 1日の食事プラン |
| 利用者ごとの目標設定（BMI・基礎代謝・推定消費量・減量カロリー・PFC、変更履歴） | 利用者・目標設定 |
| 買い物リスト（レシピ・食事プランから集計、在庫の差し引き、購入チェック、コピー、印刷） | 買い物リスト |
| 在庫管理と、期限の近い食材を使い切るレシピの提案 | 食材の在庫 |
| 食品成分データの閲覧、成分表にない食材の推定値登録 | 食材データベース |
| AIによる自由なレシピ考案（要ログイン） | カロリー／食材から → 「AIが自由に考案」 |
| 料理写真風の画像生成（要ログイン） | レシピ詳細 → 「画像を生成」 |
| ログイン・複数端末での同期 | アカウント・同期 |

## 仕組み

栄養値を推測で作らないよう、処理を分けています。

```
構成案（料理の型・食材・手順。栄養値なし）
  → 食品成分データとの照合（完全一致・登録済みの別名のみ。似た食品を勝手に同一視しない）
  → 分量の最適化（カロリー上限・PFC条件・現実的な分量の範囲）
  → 栄養計算（成分値 × 重量 ÷ 100g）
  → 条件の検証（上限・下限、全食材の計算、食品の状態、重量、手順）
  → 検証を通ったレシピだけを結果に表示
```

| ファイル | 役割 |
| --- | --- |
| `src/data/foods.ts` | 食品成分データ（食品番号・状態・出典・照合状態つき） |
| `src/data/templates.ts` | 料理の型（食材の組み合わせ・調味料・手順。栄養値は持たない） |
| `src/engine/nutrition.ts` | 栄養計算・PFC比率 |
| `src/engine/optimizer.ts` | 分量の最適化 |
| `src/engine/validate.ts` | 条件の検証 |
| `src/engine/feasibility.ts` | 実現できない条件の事前判定と調整案 |
| `src/engine/draft.ts` | 構成案（AI出力と同じJSON形式）→ 照合 → 計算 → 検証のパイプライン |
| `src/engine/generator.ts` | レシピ生成 |
| `src/engine/adjust.ts` | 自動調整・置き換え |
| `src/engine/profile.ts` | 個人別の栄養目標 |
| `src/engine/mealplan.ts` | 食事プラン |
| `src/engine/shopping.ts` | 買い物リスト・在庫 |
| `src/store/store.ts` | 保存データ（localStorage） |

## AIによるレシピ考案

AI（Claude）には料理の構成（使う食品・分量の目安・手順）だけを考えてもらい、栄養計算はアプリが行います。

1. アプリが条件と使える食品（避ける食材・アレルゲンを除いたもの）を Edge Function に送る
2. Edge Function が Claude（既定は `claude-opus-5-5`）に依頼する。食品は**食品成分データにある食品の番号だけ**を JSON Schema（enum）で許可し、栄養値は出力させない
3. Edge Function が応答の構造・分量・食品を検証する（不正なレシピは理由つきで除外）
4. アプリが、AIの分量を初期値として ±40〜50% の範囲で条件に合わせて調整し、成分表から計算・検証する
5. 条件を満たしたレシピだけを「AI考案」として表示する（満たせない案は理由と調整案つきで参考表示）

安全性フィルターで断られた場合は、サーバー側で別のモデルに切り替える設定（`fallbacks: "default"`）にしています。

## クラウド機能のセットアップ

クラウド機能を使わない場合、この節は不要です。

1. [Supabase](https://supabase.com/) でプロジェクトを作成する
2. Supabase CLI でプロジェクトに接続し、データベースを作る

   ```bash
   cd react-app
   npx supabase login
   npx supabase link --project-ref <プロジェクトID>
   npx supabase db push          # supabase/migrations の内容を反映
   ```

3. APIキーを Supabase のシークレットに登録する（**アプリ側の .env には書かない**）

   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # Claude（https://console.anthropic.com/）
   npx supabase secrets set GEMINI_API_KEY=...             # Gemini（https://aistudio.google.com/）
   # 任意: CLAUDE_MODEL, GEMINI_IMAGE_MODEL（既定 gemini-3.1-flash-image）,
   #       AI_RECIPE_DAILY_LIMIT（既定30）, AI_IMAGE_DAILY_LIMIT（既定20）, ALLOWED_ORIGIN（CORS。既定 *）
   ```

4. Edge Function をデプロイする

   ```bash
   npx supabase functions deploy generate-recipe
   npx supabase functions deploy generate-image
   ```

5. `.env.example` を `.env.local` にコピーし、Supabase の URL と anon キーを書いて、ビルドし直す
6. Supabase の Authentication で、メール認証のリダイレクト先にアプリのURLを登録する

| 構成 | 内容 |
| --- | --- |
| `supabase/migrations/` | 同期用テーブル（行レベルセキュリティで本人のみ読み書き）、送信関数（新しい更新だけ反映）、AI利用回数、画像用の非公開バケット |
| `supabase/functions/generate-recipe` | Claude によるレシピ考案（ログイン必須・1日の回数制限） |
| `supabase/functions/generate-image` | Gemini による画像生成と Storage への保存（ログイン必須・1日の回数制限） |
| `supabase/functions/_shared/` | 入力・出力の検証、プロンプト（単体テストあり） |
| `src/sync/` | 端末間同期（変更の検出・送信・取り込み。同じデータは後から更新した方を採用） |

AIの利用料金は、各サービス（Anthropic・Google）の料金体系に従って発生します。

## 食品成分データについて

- 出典は文部科学省「日本食品標準成分表2020年版（八訂）」です。
- 現在の値は、成分表から食品番号ごとに手入力したものです。開発環境から公式ファイルをダウンロードできなかったため、
  公式ファイルとの機械照合は済んでいません（画面上は「未照合」と表示）。
- 公式ファイルで照合するには、文部科学省のサイトから本表のExcelを入手してCSV（UTF-8）で保存し、次を実行します。

  ```bash
  node scripts/import-mext.mjs 本表.csv --dry-run   # 変更内容の確認
  node scripts/import-mext.mjs 本表.csv             # src/data/foods.ts を更新
  npm test
  ```

  食品番号で照合し、食品名が一致しない行は取り違え防止のため更新しません。

## データの保存とセキュリティ

- ログインしない場合、データはブラウザの localStorage にだけ保存され、外部に送信しません。
- ログインすると、データは Supabase に保存され、行レベルセキュリティで本人だけが読み書きできます。
- Claude・Gemini の APIキーは Edge Function の環境変数（Supabase のシークレット）にだけ置き、アプリには含めません。
  アプリに入る `VITE_SUPABASE_ANON_KEY` は公開前提の鍵です。
- AIの利用は1日あたりの回数で制限しています。入力値はアプリとサーバーの両方で範囲・形式を検証します。

## 未実装・今後の課題

- 実際の Supabase・Claude・Gemini への接続は、開発環境に認証情報がないため未確認です。
  通信部分はテストで模擬し、Edge Function は型検査（`deno check`）、データベースは PostgreSQL での検証まで行っています。
- 食事プランで脂質の目標を高く設定した場合（例: 1日2600kcal・脂質72g）、低脂質の料理が中心のため脂質が目標の80〜90%になることがあります（画面に不足量を表示します）。
- 食品成分データは公式ファイルとの機械照合が未完了です（上記「食品成分データについて」）。
