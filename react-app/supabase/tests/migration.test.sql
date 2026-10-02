-- マイグレーションの検証（scripts/test-db.sh から実行）。失敗すると例外で止まる。
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

-- 利用者Aとして送信
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.push_sync_records('[
  {"collection":"recipes","record_id":"r1","data":{"id":"r1","recipeName":"蒸し鶏"},"deleted":false,"updated_at":"2026-10-02T01:00:00Z"},
  {"collection":"inventory","record_id":"i1","data":{"id":"i1"},"deleted":false,"updated_at":"2026-10-02T01:00:00Z"}
]'::jsonb);

do $$ begin
  if (select count(*) from public.sync_records) <> 2 then raise exception 'A should see 2 records'; end if;
end $$;

-- 古い更新は新しい更新を上書きしない（Last Write Wins）
select public.push_sync_records('[{"collection":"recipes","record_id":"r1","data":{"id":"r1","recipeName":"古い"},"deleted":false,"updated_at":"2026-10-02T00:00:00Z"}]'::jsonb);
do $$ begin
  if (select data->>'recipeName' from public.sync_records where record_id = 'r1') <> '蒸し鶏' then raise exception 'older write must not win'; end if;
end $$;

-- 新しい更新は反映され、サーバー時刻が進む
create temp table t_before as select server_updated_at from public.sync_records where record_id = 'r1';
select pg_sleep(0.01);
select public.push_sync_records('[{"collection":"recipes","record_id":"r1","data":null,"deleted":true,"updated_at":"2026-10-02T02:00:00Z"}]'::jsonb);
do $$ begin
  if not (select deleted from public.sync_records where record_id = 'r1') then raise exception 'newer delete must win'; end if;
  if (select server_updated_at from public.sync_records where record_id = 'r1') <= (select server_updated_at from t_before) then raise exception 'server_updated_at must advance'; end if;
end $$;

-- 不正なコレクション名は拒否
do $$ begin
  begin
    perform public.push_sync_records('[{"collection":"hack","record_id":"x","data":{},"deleted":false,"updated_at":"2026-10-02T00:00:00Z"}]'::jsonb);
    raise exception 'invalid collection accepted';
  exception when check_violation then null;
  end;
end $$;

-- 利用者Bからは利用者Aのデータが見えず、変更もできない
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  if (select count(*) from public.sync_records) <> 0 then raise exception 'B must not see A''s records'; end if;
end $$;
update public.sync_records set data = '{"hacked":true}' where record_id = 'i1';
do $$ begin
  begin
    insert into public.sync_records (user_id, collection, record_id, data, updated_at)
    values ('00000000-0000-0000-0000-00000000000a', 'recipes', 'evil', '{}', now());
    raise exception 'B inserted into A''s data';
  exception when insufficient_privilege then null;
  end;
end $$;
select public.push_sync_records('[{"collection":"recipes","record_id":"r1","data":{"b":1},"deleted":false,"updated_at":"2030-01-01T00:00:00Z"}]'::jsonb);
do $$ begin
  if (select count(*) from public.sync_records) <> 1 then raise exception 'B should have exactly its own record'; end if;
end $$;

-- 未ログインでは送信できない
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin
    perform public.push_sync_records('[]'::jsonb);
    raise exception 'anonymous push accepted';
  exception when raise_exception then
    if sqlerrm <> 'not authenticated' then raise; end if;
  end;
end $$;

-- 利用回数の記録は利用者自身では書き込めない（service role のみ）
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  begin
    insert into public.ai_usage (user_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'recipe');
    raise exception 'user wrote ai_usage';
  exception when insufficient_privilege then null;
  end;
end $$;

-- 画像は自分のフォルダのものだけ見える
reset role;
insert into storage.objects (bucket_id, name) values
  ('recipe-images', '00000000-0000-0000-0000-00000000000a/r1.png'),
  ('recipe-images', '00000000-0000-0000-0000-00000000000b/r2.png');
set role authenticated;
do $$ begin
  if (select count(*) from storage.objects) <> 1 then raise exception 'A must see only own images'; end if;
  if (select name from storage.objects) <> '00000000-0000-0000-0000-00000000000a/r1.png' then raise exception 'wrong image visible'; end if;
end $$;

-- 利用者Aを削除すると関連データも消える
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  if (select count(*) from public.sync_records where user_id = '00000000-0000-0000-0000-00000000000a') <> 0 then raise exception 'cascade delete failed'; end if;
end $$;

select 'ALL DATABASE TESTS PASSED' as result;
