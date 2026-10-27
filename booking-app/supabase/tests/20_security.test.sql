-- 権限・RLS のテスト（仕様書 9章のテスト 10・11）
-- 未ログイン・ログイン済みだが管理者でない利用者・管理者で、見られるもの・できることを確認する。
\set QUIET on
\set ON_ERROR_STOP on
begin;

-- 他のお客様の予約（postgres として作成）
insert into public.bookings (booking_number, customer_name, customer_phone, notes, service_id, service_name, price,
                             start_at, end_at, room_id, source)
values ('000000-SECR', '秘密 花子', '09099998888', '個人的な備考', tests.svc('肩こり整体'), '肩こり整体', 4400,
        tests.at(tests.monday(), '15:00'), tests.at(tests.monday(), '15:40'), tests.room('施術ベッド1'), 'web');

-- ---------------------------------------------------------------------
-- 未ログイン（anon）
-- ---------------------------------------------------------------------
set local role anon;
select tests.logout();
select tests.throws('select * from public.bookings', 'permission denied', '未ログインは予約テーブルを読めない');
select tests.throws('select * from public.admin_booking_list', 'permission denied', '未ログインは管理用の予約一覧を読めない');
select tests.throws('select * from public.services', 'permission denied', '未ログインはメニューのテーブルを直接読めない');
select tests.throws('select * from public.app_settings', 'permission denied', '未ログインは設定を直接読めない');
select tests.throws('select * from public.admins', 'permission denied', '未ログインは管理者の一覧を読めない');
select tests.throws('select * from public.practitioners', 'permission denied', '未ログインは施術者を直接読めない');
select tests.throws(
  $$insert into public.bookings (booking_number, customer_name, customer_phone, service_id, service_name, price, start_at, end_at, room_id, source)
    values ('x', 'x', '09000000000', tests.svc('肩こり整体'), 'x', 0, now(), now() + interval '1 hour', tests.room('施術ベッド1'), 'web')$$,
  'permission denied', '未ログインは予約テーブルに直接書き込めない');
select tests.throws($$update public.services set price = 0$$, 'permission denied', '未ログインはメニューを変更できない');
select tests.throws($$select * from public.admin_available_slots(tests.svc('肩こり整体'), tests.monday())$$,
  'permission denied', '未ログインは管理用の空き時間を使えない');
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), 'x', '09000000000', '')$$,
  'permission denied', '未ログインは管理用の予約登録を使えない');
select tests.throws($$select public.admin_cancel_booking(gen_random_uuid())$$, 'permission denied', '未ログインは予約をキャンセルできない');
select tests.throws($$select * from public._find_resources(tests.svc('肩こり整体'), now(), now(), null, null, null)$$,
  'permission denied', '未ログインは内部関数を呼べない');
select tests.throws($$select public._time_rule_error(now(), now(), true)$$, 'permission denied', '未ログインは内部関数（管理者モード）を呼べない');

-- 公開関数は空き状況に必要な情報だけを返す（他のお客様の氏名・電話番号を含まない）
select tests.ok(
  not exists (select 1 from public.get_available_slots(tests.svc('肩こり整体'), tests.monday()) s
              where s::text like '%秘密%' or s::text like '%0909999%'),
  '空き時間に他のお客様の情報が含まれない');
select tests.ok(
  (select row_to_json(s)::jsonb ?& array['start_at', 'end_at'] and (select count(*) from jsonb_object_keys(row_to_json(s)::jsonb)) = 2
   from public.get_available_slots(tests.svc('肩こり整体'), tests.monday()) s limit 1),
  '空き時間の応答は開始・終了時刻だけ');
select tests.ok(
  (select count(*) from jsonb_object_keys((select row_to_json(i)::jsonb from public.get_public_info() i))) = 5,
  '店舗情報の応答は公開してよい5項目だけ');
select tests.ok(
  (select row_to_json(r)::jsonb ?& array['booking_number', 'service_name', 'price', 'start_at', 'end_at']
      and not (row_to_json(r)::jsonb ? 'customer_phone')
   from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '本人', '09011110000') r),
  '予約登録の応答は本人の予約番号と内容だけ（他のお客様の情報や内部IDを返さない）');

-- ---------------------------------------------------------------------
-- ログイン済みだが管理者ではない利用者
-- ---------------------------------------------------------------------
reset role;
select tests.login('00000000-0000-0000-0000-000000000001');
set local role authenticated;
select tests.ok(not public.is_admin(), '管理者でない利用者は is_admin() が false');
select tests.ok((select count(*) = 0 from public.bookings), '管理者でない利用者には予約が1件も見えない');
select tests.ok((select count(*) = 0 from public.admin_booking_list), '管理者でない利用者には管理用の予約一覧が見えない');
select tests.ok((select count(*) = 0 from public.services), '管理者でない利用者にはメニューのテーブルが見えない');
select tests.ok((select count(*) = 0 from public.app_settings), '管理者でない利用者には設定が見えない');
select tests.throws(
  $$insert into public.services (name, duration_minutes, price) values ('不正', 30, 0)$$,
  'row-level security', '管理者でない利用者はメニューを追加できない');
update public.app_settings set slot_interval_minutes = 60;
update public.business_hours set is_closed = true;
reset role;
select tests.ok((select slot_interval_minutes = 15 from public.app_settings), '管理者でない利用者は設定を変更できない');
select tests.ok((select count(*) = 0 from public.business_hours where is_closed and weekday = 1), '管理者でない利用者は営業時間を変更できない');
select tests.login('00000000-0000-0000-0000-000000000001');
set local role authenticated;
select tests.throws($$select public.admin_cancel_booking((select gen_random_uuid()))$$, 'FORBIDDEN', '管理者でない利用者は予約をキャンセルできない');
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), 'x', '09000000000', '')$$,
  'FORBIDDEN', '管理者でない利用者は予約を登録できない');
select tests.throws($$select * from public.admin_available_slots(tests.svc('肩こり整体'), tests.monday())$$,
  'FORBIDDEN', '管理者でない利用者は管理用の空き時間を使えない');
select tests.throws($$insert into public.admins (user_id) values (auth.uid())$$, 'permission denied', '自分を管理者に登録できない');
select tests.throws($$update public.bookings set status = 'cancelled'$$, 'permission denied', '予約テーブルを直接更新できない');

-- ---------------------------------------------------------------------
-- 管理者
-- ---------------------------------------------------------------------
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select tests.ok(public.is_admin(), '管理者は is_admin() が true');
select tests.ok((select count(*) = 2 from public.bookings), '管理者はすべての予約を読める');
select tests.ok((select room_name = '施術ベッド1' from public.admin_booking_list where booking_number = '000000-SECR'),
  '管理者は予約一覧でスペース名を読める');
insert into public.services (name, duration_minutes, price) values ('新メニュー', 30, 3000);
select tests.ok((select count(*) = 1 from public.services where name = '新メニュー'), '管理者はメニューを追加できる');
update public.app_settings set slot_interval_minutes = 30;
select tests.ok((select slot_interval_minutes = 30 from public.app_settings), '管理者は設定を変更できる');
select tests.throws($$update public.bookings set status = 'cancelled'$$, 'permission denied',
  '管理者でも予約テーブルを直接更新できない（重複確認を通す関数を使う）');
select tests.throws($$delete from public.app_settings$$, 'permission denied', '設定の行は削除できない');

rollback;
