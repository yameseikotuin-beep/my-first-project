-- 管理画面からの予約操作のテスト（仕様書 9章のテスト 8・9）
\set QUIET on
\set ON_ERROR_STOP on
begin;
update public.rooms set is_active = (name = '施術ベッド1');  -- スペース1つで確認する
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

-- 8. 電話予約（手動登録）と WEB 予約の連動
create temp table ids (k text primary key, id uuid);
insert into ids select 'phone', public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'),
  '電話 太郎', '03-1234-5678', '電話で受付');
select tests.ok((select source = 'admin' and status = 'confirmed' from public.bookings where id = (select id from ids where k = 'phone')),
  '電話予約を手動登録できる');
reset role;
set local role anon;
select tests.ok(not ('10:00' = any (tests.slots('肩こり整体', tests.monday()))), '手動登録した予約の時間は WEB の空き時間から消える');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:15'), 'WEB 花子', '09012345678')$$,
  'SLOT_UNAVAILABLE', '手動登録した予約と重なる WEB 予約はできない');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'), 'WEB 花子', '09012345678')),
  'WEB 予約（11:00〜11:40）');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into ids select 'web', id from public.bookings where customer_name = 'WEB 花子';
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '11:20'), '電話 次郎', '0312345678', '')$$,
  'NO_RESOURCE', 'WEB 予約と重なる手動登録はできない（同じ重複防止ルール）');
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '12:00'), '電話 次郎', '0312345678', '')$$,
  'BREAK', '手動登録でも昼休みには登録できない');
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday() - 1, '10:00'), '電話 次郎', '0312345678', '')$$,
  'CLOSED', '手動登録でも休業日には登録できない');
select tests.ok(public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '13:07'), '電話 次郎', '0312345678', '') is not null,
  '手動登録は枠の間隔に合わない時刻（13:07）でも登録できる');
select tests.ok('14:00' = any (select to_char(start_at at time zone 'Asia/Tokyo', 'HH24:MI') from public.admin_available_slots(tests.svc('肩こり整体'), tests.monday())),
  '管理用の空き時間を取得できる');

-- 9. 予約の変更
select public.admin_save_booking((select id from ids where k = 'phone'), tests.svc('肩こり整体'), tests.at(tests.monday(), '15:00'),
  '電話 太郎', '0312345678', '時間変更');
select tests.ok((select start_at = tests.at(tests.monday(), '15:00') and notes = '時間変更' from public.bookings where id = (select id from ids where k = 'phone')),
  '予約の時間を変更できる');
select tests.ok('10:00' = any (select to_char(start_at at time zone 'Asia/Tokyo', 'HH24:MI') from public.admin_available_slots(tests.svc('肩こり整体'), tests.monday())),
  '変更前の時間は空きに戻る');
select tests.throws(
  format($$select public.admin_save_booking(%L, tests.svc('肩こり整体'), tests.at(tests.monday(), '11:20'), '電話 太郎', '0312345678', '')$$,
         (select id from ids where k = 'phone')),
  'SLOT_UNAVAILABLE', '他の予約と重なる時間には変更できない');
select public.admin_save_booking((select id from ids where k = 'phone'), tests.svc('肩こり整体'), tests.at(tests.monday(), '15:15'),
  '電話 太郎', '0312345678', '');
select tests.ok(true, '自分自身の予約と重なる時間（15:00→15:15）には変更できる');
select public.admin_save_booking((select id from ids where k = 'phone'), tests.svc('慢性痛改善整体'), tests.at(tests.monday(), '15:15'),
  '電話 太郎', '0312345678', '');
select tests.ok((select service_name = '慢性痛改善整体' and price = 6600 and end_at - start_at = interval '60 minutes'
                 from public.bookings where id = (select id from ids where k = 'phone')),
  'メニューを変更すると施術時間・料金も変わる');

-- 営業時間を後から変えても、時間を変えない修正（名前・備考）はできる
reset role;
update public.business_hours set close_time = '14:00', last_start_time = null where weekday = 1;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.admin_save_booking((select id from ids where k = 'phone'), tests.svc('慢性痛改善整体'), tests.at(tests.monday(), '15:15'),
  '電話 太郎（修正）', '0312345678', '');
select tests.ok((select customer_name = '電話 太郎（修正）' from public.bookings where id = (select id from ids where k = 'phone')),
  '時間を変えない修正は、営業時間の変更後でもできる');
select tests.throws(
  format($$select public.admin_save_booking(%L, tests.svc('慢性痛改善整体'), tests.at(tests.monday(), '15:30'), '電話 太郎', '0312345678', '')$$,
         (select id from ids where k = 'phone')),
  'OUTSIDE_HOURS', '営業時間外への時間変更はできない');
reset role;
update public.business_hours set close_time = '20:00', last_start_time = '19:00' where weekday = 1;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;

-- 9. キャンセルと復元・ステータス管理
select public.admin_cancel_booking((select id from ids where k = 'web'));
select tests.ok((select status = 'cancelled' and cancelled_at is not null from public.bookings where id = (select id from ids where k = 'web')),
  '予約をキャンセルできる');
