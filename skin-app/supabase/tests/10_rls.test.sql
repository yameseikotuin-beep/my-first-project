-- RLS（行レベルセキュリティ）と権限のテスト
-- 3つの役割（一般ユーザー・スタッフ・管理者）と未ログインで、見られるもの・できることを確認する。
\set QUIET on
\pset tuples_only on
\pset format unaligned

create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false)
$$;

create function tests.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAIL: %', label;
  end if;
  raise notice 'ok - %', label;
end $$;

-- SQL を実行し、影響した／返した行数を返す（呼び出した人の権限で実行される）
create function tests.rows(query text) returns integer language plpgsql as $$
declare n integer;
begin
  if query ~* '^\s*select' then
    execute format('select count(*) from (%s) q', query) into n;
  else
    execute query;
    get diagnostics n = row_count;
  end if;
  return n;
end $$;

-- SQL がエラーになることを確認する
create function tests.throws(query text, label text) returns void language plpgsql as $$
begin
  begin
    execute query;
  exception when others then
    raise notice 'ok - % (拒否: %)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL: % (エラーにならなかった)', label;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------
-- テスト用データ（postgres として作成）
-- ---------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.test', '{"display_name":"管理者"}'),
  ('00000000-0000-0000-0000-000000000051', 'staff1@example.test', '{"display_name":"スタッフ1"}'),
  ('00000000-0000-0000-0000-000000000052', 'staff2@example.test', '{"display_name":"スタッフ2"}'),
  ('00000000-0000-0000-0000-000000000001', 'user1@example.test', '{"display_name":"利用者1","adult_confirmed":"true"}'),
  ('00000000-0000-0000-0000-000000000002', 'user2@example.test', '{"display_name":"利用者2"}'),
  ('00000000-0000-0000-0000-000000000099', 'sneaky@example.test', '{"role":"admin"}');

select tests.ok((select count(*) = 6 from public.profiles), '新規登録で profiles が自動作成される');
select tests.ok((select bool_and(role = 'user') from public.profiles), '新規登録の役割は常に user（metadata の role は無視）');
select tests.ok((select adult_confirmed_at is not null from public.profiles where id = '00000000-0000-0000-0000-000000000001'),
  '18歳以上の確認日時が記録される');

update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set role = 'staff' where id in ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000052');

insert into public.customers (id, full_name, full_name_kana) values
  ('c0000000-0000-0000-0000-000000000001', '顧客 一', 'こきゃく いち'),
  ('c0000000-0000-0000-0000-000000000002', '顧客 二', 'こきゃく に');
insert into public.customer_assignments (staff_id, customer_id) values
  ('00000000-0000-0000-0000-000000000051', 'c0000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000052', 'c0000000-0000-0000-0000-000000000002');

-- 同意文の ID（種類ごと）
create table tests.docs as select kind, id from public.consent_documents;
grant select on tests.docs to authenticated;

-- =====================================================================
-- 未ログイン（anon）
-- =====================================================================
set role anon;
select tests.throws('select * from public.customers', '未ログインは顧客を読めない');
select tests.throws('select * from public.profiles', '未ログインは利用者情報を読めない');
select tests.throws('select * from public.consent_documents', '未ログインは同意文テーブルを直接読めない');
select tests.ok(tests.rows('select * from storage.objects') = 0, '未ログインは写真ファイルを読めない');
reset role;

-- =====================================================================
-- 一般ユーザー1
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;

