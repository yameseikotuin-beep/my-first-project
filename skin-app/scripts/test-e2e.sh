#!/usr/bin/env bash
# 画面の自動テスト（E2E）。
# 手元の Supabase（Docker が必要）を起動し、本番ビルドのアプリに対して Playwright で操作を確認する。
#   1. npx supabase start（初回は数分かかる）
#   2. npm run build
#   3. npm run test:e2e
set -euo pipefail
cd "$(dirname "$0")/.."

STATUS="$(npx supabase status -o env 2>/dev/null)" || {
  echo "手元の Supabase が起動していません。先に 'npx supabase start' を実行してください。" >&2
  exit 1
}
value() { printf '%s\n' "$STATUS" | sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p"; }

export E2E_SUPABASE_URL="$(value API_URL)"
export E2E_SUPABASE_ANON_KEY="$(value ANON_KEY)"
export E2E_SUPABASE_SERVICE_ROLE_KEY="$(value SERVICE_ROLE_KEY)"

if [ ! -f .next/BUILD_ID ]; then
  echo "本番ビルドがありません。先に 'npm run build' を実行してください。" >&2
  exit 1
fi

npx playwright test "$@"