insert into ids select 'over', public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'), '後から', '0312340000', '');
select tests.ok(true, 'キャンセルした予約の時間に別の予約を入れられる');
select tests.throws(
  format($$select public.admin_save_booking(%L, tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'), 'WEB 花子', '09012345678', '', null, null, 'confirmed')$$,
         (select id from ids where k = 'web')),
  'SLOT_UNAVAILABLE', '枠が埋まっていると、キャンセルした予約を「予約確定」に戻せない');
select public.admin_cancel_booking((select id from ids where k = 'over'));
select public.admin_save_booking((select id from ids where k = 'web'), tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'),
  'WEB 花子', '09012345678', '', null, null, 'confirmed');
select tests.ok((select status = 'confirmed' and cancelled_at is null from public.bookings where id = (select id from ids where k = 'web')),
  '枠が空いていれば「予約確定」に戻せる');

-- スペース・施術者の指定
reset role;
update public.rooms set is_active = true;
update public.app_settings set use_practitioners = true;
insert into public.practitioners (name, sort_order) values ('施術者A', 1), ('施術者B', 2);
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into ids select 'pick', public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '17:00'), '指定', '0312340001', '',
  tests.room('個室1'), (select id from public.practitioners where name = '施術者B'));
select tests.ok(
  (select room_id = tests.room('個室1') and practitioner_id = (select id from public.practitioners where name = '施術者B')
   from public.bookings where id = (select id from ids where k = 'pick')),
  'スペースと施術者を指定して登録できる');
select tests.throws(
  $$select public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '17:10'), '指定2', '0312340002', '',
      null, (select id from public.practitioners where name = '施術者B'))$$,
  'NO_RESOURCE', '指定した施術者が埋まっていれば登録できない');
insert into ids select 'auto', public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '17:10'), '自動', '0312340003', '');
select tests.ok(
  (select practitioner_id = (select id from public.practitioners where name = '施術者A')
   from public.bookings where id = (select id from ids where k = 'auto')),
  '指定しなければ空いている施術者が自動で割り当てられる');

-- 手動登録は直前受付・受付期間の制限を受けない（電話・来店のため）
reset role;
update public.app_settings set booking_window_days = 1, min_lead_minutes = 600, use_practitioners = false;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select tests.ok(public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '18:00'), '先の予約', '0312340004', '') is not null,
  '手動登録は受付可能期間より先の日にも登録できる');

-- メールアドレスの登録・変更
reset role;
update public.app_settings set booking_window_days = 60, min_lead_minutes = 0;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
insert into ids select 'mail', public.admin_save_booking(null, tests.svc('肩こり整体'), tests.at(tests.monday(), '19:00'), 'メール 太郎', '0312340005', '',
  null, null, 'confirmed', 'Mail@Example.com');
select tests.ok((select customer_email = 'mail@example.com' from public.admin_booking_list where id = (select id from ids where k = 'mail')),
  '手動登録でメールアドレスを保存でき、管理用の一覧で読める');
select public.admin_save_booking((select id from ids where k = 'mail'), tests.svc('肩こり整体'), tests.at(tests.monday(), '19:00'), 'メール 太郎', '0312340005', '',
  null, null, 'confirmed', 'new@example.com');
select tests.ok((select customer_email = 'new@example.com' from public.bookings where id = (select id from ids where k = 'mail')),
  'メールアドレスを変更できる');
select tests.throws(
  format($$select public.admin_save_booking(%L, tests.svc('肩こり整体'), tests.at(tests.monday(), '19:00'), 'メール 太郎', '0312340005', '', null, null, 'confirmed', 'bad@')$$,
         (select id from ids where k = 'mail')),
  'INVALID_EMAIL', '手動登録でも形式の正しくないメールアドレスは拒否する');

-- 予約のお知らせメールの送り先（管理者が設定する）
update public.app_settings set notify_emails = array['clinic@example.com', 'staff@example.com'];
select tests.ok((select cardinality(notify_emails) = 2 from public.app_settings), '管理者は通知メールの送り先を設定できる');
select tests.throws($$update public.app_settings set notify_emails = array['not-an-email']$$, 'check', '形式の正しくない送り先は保存できない');
select tests.throws($$update public.app_settings set notify_emails = array['a@x.jp','b@x.jp','c@x.jp','d@x.jp','e@x.jp','f@x.jp']$$, 'check', '送り先は5件まで');
reset role;
update public.app_settings set use_practitioners = false, max_active_bookings_per_phone = 20;
set local role anon;
select tests.ok(
  (select notify_emails = array['clinic@example.com', 'staff@example.com'] and shop_name is not null
   from public.create_booking(tests.svc('肩甲骨はがし'), tests.at(tests.monday(), '09:00'), '通知 確認', '09077770000', '', 'kakunin@example.com')),
  '予約登録の応答に、メール作成用の店舗名と通知の送り先が含まれる');

rollback;
