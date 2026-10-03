# 03. システム構成

> ステータス：**第1段階（設計）— レビュー待ち**

## 1. 全体構成

```
 ┌──────────── 利用者の端末（スマホ / タブレット / PC） ─────────────┐
 │ Next.js の画面（PWA）                                              │
 │  ・カメラ撮影、顔検出・品質チェック（端末内で実行。画像は外に出さない） │
 │  ・EXIF の除去、縮小                                               │
 │  ・Supabase へは「ログイン中の本人の権限」でのみアクセス              │
 └───────┬───────────────────────────┬──────────────────────┘
         │ HTTPS                                │ HTTPS（本人の権限＋RLS）
         ▼                                      ▼
 ┌──── Next.js サーバー（Vercel） ─────┐   ┌──────── Supabase（東京） ────────┐
 │ Route Handler / Server Action       │   │ Auth（メール・パスワード、招待）    │
 │  ・権限と同意の確認                    │──▶│ Postgres（RLS で行ごとに制限）     │
 │  ・画像解析モジュールの呼び出し          │   │ Storage（非公開バケット、RLS）      │
 │  ・Claude API の呼び出し               │   └───────────────────────────┘
 │  ・監査ログの記録                       │
 │ 環境変数：ANTHROPIC_API_KEY、           │   ┌──────── Anthropic（Claude API）──┐
 │   SUPABASE_SERVICE_ROLE_KEY（限定用途）  │──▶│ 縮小した顔画像＋指示文を送り、       │
 └───────────────────────────────────┘   │ 見た目の説明文（JSON）を受け取る     │
                                           └───────────────────────────┘
```

**秘密の情報は端末に渡さない。** 端末に渡るのは Supabase の公開用キー（`anon` キー。RLS が前提で公開してよいもの）と URL だけ。

## 2. 技術スタック

| 分類 | 採用 | 理由 |
| --- | --- | --- |
| フレームワーク | Next.js（App Router）＋ TypeScript（strict） | 指定どおり。サーバー側処理と画面を1つにまとめられる |
| スタイル | Tailwind CSS ＋ CSS 変数のデザイントークン | トークンで色を一元管理し、レスポンシブを書きやすい |
| UI 部品 | Radix UI（アクセシブルな部品の土台） | キーボード操作・読み上げ対応が組み込まれている |
| 入力検証 | Zod（画面・サーバー・AI の出力で同じスキーマを使う） | 検証の二重管理を避ける |
| フォーム | React Hook Form ＋ Zod | |
| 認証・DB・写真 | Supabase（`@supabase/ssr`） | 指定どおり。Cookie ベースのセッション |
| 顔検出・角度推定 | MediaPipe Face Landmarker（WASM、端末内で実行。モデルファイルは自前で配信） | 外部に画像を送らずに角度・距離を測れる |
| AI 説明文 | Claude API（`@anthropic-ai/sdk`、サーバー側のみ） | 指定どおり |
| グラフ | Recharts | |
| PDF | 印刷用ページ ＋ ブラウザの印刷機能（`@media print`） | 日本語フォントの問題が起きにくく、外部サービス不要 |
| PWA | Web App Manifest ＋ 自前の Service Worker（静的ファイルのみキャッシュ） | 個人情報をキャッシュしない制御を確実にするため |
| テスト | Vitest（単体）、Playwright（画面の通し）、pgTAP または SQL スクリプト（RLS） | |
| 静的解析 | ESLint、Prettier、`tsc --noEmit` | |

※ 各ライブラリのバージョンは第2段階の開始時点の安定版に固定する。

## 3. フォルダ構成（予定）

```
skin-app/
├─ docs/                      設計書（本書）
├─ supabase/
│  ├─ migrations/             テーブル・RLS・関数の定義（SQL）
│  ├─ seed.sql                開発用の仮データ（実在の人物・写真は使わない）
│  └─ tests/                  RLS のテスト
├─ src/
│  ├─ app/
│  │  ├─ (public)/            トップ、ログイン、規約など
│  │  ├─ me/                  一般ユーザー画面
│  │  ├─ staff/               スタッフ画面
│  │  ├─ admin/               管理者画面
│  │  └─ api/                 Route Handler（分析、AI、退会など）
│  ├─ components/             共通の画面部品（撮影部品はここで共通化）
│  ├─ features/               機能ごとの部品・処理（capture, analysis, customers ...）
│  ├─ lib/
│  │  ├─ supabase/            client.ts / server.ts / admin.ts（admin は server-only）
│  │  ├─ auth/                役割の取得、権限チェック
│  │  ├─ analysis/            画像解析モジュール（§4）
│  │  ├─ ai/                  Claude 連携、指示文、出力の検査
│  │  ├─ audit/               監査ログの記録
│  │  └─ validation/          Zod スキーマ
│  ├─ middleware.ts           セッション更新、役割による画面の振り分け
│  └─ messages/ja.ts          画面の文言（日本語）
├─ public/                    アイコン、manifest、MediaPipe のモデルファイル
└─ tests/                     単体テスト・E2E テスト
```

