-- 空き状況と予約登録のルールのテスト（未ログインのお客様として実行）
-- 仕様書 9章のテスト 1〜9 に対応する。
\set QUIET on
\set ON_ERROR_STOP on
begin;
set local role anon;
select tests.logout();

-- 1. メニューの選択：有効なメニューだけが表示される
select tests.ok((select count(*) = 6 from public.get_public_services()), '有効なメニューが6件表示される');
reset role;
update public.services set is_active = false where name = '姿勢改善整体';
set local role anon;
select tests.ok((select count(*) = 5 from public.get_public_services()), '受付停止したメニューは表示されない');
select tests.ok(cardinality(tests.slots('姿勢改善整体', tests.monday())) = 0, '受付停止したメニューには空き時間がない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('姿勢改善整体'), tests.at(tests.monday(), '10:00'), '山田', '09012345678')$$,
  'SERVICE_UNAVAILABLE', '受付停止したメニューは予約できない');

-- 2. 営業時間に基づく空き状況（月曜 9:00〜20:00、最終受付 19:00、昼休み 12:00〜13:00、15分間隔）
select tests.ok((tests.slots('肩こり整体', tests.monday()))[1] = '09:00', '最初の枠は開店時刻');
select tests.ok((tests.slots('肩こり整体', tests.monday()))[2] = '09:15', '枠は15分間隔');
select tests.ok(
  (select s[cardinality(s)] = '19:00' from (select tests.slots('肩こり整体', tests.monday()) s) x),
  '最後の枠は最終受付時刻');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '08:45'), '山田', '09012345678')$$,
  'OUTSIDE_HOURS', '開店前は予約できない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '19:15'), '山田', '09012345678')$$,
  'AFTER_LAST_START', '最終受付時刻より後は予約できない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:05'), '山田', '09012345678')$$,
  'INVALID_TIME', '枠の間隔に合わない時刻は予約できない');

-- 枠の間隔の変更
reset role;
update public.app_settings set slot_interval_minutes = 30;
set local role anon;
select tests.ok((tests.slots('肩こり整体', tests.monday()))[2] = '09:30', '枠の間隔を30分に変更できる');
reset role;
update public.app_settings set slot_interval_minutes = 15;
set local role anon;

-- 3. 休業日の予約防止
select tests.ok(cardinality(tests.slots('肩こり整体', tests.monday() - 1)) = 0, '定休日（日曜）は空き時間がない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday() - 1, '10:00'), '山田', '09012345678')$$,
  'CLOSED', '定休日（日曜）は予約できない');
select tests.ok(
  (select not is_open from public.get_public_open_days(tests.monday() - 1, tests.monday() + 1) where day = tests.monday() - 1),
  '営業日一覧で日曜は休業になる');
reset role;
insert into public.business_date_overrides (business_date, is_closed, note) values (tests.monday() + 1, true, '臨時休業');
insert into public.business_date_overrides (business_date, is_closed, open_time, close_time, note)
  values (tests.monday() + 2, false, '13:00', '16:00', '短縮営業');
set local role anon;
select tests.ok(cardinality(tests.slots('肩こり整体', tests.monday() + 1)) = 0, '臨時休業日は空き時間がない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday() + 1, '10:00'), '山田', '09012345678')$$,
  'CLOSED', '臨時休業日は予約できない');
select tests.ok(
  (select s[1] = '13:00' and s[cardinality(s)] = '15:15' from (select tests.slots('肩こり整体', tests.monday() + 2) s) x),
  '特定の日だけ営業時間を変更できる（13:00〜16:00、40分のメニューは15:15開始が最後）');

-- 4. 昼休みの予約防止
select tests.ok(not ('11:30' = any (tests.slots('肩こり整体', tests.monday()))), '昼休みにかかる枠（11:30〜12:10）は表示されない');
select tests.ok('11:15' = any (tests.slots('肩こり整体', tests.monday())), '昼休みの直前に終わる枠（11:15〜11:55）は表示される');
select tests.ok(not ('12:45' = any (tests.slots('肩こり整体', tests.monday()))), '昼休み中の枠は表示されない');
select tests.ok('13:00' = any (tests.slots('肩こり整体', tests.monday())), '昼休み明けの枠は表示される');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '12:00'), '山田', '09012345678')$$,
  'BREAK', '昼休みには予約できない');
reset role;
insert into public.breaks (break_date, start_time, end_time, label) values (tests.monday(), '16:00', '17:00', '研修');
set local role anon;
select tests.ok(not ('16:00' = any (tests.slots('肩こり整体', tests.monday()))), '特定の日だけの受付停止時間も反映される');