select tests.ok(tests.rows('select * from public.profiles') = 1, '一般ユーザーは自分の profiles だけ見える');
select tests.throws($$update public.profiles set role = 'admin' where id = auth.uid()$$, '一般ユーザーは自分の役割を変えられない');
select tests.throws($$update public.profiles set is_active = false where id = auth.uid()$$, '一般ユーザーは有効状態を変えられない');
select tests.ok(tests.rows($$update public.profiles set display_name = 'あたらしい名前' where id = auth.uid()$$) = 1, '表示名は変えられる');
select tests.ok(tests.rows($$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-000000000002'$$) = 0, '他人の表示名は変えられない');
select tests.ok(tests.rows('select * from public.customers') = 0, '一般ユーザーは顧客台帳を見られない');
select tests.ok(tests.rows('select * from public.customer_assignments') = 0, '一般ユーザーは担当割当を見られない');
select tests.throws($$select public.create_customer('勝手な顧客')$$, '一般ユーザーは顧客を登録できない');
select tests.throws($$insert into public.customers (full_name) values ('直接登録')$$, '顧客の直接登録はできない');
select tests.ok(tests.rows('select * from public.audit_logs') = 0, '一般ユーザーは監査ログを見られない');
select tests.throws($$insert into public.audit_logs (action) values ('fake.entry')$$, '監査ログに直接書き込めない');
select tests.throws($$select public.admin_update_member(auth.uid(), 'admin', true)$$, '一般ユーザーは管理者用の関数を使えない');

-- 同意なしでは撮影セッションを作れない
select tests.throws($$insert into public.photo_sessions (id, user_id, captured_by)
  values ('5e000000-0000-0000-0000-000000000001', auth.uid(), auth.uid())$$, '同意がないと撮影セッションを作れない');

-- 同意
select tests.throws($$insert into public.consents (user_id, document_id, kind, method, recorded_by)
  select '00000000-0000-0000-0000-000000000002', id, kind, 'self_app', auth.uid() from tests.docs where kind = 'photo_capture'$$,
  '他人の同意を登録できない');
select tests.throws($$insert into public.consents (user_id, document_id, kind, method, recorded_by)
  select auth.uid(), id, kind, 'salon_tablet', auth.uid() from tests.docs where kind = 'photo_capture'$$,
  '一般ユーザーはサロン用の方法で同意を登録できない');
select tests.throws($$insert into public.consents (user_id, document_id, kind, method, recorded_by)
  select auth.uid(), d.id, 'photo_storage', 'self_app', auth.uid() from tests.docs d where d.kind = 'photo_capture'$$,
  '同意文と種類が一致しない同意は登録できない');
select tests.ok(tests.rows($$insert into public.consents (user_id, document_id, kind, method, recorded_by)
  select auth.uid(), id, kind, 'self_app', auth.uid() from tests.docs where kind in ('photo_capture', 'photo_storage')$$) = 2,
  '自分の撮影・保存の同意を登録できる');

-- 撮影セッションと写真
select tests.throws($$insert into public.photo_sessions (user_id, captured_by)
  values ('00000000-0000-0000-0000-000000000002', auth.uid())$$, '他人の撮影セッションは作れない');
select tests.ok(tests.rows($$insert into public.photo_sessions (id, user_id, captured_by)
  values ('5e000000-0000-0000-0000-000000000001', auth.uid(), auth.uid())$$) = 1, '同意があれば自分の撮影セッションを作れる');
select tests.throws($$insert into public.photo_sessions (customer_id, captured_by)
  values ('c0000000-0000-0000-0000-000000000001', auth.uid())$$, '一般ユーザーは顧客の撮影セッションを作れない');

select tests.ok(tests.rows($$insert into storage.objects (bucket_id, name) values ('face-photos',
  'self/00000000-0000-0000-0000-000000000001/5e000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000001.jpg')$$) = 1,
  '決まった場所に写真ファイルを保存できる');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('face-photos',
  'self/00000000-0000-0000-0000-000000000002/5e000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000009.jpg')$$,
  '他人のフォルダには保存できない');
select tests.throws($$insert into storage.objects (bucket_id, name) values ('face-photos',
  'self/00000000-0000-0000-0000-000000000001/5e000000-0000-0000-0000-000000000001/../x.jpg')$$,
  'おかしなパスには保存できない');
select tests.ok(tests.rows($$insert into public.photos (id, session_id, angle, storage_path, width, height, quality_passed, device_class)
  values ('f0000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001', 'front',
  'self/00000000-0000-0000-0000-000000000001/5e000000-0000-0000-0000-000000000001/f0000000-0000-0000-0000-000000000001.jpg',
  1024, 1365, true, 'phone')$$) = 1, '写真の情報を登録できる');
select tests.throws($$insert into public.photos (id, session_id, angle, storage_path, width, height, quality_passed, device_class)
  values ('f0000000-0000-0000-0000-000000000002', '5e000000-0000-0000-0000-000000000001', 'left',
  'self/00000000-0000-0000-0000-000000000002/elsewhere.jpg', 10, 10, true, 'phone')$$, '保存場所が決まりと違う写真は登録できない');
select tests.throws($$update public.photos set storage_path = 'x' $$, '写真の情報は書き換えられない');

-- 監査ログは関数経由でのみ書ける（操作者は自動で設定される）
select public.write_audit_log('photo.view', 'photos', 'f0000000-0000-0000-0000-000000000001');

select tests.ok(public.has_active_consent('00000000-0000-0000-0000-000000000002', null, 'photo_capture') = false
  and tests.rows($$select 1 where public.photo_storage_path('5e000000-0000-0000-0000-0000000000c1', gen_random_uuid()) is not null$$) = 0,
  '権限判定の関数から他人の情報を調べられない');

-- 同意の撤回
select tests.throws($$update public.consents set kind = 'ai_processing' where user_id = auth.uid()$$, '同意の種類は書き換えられない');
select tests.throws($$delete from public.consents where user_id = auth.uid()$$, '同意の記録は削除できない');
select tests.ok(tests.rows($$update public.consents set revoked_at = now() where user_id = auth.uid() and kind = 'photo_storage'$$) = 1,
  '同意を撤回できる');
select tests.ok(tests.rows($$update public.consents set revoked_at = null where user_id = auth.uid() and kind = 'photo_storage'$$) = 0,
  '撤回を取り消すことはできない（新しく同意し直す）');
select tests.throws($$insert into public.photo_sessions (user_id, captured_by) values (auth.uid(), auth.uid())$$,
  '保存の同意を撤回したら新しい撮影セッションを作れない');
reset role;

-- =====================================================================
-- 一般ユーザー2：ユーザー1の情報は一切見えない
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000002');
set role authenticated;
select tests.ok(tests.rows('select * from public.profiles') = 1, '他人の profiles は見えない');
select tests.ok(tests.rows('select * from public.photo_sessions') = 0, '他人の撮影セッションは見えない');
select tests.ok(tests.rows('select * from public.photos') = 0, '他人の写真の情報は見えない');
select tests.ok(tests.rows('select * from public.consents') = 0, '他人の同意は見えない');
select tests.ok(tests.rows('select * from storage.objects') = 0, '他人の写真ファイルは見えない');
select tests.ok(tests.rows('delete from public.photos') = 0, '他人の写真の情報は削除できない');
select tests.ok(tests.rows('delete from storage.objects') = 0, '他人の写真ファイルは削除できない');
select tests.ok(tests.rows('delete from public.photo_sessions') = 0, '他人の撮影セッションは削除できない');
reset role;

-- =====================================================================
-- スタッフ1（顧客1の担当）
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows('select * from public.customers') = 1, 'スタッフは担当の顧客だけ見える');
select tests.ok(tests.rows('select * from public.profiles') = 1, 'スタッフは他の利用者の profiles を見られない');
select tests.ok(tests.rows('select * from public.photo_sessions') = 0, 'スタッフは一般ユーザーのセルフ撮影を見られない');
select tests.ok(tests.rows('select * from storage.objects') = 0, 'スタッフは一般ユーザーの写真ファイルを見られない');
select tests.ok(tests.rows($$update public.customers set notes = '更新' where id = 'c0000000-0000-0000-0000-000000000001'$$) = 1,
  '担当の顧客は更新できる');