既存の `diet-tracker.html` などとは独立したフォルダにし、お互いに影響しないようにする。

## 4. 画像解析モジュール設計

### 4.1 考え方

「写真から特徴を取り出して点数をつける部分」と「見た目を文章で説明する部分」を分ける。

| 部分 | 役割 | 第3段階での中身 | 将来 |
| --- | --- | --- | --- |
| 品質チェック（`QualityAssessor`） | 明るさ・ブレ・角度・距離を測る | 実装する（端末内の計算。数値の意味がはっきりしているため） | そのまま |
| 特徴抽出（`SkinFeatureAnalyzer`） | 項目×部位の評価と確信度 | **モック**（決まったルールで仮の値を返し、`validated: false`） | 検証済みの専用モデルに差し替え |
| 説明文（`VisualDescriber`） | 見た目の特徴を文章で説明 | Claude API（キー未設定時はモックの文章） | そのまま、または別モデル |

Claude に点数をつけさせない理由：言語モデルの数値は同じ写真でもぶれやすく、精度の検証もされていないため。数値は差し替え可能な特徴抽出モジュールだけが出す。

### 4.2 インターフェース（TypeScript）

```ts
// src/lib/analysis/types.ts（予定）
export type Region = 'forehead' | 'cheek_left' | 'cheek_right' | 'nose' | 'chin' | 'under_eye';
export type Metric = 'pores' | 'redness' | 'pigmentation_like' | 'texture' | 'surface';
export type Angle = 'front' | 'left' | 'right';

export interface AnalyzerInfo {
  name: string;          // 例: 'mock-rule-based'
  version: string;       // 例: '0.1.0'
  validated: boolean;    // 検証済みか。false の間は画面に「モック（未検証）」を表示
}

export interface PhotoInput {
  angle: Angle;
  image: Uint8Array;     // 縮小・EXIF 除去済み JPEG
  quality: QualityReport;
}

export interface QualityReport {
  brightness: number;    // 0〜1
  sharpness: number;     // ブレの少なさ（値が大きいほど鮮明）
  yawDeg: number;        // 左右の向き
  pitchDeg: number;      // 上下の向き
  faceAreaRatio: number; // 画面に占める顔の割合（距離の目安）
  passed: boolean;
  issues: QualityIssue[]; // 'too_dark' | 'blurry' | 'turned' | 'too_far' ...
}

export interface ItemResult {
  metric: Metric;
  region: Region;
  determinable: boolean;  // 判定できたか
  grade: 1 | 2 | 3 | 4 | 5 | null; // 見え方の5段階（判定不可なら null）
  confidence: number;     // 0〜1
  reasonIfUndeterminable?: string;
}

export interface SkinFeatureAnalyzer {
  readonly info: AnalyzerInfo;
  analyze(photos: PhotoInput[]): Promise<ItemResult[]>;
}

export interface VisualDescriber {
  readonly info: AnalyzerInfo & { provider: string };
  describe(photos: PhotoInput[], items: ItemResult[]): Promise<VisualDescription>;
}
```

- 使う実装は環境変数 `SKIN_ANALYZER=mock` のように設定で切り替える（コードの書き換え不要）。
- 分析結果には **どの実装・どの版で出したか** を必ず保存する（後で専用モデルに替えたときに、古い結果と区別できるようにする）。
- 判定困難の基準（例：品質チェック不合格、または確信度 0.4 未満の項目が半分以上）を満たしたら、結果を確定させずに「再撮影が必要」として保存する。

### 4.3 Claude API 連携

