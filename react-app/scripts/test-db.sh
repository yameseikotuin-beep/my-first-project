#!/usr/bin/env bash
# Supabase のマイグレーションを、ローカルの PostgreSQL（16以上）で検証する。
# 使い方: PGURL=postgres://postgres@127.0.0.1:5432/postgres scripts/test-db.sh
# 一時データベースを作って検証し、終わったら削除する。
set -euo pipefail
cd "$(dirname "$0")/.."
PGURL="${PGURL:-postgres://postgres@127.0.0.1:5432/postgres}"
DB="diet_recipe_test_$$"
psql "$PGURL" -qc "create database $DB" >/dev/null
trap 'psql "$PGURL" -qc "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${PGURL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/migration.test.sql | grep -E "PASSED|ERROR" || true
