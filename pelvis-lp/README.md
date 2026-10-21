# 骨盤矯正LP（骨盤起こし整体）

Meta広告からの新規集客用の LP です。アンケート（セルフチェック）→ 回答結果 → ブログ記事 → サービス紹介・初回オファー → 既存の予約ページ、の順に進みます。既存の Web サイトやこのリポジトリの他のアプリとは独立しています。

- 初回オファー：**1,980円（税込）**（通常価格・割引率は確認できるまで掲載しない）
- データベースなし・AI なし。アンケートの回答はブラウザのタブ内（sessionStorage）だけで使い、サーバーにも URL にも出さない
- スマートフォン優先、PC 対応

## 技術構成

Next.js 16（App Router）/ React 19 / TypeScript / Tailwind CSS v4。すべてのページが静的に生成されるため、Vercel などにそのまま公開できます。テストは Vitest（単体）と Playwright（画面）。

## ページ構成

| URL | 内容 |
| --- | --- |
| `/pelvis/` | ファーストビュー（問いかけ・セルフチェックの説明・開始ボタン・ロゴ表示領域） |
| `/pelvis/check/` | アンケート（5問・1画面1問・進捗表示・必須チェック・戻るで回答保持） |
| `/pelvis/result/` | 回答結果（主要テーマ・選択した悩みの一覧・関連記事の案内） |
| `/pelvis/article/` | ブログ記事型LP（導入文は回答で切替、本文は共通）＋サービス紹介・初回料金・店舗情報・よくある質問・予約ボタン |
| `/pelvis/reserve/` | 予約導線（初回料金と予約ボタン。広告から直接リンクしてもよい） |
| `/pelvis/reserve/complete/` | 予約完了ページ（予約システムから戻せる場合のみ使用。初期設定では計測しない） |

`/` は `/pelvis/` へ移動します。

## 起動・ビルド

```bash
cd pelvis-lp
npm install
npm run dev        # 開発サーバー http://localhost:3000/pelvis/
npm run build      # 本番ビルド
npm start          # 本番ビルドの起動
npm run lint       # ESLint
npm run typecheck  # 型チェック
npm test           # 単体テスト（Vitest）
npm run test:e2e   # 画面の自動テスト（Playwright。2種類の本番ビルドを作ってから実行）
```

開発サーバー（`npm run dev`）では、未設定の項目に「【開発環境のみ表示】〜が未設定です」という案内が出ます。本番ビルドでは表示されません。

## 設定

設定は **`src/config/lp.config.ts`** にまとめています（コード本体からは分離）。空欄の項目は「未設定」として扱い、本番ページには表示しません。

| 項目 | 設定場所 | 初期値 |
| --- | --- | --- |
| 予約URL | `reservationUrl` または環境変数 `NEXT_PUBLIC_RESERVATION_URL` | 未設定 |
| 店舗名・住所・営業時間・地図URL | `store.*` | 未設定 |
| 初回価格 | `service.firstPriceYen` | 1980（税込） |
| 施術時間 | `service.duration` | 未設定 |
| ロゴ画像 | `logo` | 未設定（店舗名またはサービス名を文字で表示） |
| 各ページの画像 | `images.hero` / `images.article` / `images.service` | 未設定 |
| GA4 測定ID | `analytics.ga4Id` または `NEXT_PUBLIC_GA4_ID` | 未設定 |
| Meta Pixel ID | `analytics.metaPixelId` または `NEXT_PUBLIC_META_PIXEL_ID` | 未設定 |
| 個人情報保護方針URL | `privacyPolicyUrl` | 未設定 |
| 予約完了の計測 | `reservationCompleteTracking` | `false` |

文章は `src/content/` にあります。

- `survey.ts`：アンケートの質問と選択肢
- `themes.ts`：結果テーマ（説明文・記事の導入文・優先順位）
- `article.ts`：記事本文（全テーマ共通）
- `service.ts`：サービスの説明・**実際の施術内容（未設定）**・来店から施術までの流れ（来店後の手順は未設定）・よくある質問

### 予約URLの設定方法

1. 既存の予約ページの URL（`https://` で始まるもの）を用意する
2. 次のどちらかで設定する
   - Vercel の「Settings → Environment Variables」に `NEXT_PUBLIC_RESERVATION_URL` を登録する（おすすめ）
   - `src/config/lp.config.ts` の `reservationUrl: process.env.NEXT_PUBLIC_RESERVATION_URL || ''` の `''` を URL に書き換える
3. 再ビルド（再デプロイ）する。`NEXT_PUBLIC_` の値はビルド時に埋め込まれるため、変更後は必ず再ビルドが必要