| 項目 | 方針 |
| --- | --- |
| 呼び出し場所 | サーバー（Route Handler）のみ。`import 'server-only'` で端末側に含まれないようにする |
| SDK | `@anthropic-ai/sdk`（TypeScript 公式） |
| モデル | `claude-opus-5-5`（環境変数 `ANTHROPIC_MODEL` で変更可能） |
| 送るもの | 縮小（長辺 1024px 程度）・EXIF 除去済みの顔画像、特徴抽出の結果、指示文。**氏名・連絡先などの個人情報は送らない** |
| 出力形式 | 構造化出力（`output_config.format` で JSON スキーマを指定）→ さらに Zod で検証 |
| 指示文 | 「画像上の見た目の特徴だけを説明する」「病名・診断・治療・肌年齢・水分量や油分量の数値を書かない」「確信が持てない部分は判定できないと書く」「異常が疑われる見え方があれば医療機関への相談を勧める」 |
| 出力の検査 | 禁止語（病名・医療用語・効果の断定表現など）の検査を通らなければ、その文を表示しない（[05-security.md §7](05-security.md#7-ai出力の安全対策)） |
| 断られた場合 | 応答の `stop_reason` が `refusal` の場合などは、説明文なしで結果を保存し「説明文を作成できませんでした」と表示 |
| エラー・時間切れ | 再試行は SDK の標準（最大2回）。それでも失敗したら「AI未接続」として結果を保存し、あとで再実行できるようにする |
| 回数制限 | 1人あたりの1日の AI 利用回数に上限（例：一般ユーザー 10回／日）。データベースで数える |
| キー未設定時 | 自動でモックの説明文に切り替え、画面に「AI未接続（モック）」と表示する |

施術案内文（機能F）も同じ仕組みで作る。指示文に**管理者が登録したメニュー情報だけ**を渡し、それ以外の施術や効果を書かないよう指示し、出力も検査する。

## 5. 主な処理の流れ

### 5.1 撮影とアップロード

1. 端末で顔検出・品質チェック（MediaPipe ＋ 明るさ・ブレの計算）
2. 端末で写真を描き直して EXIF を除去し、縮小（保存用は長辺 2048px 程度）
3. サーバーの処理で「撮影セッション」を作成（権限と「撮影・保存」の同意を確認）
4. 端末から Supabase Storage に、ログイン中の本人の権限でアップロード（Storage の RLS で保存先を制限）
5. 写真の情報（角度・品質チェックの値）をデータベースに保存。監査ログを記録

### 5.2 分析

1. 端末から `POST /api/analyses`（撮影セッションの ID だけを送る）
2. サーバー：ログイン確認 → 対象へのアクセス権確認 → 「AI送信」の同意確認 → 回数制限確認
3. サーバー：本人の権限で写真を読み出す
4. 特徴抽出（モック）→ 判定困難なら「再撮影が必要」で終了
5. Claude で説明文を作成 → 出力の検査
6. 結果を保存し、監査ログ（「AIに送信した」こと、送信した画像の ID）を記録
7. 端末は結果画面へ移動

### 5.3 写真の表示

写真は非公開の保存場所に置き、表示のたびに **有効期限の短い署名付き URL**（60秒程度）を発行する。URL を発行できるのは RLS でその写真を見る権限がある人だけ。

## 6. 環境変数

| 変数 | 置き場所 | 内容 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 端末にも渡る | Supabase の URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 端末にも渡る | 公開用キー（RLS が前提） |
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバーのみ** | スタッフ招待・退会処理・監査ログの記録だけに使う |
| `ANTHROPIC_API_KEY` | **サーバーのみ** | Claude API キー。未設定ならモックで動く |
| `ANTHROPIC_MODEL` | サーバーのみ | 既定 `claude-opus-5-5` |
| `SKIN_ANALYZER` | サーバーのみ | 特徴抽出の実装名（既定 `mock`） |
| `AI_DAILY_LIMIT_USER` / `AI_DAILY_LIMIT_STAFF` | サーバーのみ | AI 利用回数の上限 |

`.env.example` に一覧を置き、実際の値はリポジトリに入れない（`.gitignore` 済みにする）。

## 7. 既存のリポジトリとの関係

- `skin-app/` フォルダに独立した Next.js プロジェクトとして作る。既存の `diet-tracker.html`、`index.html`、`react-app/` には手を入れない。
- ルートの `manifest.json` と `sw.js` は既存アプリ用なので使わず、`skin-app` 専用のものを用意する。
