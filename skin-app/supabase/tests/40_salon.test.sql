-- 第4段階-2：サロン向けの機能の RLS テスト（10_rls.test.sql の tests スキーマと利用者を使う）
--   管理者 …0a、スタッフ1 …51（顧客1の担当）、スタッフ4 …54（顧客4の担当）、一般ユーザー1 …01
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- テスト用データ（postgres として作成）
-- スタッフ1は 10_rls.test.sql で停止されているため、有効に戻す
update public.profiles set is_active = true where id = '00000000-0000-0000-0000-000000000051';
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000054', 'staff4@example.test');
update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000054';
insert into public.customers (id, full_name) values ('c0000000-0000-0000-0000-000000000004', '顧客 四');
insert into public.customer_assignments (staff_id, customer_id) values
  ('00000000-0000-0000-0000-000000000054', 'c0000000-0000-0000-0000-000000000004');
insert into public.treatment_menus (id, name, price_yen, is_active, updated_by) values
  ('d0000000-0000-0000-0000-000000000001', 'フェイシャル', 8000, true, '00000000-0000-0000-0000-00000000000a'),
  ('d0000000-0000-0000-0000-000000000002', '休止中のメニュー', 5000, false, '00000000-0000-0000-0000-00000000000a');
insert into public.photo_sessions (id, customer_id, captured_by) values
  ('5e000000-0000-0000-0000-0000000000b1', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000051'),
  ('5e000000-0000-0000-0000-0000000000b2', 'c0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000054');

-- =====================================================================
-- 施術メニュー
-- =====================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok(tests.rows('select * from public.treatment_menus') = 2, '管理者は休止中を含むすべてのメニューを見られる');
select tests.ok(tests.rows($$insert into public.treatment_menus (name, price_yen, updated_by)
  values ('ピーリング', 6000, auth.uid())$$) = 1, '管理者はメニューを追加できる');
select tests.throws($$insert into public.treatment_menus (name, price_yen, updated_by)
  values ('マイナス', -1, auth.uid())$$, '料金はマイナスにできない');
select tests.ok(tests.rows($$update public.treatment_menus set price_yen = 8800, updated_by = auth.uid()
  where id = 'd0000000-0000-0000-0000-000000000001'$$) = 1, '管理者は料金を変更できる');
select tests.throws($$update public.treatment_menus set created_at = now()$$, '作成日時は変更できない');
reset role;
select tests.ok(exists (select 1 from public.audit_logs where action = 'menu.update'
  and (metadata ->> 'previous_price_yen')::int = 8000 and (metadata ->> 'price_yen')::int = 8800),
  '料金の変更が監査ログに残る（前後の料金）');

select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows('select * from public.treatment_menus') = 2, 'スタッフは有効なメニューだけ見られる');
select tests.throws($$insert into public.treatment_menus (name, price_yen, updated_by)
  values ('勝手なメニュー', 1, auth.uid())$$, 'スタッフはメニューを追加できない');
select tests.ok(tests.rows($$update public.treatment_menus set price_yen = 1, updated_by = auth.uid()$$) = 0,
  'スタッフは料金を変更できない');
select tests.ok(tests.rows('delete from public.treatment_menus') = 0, 'スタッフはメニューを削除できない');
reset role;

select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select tests.ok(tests.rows('select * from public.treatment_menus') = 0, '一般ユーザーはメニューを見られない');
reset role;

-- =====================================================================
-- 来店・問診・カウンセリング・施術・案内文（スタッフ1、顧客1）
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows($$insert into public.visits (id, customer_id, staff_id)
  values ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', auth.uid())$$) = 1,
  '担当の顧客の来店を記録できる');
select tests.throws($$insert into public.visits (customer_id, staff_id)
  values ('c0000000-0000-0000-0000-000000000004', auth.uid())$$, '担当でない顧客の来店は記録できない');
select tests.throws($$insert into public.visits (customer_id, staff_id)
  values ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000054')$$,
  '来店の担当者を他人にはできない');
select tests.throws($$update public.visits set customer_id = 'c0000000-0000-0000-0000-000000000004'$$,
  '来店の顧客は付け替えられない');
