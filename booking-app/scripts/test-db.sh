#!/usr/bin/env bash
# データベースのテスト（予約ルール・権限・RLS・同時予約）。
# 一時的な PostgreSQL を起動し、Supabase 環境の最小限の再現 → マイグレーション → テストの順に実行する。
# 必要なもの：PostgreSQL 15 以上のコマンド（initdb, pg_ctl, psql）
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/pg-temp.sh
pg_temp_migrate
# メールアドレス追加の SQL は、すでに実行済みの環境でもう一度実行できること
"${PSQL[@]}" -f supabase/migrations/20261028000000_customer_email.sql
"${PSQL[@]}" -f supabase/tests/05_helpers.sql
for f in supabase/tests/[1-9]*.test.sql; do
  echo "== $f"
  "${PSQL[@]}" -f "$f" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  /  /p; /ERROR/p; /FAIL/p"
done
echo "== 同時予約テスト"
source scripts/concurrency-test.sh
echo "Database tests passed."
