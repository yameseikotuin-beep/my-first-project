#!/usr/bin/env bash
# RLS（行レベルセキュリティ）のテスト。
# 一時的な PostgreSQL を起動し、Supabase 環境の最小限の再現 → マイグレーション → テストの順に実行する。
# 必要なもの：PostgreSQL 15 以上のコマンド（initdb, pg_ctl, psql）
set -euo pipefail
cd "$(dirname "$0")/.."

PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
WORK="$(mktemp -d)"
PORT="${RLS_TEST_PORT:-54329}"
cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL は root では起動できないため、一時ディレクトリを postgres ユーザーに渡して実行する
  chown -R postgres "$WORK"
  RUN_AS=(runuser -u postgres --)
fi

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
for f in supabase/tests/[1-9]*.sql; do
  echo "== $f"
  "${PSQL[@]}" -f "$f"
done
echo "RLS tests passed."
