#!/usr/bin/env bash
# 同時予約テスト：同じ枠に多数の予約確定処理を同時に送り、重複が確定しないことを確認する。
# scripts/test-db.sh から呼ばれる（一時的な PostgreSQL が起動済みで、PSQL 配列が使える前提）。
set -euo pipefail
N=30
OUT="$PG_WORK/concurrency"
mkdir -p "$OUT"

q() { "${PSQL[@]}" -At -c "$1"; }

# 8日以上先の月曜 10:00（日本時間）
SLOT="$(q "select tests.at(tests.monday(), '10:00')")"
SVC="$(q "select tests.svc('肩こり整体')")"

fire_web() {
  # $1 = 試行番号。未ログインのお客様として予約確定処理を呼ぶ
  "${PSQL[@]}" -At -c "set role anon; select booking_number from public.create_booking('$SVC', '$SLOT', '同時$1', '0903000$(printf %04d "$1")');" \
    >"$OUT/$1.out" 2>"$OUT/$1.err" || true
}
fire_admin() {
  "${PSQL[@]}" -At -c "select tests.login('00000000-0000-0000-0000-00000000000a'); set role authenticated; select public.admin_save_booking(null, '$SVC', '$SLOT', '電話$1', '0904000$(printf %04d "$1")', '');" \
    >"$OUT/$1.out" 2>"$OUT/$1.err" || true
}

run_case() {
  # $1 = 説明, $2 = 期待する確定件数, $3 = web|mixed
  rm -f "$OUT"/*
  q "delete from public.bookings" >/dev/null
  for i in $(seq 1 $N); do
    if [ "$3" = "mixed" ] && [ $((i % 2)) = 0 ]; then fire_admin "$i" & else fire_web "$i" & fi
  done
  wait
  local booked ok_calls conflicts
  booked="$(q "select count(*) from public.bookings where status = 'confirmed' and start_at = '$SLOT'")"
  ok_calls="$(grep -l . "$OUT"/*.out 2>/dev/null | wc -l || true)"
  conflicts="$(grep -l 'SLOT_UNAVAILABLE' "$OUT"/*.err 2>/dev/null | wc -l || true)"
  others="$(grep -L 'SLOT_UNAVAILABLE' "$OUT"/*.err | xargs -r grep -l . | wc -l || true)"
  if [ "$booked" != "$2" ] || [ "$ok_calls" != "$2" ] || [ "$conflicts" != "$((N - $2))" ] || [ "$others" != "0" ]; then
    echo "FAIL: $1（確定 $booked 件／成功応答 $ok_calls 件／満席応答 $conflicts 件／その他のエラー $others 件。期待：確定 $2 件）"
    cat "$OUT"/*.err | sort | uniq -c | head
    exit 1
  fi
  # 重なりのある確定予約が同じスペース・同じ施術者に存在しないこと
  local overlaps
  overlaps="$(q "select count(*) from public.bookings a join public.bookings b on a.id < b.id
     and a.status = 'confirmed' and b.status = 'confirmed'
     and tstzrange(a.start_at, a.end_at) && tstzrange(b.start_at, b.end_at)
     and (a.room_id = b.room_id or a.practitioner_id = b.practitioner_id)")"
  [ "$overlaps" = "0" ] || { echo "FAIL: $1（重複予約 $overlaps 組）"; exit 1; }
  echo "  ok - $1：$N 件同時に送信 → 確定 $booked 件、残り $((N - $2)) 件は満席として拒否"
}

q "update public.rooms set is_active = (name = '施術ベッド1')" >/dev/null
run_case "スペース1つ・WEB予約のみ" 1 web
run_case "スペース1つ・WEB予約と電話予約（管理画面）が混在" 1 mixed
q "update public.rooms set is_active = true" >/dev/null
run_case "スペース3つ" 3 web
q "update public.app_settings set use_practitioners = true; insert into public.practitioners (name) values ('同時テスト施術者')" >/dev/null
run_case "スペース3つ・施術者1人" 1 mixed
q "update public.app_settings set use_practitioners = false; delete from public.bookings; delete from public.practitioners" >/dev/null

# 関数を通さずに直接書き込んでも、データベースの排他制約が重複を拒否すること
q "insert into public.bookings (booking_number, customer_name, customer_phone, service_id, service_name, price, start_at, end_at, room_id, source)
   select 'X-1', 'a', '09000000001', '$SVC', 'x', 0, '$SLOT', timestamptz '$SLOT' + interval '40 minutes', id, 'admin' from public.rooms where name = '施術ベッド1'" >/dev/null
if q "insert into public.bookings (booking_number, customer_name, customer_phone, service_id, service_name, price, start_at, end_at, room_id, source)
   select 'X-2', 'b', '09000000002', '$SVC', 'x', 0, timestamptz '$SLOT' + interval '30 minutes', timestamptz '$SLOT' + interval '70 minutes', id, 'admin' from public.rooms where name = '施術ベッド1'" >/dev/null 2>"$OUT/direct.err"; then
  echo "FAIL: 排他制約が重複を拒否しなかった"; exit 1
fi
grep -q bookings_no_room_overlap "$OUT/direct.err" || { cat "$OUT/direct.err"; exit 1; }
q "delete from public.bookings" >/dev/null
echo "  ok - 関数を通さない直接の書き込みでも、排他制約が重複を拒否する"