select tests.ok(tests.rows($$update public.visits set next_visit_memo = '次回は保湿の相談'
  where id = 'e0000000-0000-0000-0000-000000000001'$$) = 1, '次回来店メモを保存できる');

select tests.ok(tests.rows($$insert into public.intake_forms (visit_id, form_version, answers, skin_condition_under_treatment)
  values ('e0000000-0000-0000-0000-000000000001', 'v1', '{"concerns":["乾燥"]}', true)$$) = 1, '問診を記録できる');
select tests.throws($$insert into public.intake_forms (visit_id, form_version, answers)
  values ('e0000000-0000-0000-0000-000000000001', 'v1', '[]')$$, '問診は1来店に1つ');
select tests.ok(tests.rows($$insert into public.counseling_sheets (visit_id, concerns)
  values ('e0000000-0000-0000-0000-000000000001', '毛穴が気になる')$$) = 1, 'カウンセリングシートを記録できる');
select tests.throws($$update public.counseling_sheets set visit_id = gen_random_uuid()$$, 'シートの来店は付け替えられない');

select tests.ok(tests.rows($$insert into public.treatments (visit_id, menu_id, menu_name_snapshot, price_yen_snapshot,
    before_session_id, created_by)
  values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '偽の名前', 1,
    '5e000000-0000-0000-0000-0000000000b1', auth.uid())$$) = 1, '施術を記録できる');
reset role;
select tests.ok((select menu_name_snapshot = 'フェイシャル' and price_yen_snapshot = 8800 from public.treatments
  where visit_id = 'e0000000-0000-0000-0000-000000000001'), '施術にはメニューの現在の名前と料金が記録される');
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.throws($$insert into public.treatments (visit_id, menu_id, created_by)
  values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', auth.uid())$$,
  '休止中のメニューは記録できない');
select tests.throws($$update public.treatments set after_session_id = '5e000000-0000-0000-0000-0000000000b2'$$,
  '施術の前後比較に、他の顧客の撮影は使えない');
select tests.throws($$update public.treatments set price_yen_snapshot = 0$$, '記録した料金は書き換えられない');

select tests.ok(tests.rows($$insert into public.care_proposals (visit_id, menu_ids, draft_text, final_text, generated_by, status, created_by)
  values ('e0000000-0000-0000-0000-000000000001', '{d0000000-0000-0000-0000-000000000001}', '下書き', '', 'mock', 'draft', auth.uid())$$) = 1,
  '施術案内の下書きを保存できる');
select tests.throws($$update public.care_proposals set status = 'approved'$$, '確定文が空のままでは承認できない');
select tests.ok(tests.rows($$update public.care_proposals set final_text = '確定した文', status = 'approved'$$) = 1,
  '確定文を入れて承認できる');
reset role;
select tests.ok((select approved_by = '00000000-0000-0000-0000-000000000051' and approved_at is not null
  from public.care_proposals where visit_id = 'e0000000-0000-0000-0000-000000000001'), '承認した人と日時が記録される');
select tests.ok(exists (select 1 from public.audit_logs where action = 'proposal.approve'), '承認が監査ログに残る');
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.throws($$update public.care_proposals set approved_by = '00000000-0000-0000-0000-000000000054'$$,
  '承認者は書き換えられない');
select tests.ok(tests.rows('delete from public.visits') = 0, 'スタッフは来店を削除できない');
reset role;

-- スタッフ4（顧客1の担当ではない）
select tests.login('00000000-0000-0000-0000-000000000054');
set role authenticated;
select tests.ok(tests.rows('select * from public.visits') = 0, '担当でない顧客の来店は見えない');
select tests.ok(tests.rows('select * from public.intake_forms') = 0, '担当でない顧客の問診は見えない');
select tests.ok(tests.rows('select * from public.counseling_sheets') = 0, '担当でない顧客のカウンセリングは見えない');
select tests.ok(tests.rows('select * from public.treatments') = 0, '担当でない顧客の施術履歴は見えない');
select tests.ok(tests.rows('select * from public.care_proposals') = 0, '担当でない顧客の施術案内は見えない');
select tests.throws($$insert into public.intake_forms (visit_id, form_version) values ('e0000000-0000-0000-0000-000000000001', 'v1')$$,
  '担当でない顧客の来店に問診を書けない');