select tests.ok(tests.rows($$update public.customers set notes = '更新' where id = 'c0000000-0000-0000-0000-000000000002'$$) = 0,
  '担当でない顧客は更新できない');
select tests.throws($$update public.customers set created_by = auth.uid()$$, '顧客の作成者は書き換えられない');
select tests.ok(tests.rows($$delete from public.customers$$) = 0, 'スタッフは顧客を削除できない');
select tests.throws($$insert into public.customer_assignments (staff_id, customer_id, granted_by)
  values (auth.uid(), 'c0000000-0000-0000-0000-000000000002', auth.uid())$$, 'スタッフは自分で担当を追加できない');
select tests.throws($$select public.admin_update_member(auth.uid(), 'admin', true)$$, 'スタッフは管理者用の関数を使えない');

-- 顧客の登録：登録したスタッフが自動で担当になる
create temp table new_customer as select public.create_customer('新規 顧客', 'しんき こきゃく') as id;
select tests.ok(tests.rows('select * from public.customers') = 2, '登録した顧客は自動で担当になり見える');

-- サロンでの同意と撮影
select tests.throws($$insert into public.consents (customer_id, document_id, kind, method, recorded_by)
  select 'c0000000-0000-0000-0000-000000000002', id, kind, 'salon_tablet', auth.uid() from tests.docs where kind = 'photo_capture'$$,
  '担当でない顧客の同意は登録できない');
