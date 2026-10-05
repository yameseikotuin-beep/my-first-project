-- 第4段階-1：セルフケアの記録・退会の RLS テスト（10_rls.test.sql の tests スキーマを使う）
\set QUIET on
\pset tuples_only on
\pset format unaligned

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000005', 'user5@example.test'),
  ('00000000-0000-0000-0000-000000000006', 'user6@example.test');
insert into public.photo_sessions (id, user_id, captured_by) values
  ('5e000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005');
insert into public.analyses (id, session_id, status, analyzer_name, analyzer_version, created_by) values
  ('a0000000-0000-0000-0000-000000000005', '5e000000-0000-0000-0000-000000000005', 'completed', 'mock', '0.1.0',
   '00000000-0000-0000-0000-000000000005');
insert into public.ai_usage (actor_id, purpose, succeeded) values ('00000000-0000-0000-0000-000000000005', 'describe', true);

-- =====================================================================
-- 一般ユーザー5：セルフケアの記録
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000005');
set role authenticated;
select tests.ok(tests.rows($$insert into public.self_care_logs (user_id, log_date, care_items, note)
  values (auth.uid(), '2026-10-06', '{保湿,日焼け止め}', 'よく眠れた')$$) = 1, 'セルフケアを記録できる');
select tests.throws($$insert into public.self_care_logs (user_id, log_date) values (auth.uid(), '2026-10-06')$$,
  '同じ日の記録は1件だけ');
select tests.throws($$insert into public.self_care_logs (user_id, log_date)
  values ('00000000-0000-0000-0000-000000000006', '2026-10-07')$$, '他人の名前で記録できない');
select tests.ok(tests.rows($$update public.self_care_logs set note = '更新' where user_id = auth.uid()$$) = 1,
  '自分の記録を更新できる');
select tests.throws($$update public.self_care_logs set user_id = '00000000-0000-0000-0000-000000000006'$$,
  '記録の持ち主は書き換えられない');
reset role;

-- 一般ユーザー6：ユーザー5の記録は見えない・変えられない
select tests.login('00000000-0000-0000-0000-000000000006');
set role authenticated;
select tests.ok(tests.rows('select * from public.self_care_logs') = 0, '他人のセルフケアの記録は見えない');
select tests.ok(tests.rows($$update public.self_care_logs set note = 'x'$$) = 0, '他人の記録は更新できない');
select tests.ok(tests.rows('delete from public.self_care_logs') = 0, '他人の記録は削除できない');
reset role;

-- スタッフ・管理者は記録を作れず、退会の関数も使えない
select tests.login('00000000-0000-0000-0000-000000000051');
set role authenticated;
select tests.throws($$insert into public.self_care_logs (user_id, log_date) values (auth.uid(), '2026-10-06')$$,
  'スタッフはセルフケアを記録できない');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select tests.ok(tests.rows('select * from public.self_care_logs') = 0, '管理者もセルフケアの記録は見られない');
select tests.throws('select public.delete_my_account()', '管理者の業務アカウントは自分で退会できない');
reset role;

-- 未ログインでは使えない
set role anon;
select tests.throws('select public.delete_my_account()', '未ログインでは退会の関数を使えない');
reset role;

-- =====================================================================
-- 一般ユーザー5：退会
-- =====================================================================
select tests.login('00000000-0000-0000-0000-000000000005');
set role authenticated;
select public.delete_my_account();
reset role;

select tests.ok(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000005'), '退会するとアカウントが削除される');
select tests.ok(not exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000005'), 'プロフィールも削除される');
select tests.ok(not exists (select 1 from public.photo_sessions where id = '5e000000-0000-0000-0000-000000000005')
  and not exists (select 1 from public.analyses where id = 'a0000000-0000-0000-0000-000000000005'),
  '撮影と分析結果も削除される');
select tests.ok(not exists (select 1 from public.self_care_logs where user_id = '00000000-0000-0000-0000-000000000005'),
  'セルフケアの記録も削除される');
select tests.ok(exists (select 1 from public.ai_usage where actor_id is null), 'AI 利用回数は本人と切り離して残る');
select tests.ok((select count(*) = 1 from public.audit_logs where action = 'account.delete'
  and target_id = '00000000-0000-0000-0000-000000000005' and (metadata ->> 'photo_sessions')::int = 1),
  '退会が監査ログに残る（ID と件数のみ）');
select tests.ok(exists (select 1 from auth.users where id = '00000000-0000-0000-0000-000000000006'), 'ほかの利用者は削除されない');