未設定または `https://` 以外の URL の場合、予約ボタンは「オンライン予約は準備中です」と表示され、どこにも遷移しません（画面下の固定ボタンは非表示）。

予約ボタンは「記事中」「サービス紹介（初回料金の下）」「記事末尾」「画面下の固定ボタン」「/pelvis/reserve/」にあります。

### GA4 と Meta Pixel の設定方法

1. GA4 の測定ID（`G-` で始まる）と Meta Pixel ID（数字）を用意する
2. 環境変数 `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_META_PIXEL_ID`（または `lp.config.ts` の `analytics`）に設定する
3. 再ビルド（再デプロイ）する

ID が空、または形式が正しくない場合はスクリプト自体を読み込みません。

送信するイベント：

| 操作 | GA4 イベント名 | Meta Pixel |
| --- | --- | --- |
| LP閲覧（`/pelvis/` 表示） | `lp_view` | `trackCustom: LpView`（ほかに読み込み時の `PageView`） |
| アンケート開始（`/pelvis/check/` 表示） | `survey_start` | `trackCustom: SurveyStart` |
| アンケート完了（「結果を見る」） | `survey_complete` | `trackCustom: SurveyComplete` |
| 結果画面表示 | `result_view` | `trackCustom: ResultView` |
| 記事表示 | `article_view` | `trackCustom: ArticleView` |
| オファー表示（初回料金が画面に入った時） | `offer_view` | `trackCustom: OfferView` |
| 予約ボタンクリック | `reserve_click`（`placement`：設置場所） | `trackCustom: ReserveClick` |
| 予約完了（確認できる場合のみ） | `reserve_complete` | `track: Schedule` |

- 表示系のイベントはページを開いている間に 1 回だけ、予約クリックは同じボタンの連打（1.5秒以内）を 1 回にまとめます。予約完了はタブを閉じるまで 1 回だけです
- パラメータは予約ボタンの設置場所（`placement`）だけです。アンケートの回答・結果テーマなどの健康情報は送りません
- **予約クリックは予約完了として記録しません。** 予約完了を計測したい場合は、予約システム側で「予約完了後に `https://（公開ドメイン）/pelvis/reserve/complete/` へ戻す」設定ができることを確認したうえで、`reservationCompleteTracking` を `true` にします
- Meta 広告の最適化に使うコンバージョンは、Meta イベントマネージャで `ReserveClick`（または確認できる場合は `Schedule`）をカスタムコンバージョンとして登録してください
- GA4 の「拡張計測機能」のページビューはそのまま有効です

### 画像の差し替え

1. 画像を `public/images/` に置く（例：`public/images/hero.jpg`）
2. `lp.config.ts` の `images.hero` などに `{ src: '/images/hero.jpg', alt: '画像の説明', width: 1200, height: 800 }` のように設定する（width / height は画像の実寸）

画像は Next.js の Image で自動的にサイズ最適化され、ファーストビュー以外は遅延読み込みされます。

## 公開手順（Vercel の例）

1. Vercel で「Add New → Project」からこの GitHub リポジトリを選ぶ
2. 「Root Directory」に `pelvis-lp` を指定する（Framework は Next.js が自動選択される）
3. 「Environment Variables」に `NEXT_PUBLIC_RESERVATION_URL`・`NEXT_PUBLIC_GA4_ID`・`NEXT_PUBLIC_META_PIXEL_ID` を登録する
4. 「Deploy」を押す。公開後、`https://（ドメイン）/pelvis/` を Meta 広告のリンク先にする
5. 公開後に、予約ボタンの遷移先、GA4 のリアルタイム、Meta のイベントテストツールでイベントが届くことを確認する

公開前に確認すること：

- 店舗名・住所・営業時間・施術時間・実際の施術内容・来店後の流れ（確認できた内容だけを入れる）
- 個人情報保護方針・Cookie（広告計測）に関する掲載の要否
- 広告表現（医療広告ガイドライン・景品表示法など）に関する最終確認

## 既知の制約・未実装

- 実際の施術内容、来店後の流れ、店舗情報、施術時間、画像、ロゴは未設定（推測で掲載しないため）。設定するまで本番ページでは該当部分が表示されない
- 予約完了の計測は、予約システムから完了ページへ戻せる場合のみ利用可能（初期設定は無効）
- Cookie 同意バナーは未実装（必要かどうかは公開前に確認）
- 予約ボタンを押した直後に別サイトへ移動するため、通信環境によっては Meta Pixel のクリックイベントが届かない場合がある（GA4 は送信中のページ移動に対応した方式で送信される）
- Content-Security-Policy ヘッダーは未設定（広告スクリプトの読み込み先が確定してから設定するのがよい）