select tests.ok(tests.rows($$insert into public.consents (customer_id, document_id, kind, method, recorded_by)
  select 'c0000000-0000-0000-0000-000000000001', id, kind, 'salon_tablet', auth.uid() from tests.docs
  where kind in ('photo_capture', 'photo_storage')$$) = 2, '担当の顧客の同意を登録できる');
select tests.ok(tests.rows($$insert into public.photo_sessions (id, customer_id, captured_by)
  values ('5e000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-000000000001', auth.uid())$$) = 1,
  '同意のある担当顧客の撮影セッションを作れる');
select tests.throws($$insert into public.photo_sessions (customer_id, captured_by)
  values ((select id from new_customer), auth.uid())$$, '同意のない顧客の撮影セッションは作れない');
select tests.throws($$insert into public.photo_sessions (user_id, captured_by) values (auth.uid(), auth.uid())$$,
  'スタッフのアカウントではセルフ撮影はできない');
select tests.ok(tests.rows($$insert into storage.objects (bucket_id, name) values ('face-photos',
  'salon/c0000000-0000-0000-0000-000000000001/5e000000-0000-0000-0000-0000000000c1/f0000000-0000-0000-0000-0000000000c1.jpg')$$) = 1,
  '担当顧客の写真ファイルを保存できる');
select tests.ok(tests.rows($$insert into public.photos (id, session_id, angle, storage_path, width, height, quality_passed, device_class)
  values ('f0000000-0000-0000-0000-0000000000c1', '5e000000-0000-0000-0000-0000000000c1', 'front',
  'salon/c0000000-0000-0000-0000-000000000001/5e000000-0000-0000-0000-0000000000c1/f0000000-0000-0000-0000-0000000000c1.jpg',
  1024, 1365, true, 'tablet')$$) = 1, '担当顧客の写真の情報を登録できる');
select tests.ok(tests.rows('delete from public.photo_sessions') = 0, 'スタッフは顧客の撮影セッションをまとめて削除できない');
reset role;

-- =====================================================================
-- スタッフ2（顧客2の担当）：顧客1の情報は見えない
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000052');
set role authenticated;
select tests.ok(tests.rows('select * from public.customers') = 1, 'スタッフ2は自分の担当顧客だけ見える');
select tests.ok(tests.rows('select * from public.photo_sessions') = 0, '担当でない顧客の撮影セッションは見えない');
select tests.ok(tests.rows('select * from public.photos') = 0, '担当でない顧客の写真の情報は見えない');
select tests.ok(tests.rows('select * from storage.objects') = 0, '担当でない顧客の写真ファイルは見えない');
select tests.ok(tests.rows('select * from public.consents') = 0, '担当でない顧客の同意は見えない');
reset role;