select tests.ok(tests.rows($$update public.visits set next_visit_memo = 'x'$$) = 0, '担当でない顧客の来店メモを変更できない');
select tests.throws('select public.visit_customer(''e0000000-0000-0000-0000-000000000001'')',
  '来店の顧客を調べる関数は直接使えない');
reset role;

-- 一般ユーザー
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select tests.ok(tests.rows('select * from public.visits') = 0, '一般ユーザーは来店記録を見られない');
select tests.throws($$insert into public.visits (customer_id, staff_id)
  values ('c0000000-0000-0000-0000-000000000001', auth.uid())$$, '一般ユーザーは来店を記録できない');
reset role;

-- 未ログイン
set role anon;
select tests.throws('select * from public.visits', '未ログインは来店記録を読めない');
select tests.throws('select * from public.treatment_menus', '未ログインはメニューを読めない');
reset role;

-- 来店と撮影の顧客の一致
select tests.throws($$insert into public.photo_sessions (customer_id, visit_id, captured_by)
  values ('c0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000054')$$, '他の顧客の来店に撮影をひも付けられない');
select tests.ok(tests.rows($$insert into public.photo_sessions (customer_id, visit_id, captured_by)
  values ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000051')$$) = 1, '同じ顧客の来店には撮影をひも付けられる');

-- =====================================================================
-- 機器の実測値
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows($$insert into public.device_measurements (customer_id, visit_id, device_name, metric, value, unit, recorded_by)
  values ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '測定器A', '水分量', 42.5, '%', auth.uid())$$) = 1,
  '担当の顧客の実測値を記録できる');
select tests.throws($$insert into public.device_measurements (customer_id, device_name, metric, value, recorded_by)
  values ('c0000000-0000-0000-0000-000000000004', '測定器A', '水分量', 40, auth.uid())$$, '担当でない顧客の実測値は記録できない');
select tests.throws($$insert into public.device_measurements (customer_id, visit_id, device_name, metric, value, recorded_by)
  values ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000ff', '測定器A', '水分量', 40, auth.uid())$$,
  '存在しない来店にはひも付けられない');
select tests.throws($$update public.device_measurements set value = 99$$, '実測値は書き換えられない');
reset role;
select tests.login('00000000-0000-0000-0000-000000000054');
set role authenticated;
select tests.ok(tests.rows('select * from public.device_measurements') = 0, '担当でない顧客の実測値は見えない');
select tests.ok(tests.rows('delete from public.device_measurements') = 0, '担当でない顧客の実測値は削除できない');
reset role;
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows('delete from public.device_measurements') = 1, '記録した人は実測値を削除できる');
reset role;

-- =====================================================================
-- 利用状況の集計（管理者だけ）
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.throws('select * from public.admin_usage_daily(30)', 'スタッフは利用状況の集計を使えない');
select tests.throws('select * from public.admin_usage_by_staff(30)', 'スタッフはスタッフ別の集計を使えない');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok((select count(*) = 7 from public.admin_usage_daily(7)), '管理者は日別の集計を使える（7日分）');
select tests.ok((select sum(visits) >= 1 from public.admin_usage_daily(7)), '日別の集計に来店数が含まれる');
select tests.ok((select visits = 1 from public.admin_usage_by_staff(30) where staff_id = '00000000-0000-0000-0000-000000000051'),
  'スタッフ別の来店数を数えられる');
select tests.ok(not exists (select 1 from public.admin_usage_by_staff(30) where role = 'user'), 'スタッフ別の集計に一般ユーザーは含まれない');

-- 来店の削除（管理者）で、問診・カウンセリング・施術・案内文も削除される
select tests.ok(tests.rows($$delete from public.visits where id = 'e0000000-0000-0000-0000-000000000001'$$) = 1,
  '管理者は来店を削除できる');
reset role;
select tests.ok(not exists (select 1 from public.intake_forms) and not exists (select 1 from public.counseling_sheets)
  and not exists (select 1 from public.treatments) and not exists (select 1 from public.care_proposals),
  '来店の削除で関連する記録も削除される');
select tests.ok(exists (select 1 from public.photo_sessions where id = '5e000000-0000-0000-0000-0000000000b1'),
  '来店を削除しても撮影は残る');
