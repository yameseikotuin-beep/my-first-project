#!/usr/bin/env bash
# 画面の自動テスト（E2E）。設定の異なる 2 つの本番ビルドを作り、Playwright で操作を確認する。
#   npm run test:e2e
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== ビルド（予約URL・GA4・Meta Pixel 設定あり：テスト用の値）"
NEXT_DIST_DIR=.next-e2e-configured \
NEXT_PUBLIC_RESERVATION_URL=https://reserve.example.com/booking \
NEXT_PUBLIC_GA4_ID=G-TEST12345 \
NEXT_PUBLIC_META_PIXEL_ID=1234567890 \
  npx next build

echo "== ビルド（すべて未設定）"
NEXT_DIST_DIR=.next-e2e-unset \
NEXT_PUBLIC_RESERVATION_URL= \
NEXT_PUBLIC_GA4_ID= \
NEXT_PUBLIC_META_PIXEL_ID= \
  npx next build

# クラウド環境などで Playwright 同梱のブラウザが無い場合は、用意済みの Chromium を使う
if [ -z "${PW_CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  export PW_CHROMIUM_PATH=/opt/pw-browsers/chromium
fi

npx playwright test "$@"
