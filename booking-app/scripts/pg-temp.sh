# 一時的な PostgreSQL を起動する共通処理（source して使う）。
# 実行後は PSQL 配列・PGHOST・PGPORT が使える。終了時に自動で停止・削除する。
# 必要なもの：PostgreSQL 15 以上のコマンド（initdb, pg_ctl, psql）
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
PG_WORK="$(mktemp -d)"
PGPORT="${PGPORT_TEST:-54339}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  # PostgreSQL は root では起動できないため、一時ディレクトリを postgres ユーザーに渡して実行する
  chown -R postgres "$PG_WORK"
  RUN_AS=(runuser -u postgres --)
fi
pg_temp_cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$PG_WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PG_WORK"; }
trap pg_temp_cleanup EXIT

"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$PG_WORK/data" -U postgres -A trust -E UTF8 --locale=C >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$PG_WORK/data" \
  -o "-p $PGPORT -k $PG_WORK -c listen_addresses=127.0.0.1 -c timezone=UTC -c max_connections=200" \
  -l "$PG_WORK/log" -w start >/dev/null
export PGHOST="$PG_WORK" PGPORT
PSQL=("$PG_BIN/psql" -h "$PG_WORK" -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)

pg_temp_migrate() {
  "${PSQL[@]}" -f supabase/tests/00_supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    "${PSQL[@]}" -f "$f"
  done
}
