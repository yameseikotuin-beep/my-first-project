-- ダイエットレシピメーカー: 端末間同期・AI利用回数・料理画像

-- ========== 同期レコード ==========
-- アプリの各データ（レシピ・食事プラン・在庫など）を1レコード1行で保存する。
-- 端末側の更新時刻（updated_at）が新しい方を採用する（Last Write Wins）。
create table if not exists public.sync_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collection text not null check (collection in (
    'profiles', 'settings', 'recipes', 'history', 'favorites', 'mealPlans',
    'shoppingLists', 'inventory', 'customFoods', 'targetHistory'
  )),
  record_id text not null check (char_length(record_id) between 1 and 200),
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, collection, record_id),
  -- 1レコードあたりの上限（画像などの大きなデータは Storage に置く）
  constraint sync_records_data_size check (data is null or pg_column_size(data) <= 512 * 1024)
);

create index if not exists sync_records_pull_idx on public.sync_records (user_id, server_updated_at);

alter table public.sync_records enable row level security;

create policy "sync_records: 自分のデータのみ参照" on public.sync_records
  for select using (user_id = auth.uid());
create policy "sync_records: 自分のデータのみ追加" on public.sync_records
  for insert with check (user_id = auth.uid());
create policy "sync_records: 自分のデータのみ更新" on public.sync_records
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- サーバー側の更新時刻は常にサーバーで付ける（差分取得の基準）
create or replace function public.touch_sync_record() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger sync_records_touch before insert or update on public.sync_records
  for each row execute function public.touch_sync_record();

-- まとめて送信する。サーバー側により新しい変更があれば上書きしない。
-- security invoker のため、RLS（自分のデータのみ）がそのまま適用される。
create or replace function public.push_sync_records(records jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(records) > 500 then
    raise exception 'too many records in one request';
  end if;
  insert into public.sync_records as s (user_id, collection, record_id, data, deleted, updated_at)
  select auth.uid(), r.collection, r.record_id, r.data, coalesce(r.deleted, false), r.updated_at
  from jsonb_to_recordset(records) as r(collection text, record_id text, data jsonb, deleted boolean, updated_at timestamptz)
  on conflict (user_id, collection, record_id) do update
    set data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at
    where excluded.updated_at >= s.updated_at;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.push_sync_records(jsonb) from public, anon;
grant execute on function public.push_sync_records(jsonb) to authenticated;

-- ========== AI の利用回数 ==========
-- Edge Function が利用回数の制限に使う。書き込みは service role のみ。
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('recipe', 'image')),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_idx on public.ai_usage (user_id, kind, created_at);

alter table public.ai_usage enable row level security;

create policy "ai_usage: 自分の利用回数のみ参照" on public.ai_usage
  for select using (user_id = auth.uid());

-- ========== 料理画像（非公開バケット） ==========
-- パスは「ユーザーID/レシピID.png」。自分のフォルダだけ読み書きできる。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', false, 5 * 1024 * 1024, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "recipe-images: 自分の画像を参照" on storage.objects
  for select using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "recipe-images: 自分の画像を削除" on storage.objects
  for delete using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
