#!/usr/bin/env bash
# 画面の自動テスト（E2E）。
# 一時的な PostgreSQL にマイグレーションを適用し、Supabase の API を再現するテスト用サーバー
# （scripts/e2e/fake-supabase.mjs）を起動して、本番ビルドのアプリを Playwright で操作する。
#   1. npm run build
#   2. npm run test:e2e
# 必要なもの：PostgreSQL 15 以上のコマンド（initdb, pg_ctl, psql）、Playwright の Chromium
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .next/BUILD_ID ]; then
  echo "本番ビルドがありません。先に 'npm run build' を実行してください。" >&2
  exit 1
fi

source scripts/pg-temp.sh
pg_temp_migrate

ADMIN_ID=00000000-0000-0000-0000-0000000000a1
STAFF_ID=00000000-0000-0000-0000-0000000000b1
"${PSQL[@]}" -c "insert into auth.users (id, email) values ('$ADMIN_ID', 'admin@example.test'), ('$STAFF_ID', 'not-admin@example.test');
                 insert into public.admins (user_id) values ('$ADMIN_ID');
                 update public.app_settings set shop_name = 'テスト整骨院', shop_phone = '03-0000-0000', min_lead_minutes = 0;"

export FAKE_JWT_SECRET="e2e-$(date +%s)-$RANDOM"
export FAKE_SUPABASE_PORT=54400
export FAKE_USERS="[{\"id\":\"$ADMIN_ID\",\"email\":\"admin@example.test\",\"password\":\"admin-password-123\"},{\"id\":\"$STAFF_ID\",\"email\":\"not-admin@example.test\",\"password\":\"staff-password-123\"}]"
node scripts/e2e/fake-supabase.mjs > "$PG_WORK/fake.log" 2>&1 &
FAKE_PID=$!
trap 'kill $FAKE_PID 2>/dev/null || true; pg_temp_cleanup' EXIT
for _ in $(seq 1 50); do
  grep -q listening "$PG_WORK/fake.log" && break
  sleep 0.1
done

export E2E_SUPABASE_URL="http://127.0.0.1:$FAKE_SUPABASE_PORT"
export E2E_SUPABASE_ANON_KEY="$(node -e '
const c = require("node:crypto");
const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const h = b({ alg: "HS256", typ: "JWT" }), p = b({ role: "anon", iss: "supabase", iat: 1700000000 });
process.stdout.write(`${h}.${p}.${c.createHmac("sha256", process.env.FAKE_JWT_SECRET).update(`${h}.${p}`).digest("base64url")}`);
')"
export E2E_PGHOST="$PGHOST" E2E_PGPORT="$PGPORT"

npx playwright test "$@"