-- =====================================================================
-- 管理者
-- =====================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok(tests.rows('select * from public.customers') = 3, '管理者は全顧客を見られる');
select tests.ok(tests.rows('select * from public.profiles') = 6, '管理者は全利用者を見られる');
select tests.ok(tests.rows('select * from public.photo_sessions where user_id is not null') = 0,
  '管理者も一般ユーザーのセルフ撮影は見られない');
select tests.ok(tests.rows('select * from public.audit_logs') > 0, '管理者は監査ログを見られる');
select tests.ok(tests.rows($$select * from public.audit_logs where action = 'photo.view'
  and actor_id = '00000000-0000-0000-0000-000000000001'$$) = 1, '監査ログの操作者は自動で正しく記録される');
select tests.ok(tests.rows($$select * from public.audit_logs where action = 'customer.create'$$) >= 1, '顧客の登録が監査ログに残る');
select tests.ok(tests.rows($$select * from public.audit_logs where action = 'photo.upload'$$) = 2, '写真のアップロードが監査ログに残る');
select tests.throws('delete from public.audit_logs', '管理者も監査ログを削除できない');
select tests.throws($$update public.audit_logs set action = 'x.y'$$, '管理者も監査ログを書き換えられない');

select tests.throws($$insert into public.customer_assignments (staff_id, customer_id, granted_by)
  values ('00000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', auth.uid())$$,
  'スタッフでない利用者を担当にはできない');
select tests.ok(tests.rows($$insert into public.customer_assignments (staff_id, customer_id, granted_by)
  values ('00000000-0000-0000-0000-000000000052', 'c0000000-0000-0000-0000-000000000001', auth.uid())$$) = 1,
  '管理者はスタッフに担当を割り当てられる');
select tests.throws($$select public.admin_update_member(auth.uid(), 'staff', true)$$, '管理者は自分の管理者権限を外せない');
select public.admin_update_member('00000000-0000-0000-0000-000000000051', 'staff', false);
select tests.ok(tests.rows($$select * from public.audit_logs where action = 'profile.update'
  and target_id = '00000000-0000-0000-0000-000000000051' and actor_id = auth.uid()$$) = 1, '役割・有効状態の変更が監査ログに残る');
select tests.throws($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001'$$,
  '管理者でも役割は関数経由でしか変えられない');
select tests.ok(tests.rows($$delete from public.customers where id = 'c0000000-0000-0000-0000-000000000002'$$) = 1,
  '管理者は顧客を削除できる');
reset role;

-- 割り当て後のスタッフ2は顧客1を見られる
select tests.login('00000000-0000-0000-0000-000000000052');
set role authenticated;
select tests.ok(tests.rows('select * from public.customers') = 1, '割り当て後は顧客1が見え、削除された顧客2は見えない');
select tests.ok(tests.rows('select * from storage.objects') = 1, '割り当て後は顧客1の写真ファイルが見える');
reset role;

-- 停止されたスタッフ1は何も見えない
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.ok(tests.rows('select * from public.customers') = 0, '停止されたスタッフは顧客を見られない');
select tests.ok(tests.rows('select * from storage.objects') = 0, '停止されたスタッフは写真ファイルを見られない');
select tests.throws($$select public.create_customer('停止中の登録')$$, '停止されたスタッフは顧客を登録できない');
reset role;

-- 一般ユーザー1：自分の撮影を削除できる（写真の情報も一緒に消える）
select tests.login('00000000-0000-0000-0000-000000000001');
set role authenticated;
select tests.ok(tests.rows('delete from storage.objects') = 1, '自分の写真ファイルを削除できる');
select tests.ok(tests.rows('delete from public.photo_sessions') = 1, '自分の撮影セッションを削除できる');
select tests.ok(tests.rows('select * from public.photos') = 0, '撮影セッションと一緒に写真の情報も削除される');
reset role;