-- 5. メニューごとの施術時間の反映
select tests.ok('11:15' = any (tests.slots('肩甲骨はがし', tests.monday())), '30分メニューは11:15開始（〜11:45）が可能');
select tests.ok('11:30' = any (tests.slots('肩甲骨はがし', tests.monday())), '30分メニューは11:30開始（〜12:00）が可能');
select tests.ok(not ('11:15' = any (tests.slots('慢性痛改善整体', tests.monday()))), '60分メニューは11:15開始（〜12:15）が不可');
select tests.ok(
  (select end_at - start_at = interval '60 minutes'
   from public.create_booking(tests.svc('慢性痛改善整体'), tests.at(tests.monday(), '09:00'), '山田太郎', '090-1234-5678')),
  '予約の終了時刻はメニューの施術時間で決まる');

-- 6. 施術スペースの重複防止（スペースは3つ）
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '09:00'), '佐藤', '09011112222')),
  '同じ時間帯でも別のスペースが空いていれば予約できる（2件目）');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('腰痛整体'), tests.at(tests.monday(), '09:15'), '鈴木', '09011113333')),
  '3件目（時間の一部が重なる）も3つ目のスペースで予約できる');
select tests.ok(not ('09:30' = any (tests.slots('肩こり整体', tests.monday()))), 'すべてのスペースが埋まった時間は表示されない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '09:30'), '高橋', '09011114444')$$,
  'SLOT_UNAVAILABLE', 'すべてのスペースが埋まった時間は予約できない');
select tests.ok('09:45' = any (tests.slots('肩甲骨はがし', tests.monday())), '先の施術が終わればスペースが空く（ベッド2は9:40に空く）');
select tests.ok(not ('09:30' = any (tests.slots('肩甲骨はがし', tests.monday()))), '9:30開始はまだどのスペースも空いていない');

-- メニューが使えるスペースの制限・利用停止
reset role;
insert into public.service_rooms (service_id, room_id) values (tests.svc('骨盤起こし整体'), tests.room('個室1'));
set local role anon;
select tests.ok(not ('09:00' = any (tests.slots('骨盤起こし整体', tests.monday()))), '個室1が埋まっている時間は、個室専用メニューを予約できない');
select tests.ok('10:15' = any (tests.slots('骨盤起こし整体', tests.monday())), '個室1が空いていれば予約できる');
reset role;
update public.rooms set is_active = false where name = '個室1';
set local role anon;
select tests.ok(cardinality(tests.slots('骨盤起こし整体', tests.monday())) = 0, '利用停止したスペースが必要なメニューは予約できない');
select tests.ok('14:00' = any (tests.slots('肩こり整体', tests.monday())), '他のメニューは残りのスペースで予約できる');
reset role;
update public.rooms set is_active = true where name = '個室1';
delete from public.service_rooms;
insert into public.room_hours (room_id, weekday, start_time, end_time) values (tests.room('個室1'), 1, '14:00', '18:00');
update public.rooms set is_active = false where name in ('施術ベッド1', '施術ベッド2');
set local role anon;
select tests.ok(
  (select s[1] = '14:00' from (select tests.slots('肩こり整体', tests.monday()) s) x),
  'スペースの利用可能時間（個室1は月曜14:00〜18:00）が反映される');
reset role;
delete from public.room_hours;
update public.rooms set is_active = true;
set local role anon;

-- 9. キャンセルすると枠が空く／7. 施術者の重複防止
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set local role authenticated;
select public.admin_cancel_booking((select id from public.bookings where customer_name = '佐藤'));
reset role;
set local role anon;
select tests.ok('09:30' = any (tests.slots('肩こり整体', tests.monday())), 'キャンセルした予約の枠は空きに戻る');

reset role;
delete from public.bookings;
update public.app_settings set use_practitioners = true;
insert into public.practitioners (name, sort_order) values ('施術者A', 1), ('施術者B', 2);
set local role anon;
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '客1', '09020000001')),
  '施術者管理あり：1件目');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '客2', '09020000002')),
  '施術者管理あり：2件目（別の施術者）');
reset role;
select tests.ok((select count(distinct practitioner_id) = 2 and count(distinct room_id) = 2 from public.bookings),
  '別々の施術者・スペースが割り当てられる');
set local role anon;
select tests.ok(not ('10:00' = any (tests.slots('肩こり整体', tests.monday()))),
  'スペースが空いていても、施術者が全員埋まっている時間は表示されない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '客3', '09020000003')$$,
  'SLOT_UNAVAILABLE', '施術者が全員埋まっている時間は予約できない');

reset role;
insert into public.practitioner_days_off (practitioner_id, off_date)
  select id, tests.monday() from public.practitioners where name = '施術者B';
insert into public.practitioner_shifts (practitioner_id, weekday, start_time, end_time)
  select id, 1, '09:00', '15:00' from public.practitioners where name = '施術者A';
