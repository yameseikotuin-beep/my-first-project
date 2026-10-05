-- =====================================================================
-- 第3段階：肌画像の分析結果・AI の説明文・AI 利用回数
-- 設計：docs/03-architecture.md §4、docs/04-database.md §3.3
--
-- 方針
-- - 分析結果はサーバーの処理がすべて計算してから、まとめて登録する（更新はしない）
-- - 行の ID はアプリ側で決め、登録後に読み返さない
--   （閲覧の RLS が同じ文の中で作った行を見られないため。photo_sessions と同じ）
-- - 肌年齢・水分量・油分量などを保存する列は作らない
-- =====================================================================

create type public.analysis_status as enum ('completed', 'retake_required');
create type public.skin_metric as enum ('pores', 'redness', 'pigmentation_like', 'texture', 'surface');
create type public.face_region as enum ('forehead', 'cheek_left', 'cheek_right', 'nose', 'chin', 'under_eye');

create table public.analyses (
  id                 uuid primary key,
  session_id         uuid not null references public.photo_sessions (id) on delete cascade,
  status             public.analysis_status not null,
  analyzer_name      text not null,
  analyzer_version   text not null,
  analyzer_validated boolean not null default false,
  retake_reason      text check (char_length(retake_reason) <= 500),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index analyses_session_idx on public.analyses (session_id, created_at desc);

create table public.analysis_items (
  analysis_id  uuid not null references public.analyses (id) on delete cascade,
  metric       public.skin_metric not null,
  region       public.face_region not null,
  determinable boolean not null,
  grade        smallint check (grade between 1 and 5),
  confidence   numeric(4, 3) not null check (confidence between 0 and 1),
  reason       text check (char_length(reason) <= 300),
  primary key (analysis_id, metric, region),
  constraint analysis_items_grade_when_determinable check (determinable = (grade is not null))
);

create table public.analysis_descriptions (
  analysis_id             uuid primary key references public.analyses (id) on delete cascade,
  summary                 text not null check (char_length(summary) <= 2000),
  item_notes              jsonb not null default '[]'::jsonb,
  cautions                text not null default '' check (char_length(cautions) <= 2000),
  self_care_info          text not null default '' check (char_length(self_care_info) <= 2000),
  suggest_medical_consult boolean not null default false,
  provider                text not null check (provider in ('anthropic', 'mock')),
  model                   text,
  prompt_version          text not null,
  filtered_count          integer not null default 0 check (filtered_count >= 0),
  created_at              timestamptz not null default now()
);

-- AI の利用回数（回数制限と集計に使う。画像や文章は保存しない）
create table public.ai_usage (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  purpose     text not null check (purpose in ('describe', 'proposal')),
  analysis_id uuid,
  model       text,
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);

create index ai_usage_actor_idx on public.ai_usage (actor_id, created_at desc);

-- ---------------------------------------------------------------------
-- 権限判定
-- ---------------------------------------------------------------------
create or replace function public.can_access_analysis(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.analyses a
    where a.id = target and public.can_access_session(a.session_id)
  )
$$;

-- 今日（日本時間）の AI 利用回数（本人の分）
create or replace function public.my_ai_usage_today()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select count(*)::integer from public.ai_usage u
  where u.actor_id = auth.uid()
    and u.created_at >= (date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')
$$;

-- ---------------------------------------------------------------------
-- 監査ログ：分析の作成・削除を記録する
-- ---------------------------------------------------------------------
create or replace function public.audit_analysis_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec public.analyses;
begin
  rec := case when tg_op = 'DELETE' then old else new end;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  values (auth.uid(), public.app_current_role(),
          case tg_op when 'INSERT' then 'analysis.create' else 'analysis.delete' end,
          'analyses', rec.id,
          jsonb_build_object('session_id', rec.session_id, 'status', rec.status,
                             'analyzer', rec.analyzer_name, 'validated', rec.analyzer_validated));
  return null;
end;
$$;

create trigger audit_analyses after insert or delete on public.analyses
  for each row execute function public.audit_analysis_change();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.analyses enable row level security;
alter table public.analysis_items enable row level security;
alter table public.analysis_descriptions enable row level security;
alter table public.ai_usage enable row level security;

revoke all on public.analyses, public.analysis_items, public.analysis_descriptions, public.ai_usage from anon;

-- analyses
create policy analyses_select on public.analyses
  for select to authenticated
  using (public.can_access_session(session_id));

create policy analyses_insert on public.analyses
  for insert to authenticated
  with check (public.can_access_session(session_id) and created_by = auth.uid());

-- 削除：セルフは本人、サロンは管理者（撮影セッションの削除と同じ）
create policy analyses_delete on public.analyses
  for delete to authenticated
  using (exists (
    select 1 from public.photo_sessions s
    where s.id = session_id
      and ( (s.user_id is not null and s.user_id = auth.uid())
         or (s.customer_id is not null and public.is_admin()) )
  ));

revoke update, truncate on public.analyses from authenticated;

-- analysis_items
create policy analysis_items_select on public.analysis_items
  for select to authenticated
  using (public.can_access_analysis(analysis_id));

create policy analysis_items_insert on public.analysis_items
  for insert to authenticated
  with check (public.can_access_analysis(analysis_id));

revoke update, delete, truncate on public.analysis_items from authenticated;

-- analysis_descriptions
create policy analysis_descriptions_select on public.analysis_descriptions
  for select to authenticated
  using (public.can_access_analysis(analysis_id));

create policy analysis_descriptions_insert on public.analysis_descriptions
  for insert to authenticated
  with check (public.can_access_analysis(analysis_id));

revoke update, delete, truncate on public.analysis_descriptions from authenticated;

-- ai_usage：本人の記録だけを登録・閲覧できる。管理者は全件を閲覧できる
create policy ai_usage_select on public.ai_usage
  for select to authenticated
  using (actor_id = auth.uid() or public.is_admin());

create policy ai_usage_insert on public.ai_usage
  for insert to authenticated
  with check (actor_id = auth.uid());

revoke update, delete, truncate on public.ai_usage from authenticated;

-- 関数の実行権限
revoke execute on function public.can_access_analysis(uuid), public.my_ai_usage_today(),
  public.audit_analysis_change() from public, anon;
grant execute on function public.can_access_analysis(uuid), public.my_ai_usage_today() to authenticated;
