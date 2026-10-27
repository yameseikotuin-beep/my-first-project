-- テスト用の補助関数とデータ（postgres として作成）
\set QUIET on
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false)
$$;
create function tests.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', false)
$$;

create function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok - %', label;
end $$;

-- SQL がエラーになり、メッセージ（または detail）に expected を含むことを確認する
create function tests.throws(query text, expected text, label text) returns void language plpgsql as $$
declare msg text; det text;
begin
  begin
    execute query;
  exception when others then
    get stacked diagnostics msg = message_text, det = pg_exception_detail;
    if expected is not null and position(expected in coalesce(msg, '') || ' ' || coalesce(det, '')) = 0 then
      raise exception 'FAIL: % (想定外のエラー: % / %)', label, msg, det;
    end if;
    raise notice 'ok - % (拒否: % %)', label, msg, coalesce(det, '');
    return;
  end;
  raise exception 'FAIL: % (エラーにならなかった)', label;
end $$;

-- テストに使う日：8日以上先の月曜日（日本時間）
create function tests.monday() returns date language sql stable as $$
  select d + ((8 - extract(dow from d)::integer) % 7)
  from (select (now() at time zone 'Asia/Tokyo')::date + 8 as d) x
$$;
-- その日の日本時間の時刻
create function tests.at(d date, t text) returns timestamptz language sql immutable as $$
  select (d + t::time) at time zone 'Asia/Tokyo'
$$;
create function tests.svc(n text) returns uuid language sql stable security definer as $$
  select id from public.services where name = n
$$;
create function tests.room(n text) returns uuid language sql stable security definer as $$
  select id from public.rooms where name = n
$$;
-- 予約可能な開始時刻（HH:MM）の一覧
create function tests.slots(svc text, d date) returns text[] language sql stable as $$
  select coalesce(array_agg(to_char(start_at at time zone 'Asia/Tokyo', 'HH24:MI') order by start_at), '{}')
  from public.get_available_slots(tests.svc(svc), d)
$$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test'),
  ('00000000-0000-0000-0000-000000000001', 'someone@example.test');
insert into public.admins (user_id) values ('00000000-0000-0000-0000-00000000000a');

-- テスト中は直前受付の制限をなくし、1つの電話番号で多く予約できるようにする
update public.app_settings set min_lead_minutes = 0, max_active_bookings_per_phone = 20;