set local role anon;
select tests.ok(not ('15:00' = any (tests.slots('肩こり整体', tests.monday()))), '出勤時間外（Aは15時まで、Bは休み）は表示されない');
select tests.ok('14:00' = any (tests.slots('肩こり整体', tests.monday())), '出勤時間内は表示される（14:00〜14:40）');
reset role;
delete from public.practitioner_days_off;
delete from public.practitioner_shifts;
insert into public.practitioner_services (practitioner_id, service_id)
  select id, tests.svc('肩甲骨はがし') from public.practitioners where name = '施術者B';
set local role anon;
select tests.ok(cardinality(tests.slots('慢性痛改善整体', tests.monday())) > 0, '対応メニュー未設定の施術者Aは全メニューに対応');
reset role;
update public.practitioners set is_active = false where name = '施術者A';
set local role anon;
select tests.ok(cardinality(tests.slots('慢性痛改善整体', tests.monday())) = 0, '対応できる施術者がいないメニューは予約できない');
select tests.ok(cardinality(tests.slots('肩甲骨はがし', tests.monday())) > 0, '対応できる施術者がいるメニューは予約できる');
reset role;
update public.practitioners set is_active = true;
delete from public.practitioner_services;
update public.app_settings set use_practitioners = false;
delete from public.bookings;

-- 受付可能期間・直前受付
reset role;
update public.app_settings set booking_window_days = 3, min_lead_minutes = 60;
set local role anon;
select tests.ok(cardinality(tests.slots('肩こり整体', tests.monday())) = 0, '受付可能期間より先の日は空き時間がない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '山田', '09012345678')$$,
  'TOO_FAR', '受付可能期間より先の日は予約できない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), date_trunc('hour', now()) + interval '15 minutes', '山田', '09012345678')$$,
  null, '直前・過去の時刻は予約できない');
reset role;
update public.app_settings set booking_window_days = 60, min_lead_minutes = 0, max_active_bookings_per_phone = 2;
set local role anon;

-- 入力値の検証・いたずら対策
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '  ', '09012345678')$$,
  'INVALID_NAME', '氏名が空なら予約できない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '山田', '12345')$$,
  'INVALID_PHONE', '電話番号の形式が不正なら予約できない');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '山田', '09012345678', repeat('あ', 501))$$,
  'INVALID_NOTES', '備考が長すぎると予約できない');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), '山田', '０９０－１２３４－５６７８')),
  '全角の電話番号も受け付ける');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'), '山田', '09012345678')),
  '同じ電話番号の2件目');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '14:00'), '山田', '090-1234-5678')$$,
  'TOO_MANY_BOOKINGS', '1つの電話番号で持てる予約数の上限を超えると予約できない');
reset role;
select tests.ok((select bool_and(customer_phone = '09012345678') from public.bookings), '電話番号は数字だけで保存される');
select tests.ok((select bool_and(booking_number ~ '^[0-9]{6}-[A-Z2-9]{4}$') from public.bookings), '予約番号が付く');

-- メールアドレス（任意）
reset role;
delete from public.bookings;
update public.app_settings set max_active_bookings_per_phone = 20;
set local role anon;
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '10:00'), 'メール 有り', '09030000001', '', '  Taro.Yamada@Example.JP ')),
  'メールアドレス付きで予約できる');
select tests.ok(
  (select count(*) = 1 from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '11:00'), 'メール 無し', '09030000002', '')),
  'メールアドレスの引数を省略した呼び出し（更新前のアプリ）は受け付ける');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '13:00'), '山田', '09030000003', '', '')$$,
  'EMAIL_REQUIRED', 'WEB 予約ではメールアドレスが空欄なら拒否する');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '13:00'), '山田', '09030000003', '', '   ')$$,
  'EMAIL_REQUIRED', 'WEB 予約では空白だけのメールアドレスも拒否する');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '13:00'), '山田', '09030000003', '', 'not-an-email')$$,
  'INVALID_EMAIL', '形式の正しくないメールアドレスは拒否する');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '13:00'), '山田', '09030000003', '', 'a b@example.com')$$,
  'INVALID_EMAIL', '空白を含むメールアドレスは拒否する');
select tests.throws(
  $$select * from public.create_booking(tests.svc('肩こり整体'), tests.at(tests.monday(), '13:00'), '山田', '09030000003', '', repeat('a', 250) || '@example.com')$$,
  'INVALID_EMAIL', '長すぎるメールアドレスは拒否する');
reset role;
select tests.ok((select customer_email = 'taro.yamada@example.jp' from public.bookings where customer_name = 'メール 有り'),
  'メールアドレスは小文字・前後の空白なしで保存される');
select tests.ok((select customer_email = '' from public.bookings where customer_name = 'メール 無し'),
  'メールアドレスなしの予約は空欄で保存される');

rollback;
