-- 第3段階：分析結果・AI 利用回数の RLS テスト（10_rls.test.sql の tests スキーマを使う）
\set QUIET on
\pset tuples_only on
\pset format unaligned

-- テスト用データ（postgres として作成）
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000003', 'user3@example.test'),
  ('00000000-0000-0000-0000-000000000004', 'user4@example.test'),
  ('00000000-0000-0000-0000-000000000053', 'staff3@example.test');
update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000053';
insert into public.customers (id, full_name) values ('c0000000-0000-0000-0000-000000000003', '顧客 三');
insert into public.customer_assignments (staff_id, customer_id) values
  ('00000000-0000-0000-0000-000000000053', 'c0000000-0000-0000-0000-000000000003');
insert into public.photo_sessions (id, user_id, captured_by) values
  ('5e000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'),
  ('5e000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
insert into public.photo_sessions (id, customer_id, captured_by) values
  ('5e000000-0000-0000-0000-0000000000c3', 'c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000053');

-- =====================================================================
-- 一般ユーザー3
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000003');
set role authenticated;

select tests.ok(tests.rows($$insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by)
  values ('a0000000-0000-0000-0000-000000000003', '5e000000-0000-0000-0000-000000000003', 'completed', 'mock', '0.1.0', auth.uid())$$) = 1,
  '自分の撮影の分析結果を登録できる');
select tests.throws($$insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by)
  values (gen_random_uuid(), '5e000000-0000-0000-0000-000000000004', 'completed', 'mock', '0.1.0', auth.uid())$$,
  '他人の撮影の分析結果は登録できない');
select tests.throws($$insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by)
  values (gen_random_uuid(), '5e000000-0000-0000-0000-000000000003', 'completed', 'mock', '0.1.0',
          '00000000-0000-0000-0000-000000000004')$$,
  '登録者を他人にはできない');
select tests.throws($$insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by)
  values (gen_random_uuid(), '5e000000-0000-0000-0000-0000000000c3', 'completed', 'mock', '0.1.0', auth.uid())$$,
  '一般ユーザーは顧客の撮影の分析結果を登録できない');
select tests.ok(tests.rows($$insert into public.analysis_items (analysis_id, metric, region, determinable, grade, confidence)
  values ('a0000000-0000-0000-0000-000000000003', 'pores', 'nose', true, 3, 0.5),
         ('a0000000-0000-0000-0000-000000000003', 'redness', 'chin', false, null, 0.1)$$) = 2,
  '自分の分析の項目を登録できる');
select tests.throws($$insert into public.analysis_items (analysis_id, metric, region, determinable, grade, confidence)
  values ('a0000000-0000-0000-0000-000000000003', 'texture', 'nose', false, 2, 0.5)$$,
  '判定できない項目に評価は付けられない');
select tests.ok(tests.rows($$insert into public.analysis_descriptions (analysis_id, summary, provider, prompt_version)
  values ('a0000000-0000-0000-0000-000000000003', '説明', 'mock', 'v1')$$) = 1,
  '自分の分析の説明文を登録できる');
select tests.throws($$update public.analyses set status = 'retake_required'$$, '分析結果は書き換えられない');
select tests.throws($$update public.analysis_descriptions set summary = 'x'$$, '説明文は書き換えられない');

select tests.ok(tests.rows($$insert into public.ai_usage (actor_id, purpose, succeeded) values (auth.uid(), 'describe', true)$$) = 1,
  'AI の利用回数を記録できる');
select tests.throws($$insert into public.ai_usage (actor_id, purpose, succeeded)
  values ('00000000-0000-0000-0000-000000000004', 'describe', true)$$, '他人の名前で AI の利用回数を記録できない');
select tests.ok(public.my_ai_usage_today() = 1, '今日の AI 利用回数を数えられる');
reset role;

-- =====================================================================
-- 一般ユーザー4：ユーザー3の分析は見えない
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000004');
set role authenticated;
select tests.ok(tests.rows('select * from public.analyses') = 0, '他人の分析結果は見えない');
select tests.ok(tests.rows('select * from public.analysis_items') = 0, '他人の分析の項目は見えない');
select tests.ok(tests.rows('select * from public.analysis_descriptions') = 0, '他人の説明文は見えない');
select tests.ok(tests.rows('select * from public.ai_usage') = 0, '他人の AI 利用回数は見えない');
select tests.ok(public.my_ai_usage_today() = 0, '自分の AI 利用回数だけが数えられる');
select tests.throws($$insert into public.analysis_items (analysis_id, metric, region, determinable, grade, confidence)
  values ('a0000000-0000-0000-0000-000000000003', 'surface', 'nose', true, 1, 0.5)$$,
  '他人の分析に項目を追加できない');
select tests.ok(tests.rows('delete from public.analyses') = 0, '他人の分析結果は削除できない');
reset role;

-- =====================================================================
-- スタッフ3（顧客3の担当）
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000053');
set role authenticated;
select tests.ok(tests.rows($$insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by)
  values ('a0000000-0000-0000-0000-0000000000c3', '5e000000-0000-0000-0000-0000000000c3', 'retake_required', 'mock', '0.1.0', auth.uid())$$) = 1,
  'スタッフは担当顧客の分析結果を登録できる');
select tests.ok(tests.rows('select * from public.analyses') = 1, 'スタッフは担当顧客の分析結果だけが見え、セルフの分析は見えない');
select tests.ok(tests.rows('delete from public.analyses') = 0, 'スタッフは顧客の分析結果を削除できない');
reset role;

-- スタッフ2（担当外）には見えない
select tests.login('00000000-0000-0000-0000-000000000052');
set role authenticated;
select tests.ok(tests.rows($$select * from public.analyses where id = 'a0000000-0000-0000-0000-0000000000c3'$$) = 0,
  '担当でないスタッフには顧客の分析結果が見えない');
reset role;

-- =====================================================================
-- 管理者
-- =====================================================================
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok(tests.rows($$select * from public.analyses where id = 'a0000000-0000-0000-0000-000000000003'$$) = 0,
  '管理者も一般ユーザーのセルフ分析は見られない');
select tests.ok(tests.rows('select * from public.ai_usage') >= 1, '管理者は AI 利用回数を集計できる');
select tests.ok(tests.rows($$select * from public.audit_logs where action = 'analysis.create'$$) = 2, '分析の登録が監査ログに残る');
select tests.ok(tests.rows($$delete from public.analyses where id = 'a0000000-0000-0000-0000-0000000000c3'$$) = 1,
  '管理者は顧客の分析結果を削除できる');
reset role;

-- 一般ユーザー3：自分の分析を削除すると項目・説明文も消える
select tests.login('00000000-0000-0000-0000-000000000003');
set role authenticated;
select tests.ok(tests.rows('delete from public.analyses') = 1, '自分の分析結果を削除できる');
select tests.ok(tests.rows('select * from public.analysis_items') = 0 and tests.rows('select * from public.analysis_descriptions') = 0,
  '分析結果と一緒に項目・説明文も削除される');
reset role;
