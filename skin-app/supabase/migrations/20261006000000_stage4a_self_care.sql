-- =====================================================================
-- 第4段階-1：セルフケアの記録、退会（本人のデータの削除）
-- =====================================================================

-- ---------------------------------------------------------------------
-- セルフケアの記録（一般ユーザー本人だけが読み書きできる）
-- ---------------------------------------------------------------------
create table public.self_care_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  log_date    date not null,
  care_items  text[] not null default '{}' check (cardinality(care_items) <= 20),
  products    text not null default '' check (char_length(products) <= 500),
  note        text not null default '' check (char_length(note) <= 1000),
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, log_date)
);

create trigger self_care_logs_updated_at before update on public.self_care_logs
  for each row execute function public.set_updated_at();

alter table public.self_care_logs enable row level security;
revoke all on public.self_care_logs from anon;

create policy self_care_logs_select on public.self_care_logs
  for select to authenticated
  using (user_id = auth.uid());

create policy self_care_logs_insert on public.self_care_logs
  for insert to authenticated
  with check (user_id = auth.uid() and public.app_current_role() = 'user');

create policy self_care_logs_update on public.self_care_logs
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy self_care_logs_delete on public.self_care_logs
  for delete to authenticated
  using (user_id = auth.uid());

-- 更新できるのは記録の項目だけ
revoke update, truncate on public.self_care_logs from authenticated;
grant update (log_date, care_items, products, note, sleep_hours) on public.self_care_logs to authenticated;

-- ---------------------------------------------------------------------
-- 退会：本人のアカウントとデータをすべて削除する
-- 写真ファイル（Storage）はアプリ側で先に削除してから呼ぶ。
-- auth.users を削除すると、profiles・撮影・写真の情報・分析・同意・セルフケアの記録が一緒に削除される。
-- 監査ログには、ID と件数だけを残す。
-- スタッフ・管理者の業務アカウントは対象外（管理者が停止する）。
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  role_now public.app_role;
  sessions_count integer;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select p.role into role_now from public.profiles p where p.id = me;
  if role_now is distinct from 'user' then
    raise exception 'only general users can delete their own account' using errcode = '42501';
  end if;
  select count(*) into sessions_count from public.photo_sessions s where s.user_id = me;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  values (me, role_now, 'account.delete', 'profiles', me, jsonb_build_object('photo_sessions', sessions_count));

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
