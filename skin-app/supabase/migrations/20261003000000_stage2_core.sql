-- =====================================================================
-- 第2段階：利用者・権限、顧客台帳、同意、撮影セッション・写真、監査ログ
-- 設計：docs/04-database.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- 型
-- ---------------------------------------------------------------------
create type public.app_role as enum ('user', 'staff', 'admin');
create type public.photo_angle as enum ('front', 'left', 'right');
create type public.consent_kind as enum ('photo_capture', 'photo_storage', 'ai_processing');
create type public.consent_method as enum ('self_app', 'salon_tablet');

-- ---------------------------------------------------------------------
-- 共通：updated_at の自動更新
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles（auth.users と1対1）
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  role               public.app_role not null default 'user',
  display_name       text not null default '' check (char_length(display_name) <= 50),
  is_active          boolean not null default true,
  adult_confirmed_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- 新規登録時に profiles を作る。役割は常に 'user'（利用者が送る metadata では役割を決めない）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, adult_confirmed_at)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 50),
    case when (new.raw_user_meta_data ->> 'adult_confirmed') = 'true' then now() end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 顧客台帳
-- ---------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null check (char_length(full_name) between 1 and 100),
  full_name_kana text not null default '' check (char_length(full_name_kana) <= 100),
  phone          text not null default '' check (char_length(phone) <= 30),
  email          text not null default '' check (char_length(email) <= 254),
  birth_year     smallint check (birth_year between 1900 and 2100),
  notes          text not null default '' check (char_length(notes) <= 2000),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index customers_kana_idx on public.customers (full_name_kana);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

create table public.customer_assignments (
  staff_id    uuid not null references public.profiles (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  granted_by  uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (staff_id, customer_id)
);

create index customer_assignments_customer_idx on public.customer_assignments (customer_id);

-- ---------------------------------------------------------------------
-- 同意
-- ---------------------------------------------------------------------
create table public.consent_documents (
  id           uuid primary key default gen_random_uuid(),
  kind         public.consent_kind not null,
  version      text not null,
  title        text not null,
  body         text not null,
  published_at timestamptz not null default now(),
  unique (kind, version)
);

create table public.consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  document_id uuid not null references public.consent_documents (id),
  kind        public.consent_kind not null,
  method      public.consent_method not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint consents_one_subject check ((user_id is null) <> (customer_id is null))
);

create index consents_user_idx on public.consents (user_id) where user_id is not null;
create index consents_customer_idx on public.consents (customer_id) where customer_id is not null;

-- 同意文の種類と同意の種類が一致していることを確認
create or replace function public.check_consent_document_kind()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.consent_documents d
    where d.id = new.document_id and d.kind = new.kind
  ) then
    raise exception 'consent document kind mismatch';
  end if;
  return new;
end;
$$;

create trigger consents_kind_check before insert or update on public.consents
  for each row execute function public.check_consent_document_kind();

-- ---------------------------------------------------------------------
-- 撮影セッション・写真
-- ---------------------------------------------------------------------
create table public.photo_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  captured_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint photo_sessions_one_subject check ((user_id is null) <> (customer_id is null))
);

create index photo_sessions_user_idx on public.photo_sessions (user_id, created_at desc) where user_id is not null;
create index photo_sessions_customer_idx on public.photo_sessions (customer_id, created_at desc) where customer_id is not null;

create table public.photos (
  id             uuid primary key,
  session_id     uuid not null references public.photo_sessions (id) on delete cascade,
  angle          public.photo_angle not null,
  storage_path   text not null unique,
  width          integer not null check (width between 1 and 8192),
  height         integer not null check (height between 1 and 8192),
  quality        jsonb not null default '{}'::jsonb,
  quality_passed boolean not null,
  device_class   text not null check (device_class in ('phone', 'tablet', 'desktop')),
  created_at     timestamptz not null default now(),
  unique (session_id, angle)
);

-- ---------------------------------------------------------------------
-- 監査ログ（追記のみ）
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  actor_role  public.app_role,
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text,
  target_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

-- =====================================================================
-- 権限判定の関数（RLS から使う）
-- =====================================================================
create or replace function public.app_current_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(public.app_current_role() = 'admin', false) $$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(public.app_current_role() in ('staff', 'admin'), false) $$;

create or replace function public.can_access_customer(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin()
      or (public.app_current_role() = 'staff' and exists (
            select 1 from public.customer_assignments a
            where a.customer_id = target and a.staff_id = auth.uid()))
$$;

create or replace function public.can_access_session(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.photo_sessions s
    where s.id = target
      and ( (s.user_id is not null and s.user_id = auth.uid()
             and public.app_current_role() = 'user')
         or (s.customer_id is not null and public.can_access_customer(s.customer_id)) )
  )
$$;

-- 有効な（撤回されていない）同意があるか
create or replace function public.has_active_consent(
  subject_user uuid, subject_customer uuid, consent public.consent_kind)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents c
    where c.kind = consent
      and c.revoked_at is null
      -- 他人の同意状況を調べられないよう、本人または担当者に限る
      and ( (subject_user is not null and c.user_id = subject_user and subject_user = auth.uid())
         or (subject_customer is not null and c.customer_id = subject_customer
             and public.can_access_customer(subject_customer)) )
  )
$$;

-- 写真の保存場所（Storage のパス）の決まり：
--   self/{user_id}/{session_id}/{photo_id}.jpg
--   salon/{customer_id}/{session_id}/{photo_id}.jpg
create or replace function public.photo_storage_path(session uuid, photo uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when s.user_id is not null then 'self/' || s.user_id || '/' || s.id || '/' || photo || '.jpg'
    else 'salon/' || s.customer_id || '/' || s.id || '/' || photo || '.jpg'
  end
  from public.photo_sessions s
  where s.id = session and public.can_access_session(session)
$$;

-- Storage のオブジェクトにアクセスできるか（パスを安全に解釈する）
create or replace function public.can_access_storage_object(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  parts text[];
  session_id uuid;
  photo_id uuid;
begin
  if object_name is null then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  if coalesce(array_length(parts, 1), 0) <> 4 or parts[1] not in ('self', 'salon') then
    return false;
  end if;
  if parts[4] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
     or parts[3] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  session_id := parts[3]::uuid;
  photo_id := left(parts[4], 36)::uuid;
  return public.photo_storage_path(session_id, photo_id) = object_name
     and public.can_access_session(session_id);
end;
$$;

-- =====================================================================
-- 監査ログの記録
-- =====================================================================
create or replace function public.write_audit_log(
  p_action text, p_target_type text default null, p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  values (auth.uid(), public.app_current_role(), p_action, p_target_type, p_target_id,
          coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- 重要なテーブルの変更を自動で記録する（個人情報の値は記録しない）
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb;
  target uuid;
  meta jsonb := '{}'::jsonb;
  verb text;
begin
  rec := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  verb := case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'update' else 'delete' end;

  if tg_table_name = 'customer_assignments' then
    target := (rec ->> 'customer_id')::uuid;
    meta := jsonb_build_object('staff_id', rec ->> 'staff_id');
    verb := case tg_op when 'INSERT' then 'grant' else 'revoke' end;
  elsif tg_table_name = 'profiles' then
    target := (rec ->> 'id')::uuid;
    if tg_op = 'UPDATE' then
      if old.role is not distinct from new.role and old.is_active is not distinct from new.is_active then
        return null; -- 表示名だけの変更は記録しない
      end if;
      meta := jsonb_build_object('role', new.role, 'is_active', new.is_active,
                                 'previous_role', old.role, 'previous_is_active', old.is_active);
    end if;
  elsif tg_table_name = 'consents' then
    target := (rec ->> 'id')::uuid;
    meta := jsonb_build_object('kind', rec ->> 'kind', 'method', rec ->> 'method',
                               'revoked', (rec ->> 'revoked_at') is not null);
  elsif tg_table_name = 'photos' then
    target := (rec ->> 'id')::uuid;
    meta := jsonb_build_object('session_id', rec ->> 'session_id', 'angle', rec ->> 'angle');
    verb := case tg_op when 'INSERT' then 'upload' else 'delete' end;
  else
    target := (rec ->> 'id')::uuid;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  values (auth.uid(), public.app_current_role(),
          case tg_table_name
            when 'customer_assignments' then 'assignment'
            when 'customers' then 'customer'
            when 'profiles' then 'profile'
            when 'consents' then 'consent'
            when 'photos' then 'photo'
            when 'photo_sessions' then 'photo_session'
          end || '.' || verb,
          tg_table_name, target, meta);
  return null;
end;
$$;

create trigger audit_customers after insert or update or delete on public.customers
  for each row execute function public.audit_row_change();
create trigger audit_assignments after insert or delete on public.customer_assignments
  for each row execute function public.audit_row_change();
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_row_change();
create trigger audit_consents after insert or update on public.consents
  for each row execute function public.audit_row_change();
create trigger audit_photos after insert or delete on public.photos
  for each row execute function public.audit_row_change();
create trigger audit_photo_sessions after delete on public.photo_sessions
  for each row execute function public.audit_row_change();

-- =====================================================================
-- 業務用の関数（RLS だけでは表せない操作）
-- =====================================================================

-- 顧客の登録：スタッフが登録した場合は自動で担当にする
create or replace function public.create_customer(
  p_full_name text, p_full_name_kana text default '', p_phone text default '',
  p_email text default '', p_birth_year smallint default null, p_notes text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  insert into public.customers (full_name, full_name_kana, phone, email, birth_year, notes, created_by)
  values (p_full_name, coalesce(p_full_name_kana, ''), coalesce(p_phone, ''),
          coalesce(p_email, ''), p_birth_year, coalesce(p_notes, ''), auth.uid())
  returning id into new_id;

  if public.app_current_role() = 'staff' then
    insert into public.customer_assignments (staff_id, customer_id, granted_by)
    values (auth.uid(), new_id, auth.uid());
  end if;
  return new_id;
end;
$$;

-- 役割・有効状態の変更（管理者のみ。自分自身の管理者権限は外せない）
create or replace function public.admin_update_member(
  p_target uuid, p_role public.app_role, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_target = auth.uid() and (p_role <> 'admin' or not p_is_active) then
    raise exception 'cannot demote or deactivate yourself' using errcode = '42501';
  end if;
  update public.profiles set role = p_role, is_active = p_is_active where id = p_target;
  if not found then
    raise exception 'member not found' using errcode = 'P0002';
  end if;
  -- スタッフでなくなったら担当割当を外す
  if p_role = 'user' then
    delete from public.customer_assignments where staff_id = p_target;
  end if;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_assignments enable row level security;
alter table public.consent_documents enable row level security;
alter table public.consents enable row level security;
alter table public.photo_sessions enable row level security;
alter table public.photos enable row level security;
alter table public.audit_logs enable row level security;

-- 未ログインの利用者には一切の権限を与えない
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- profiles：本人か管理者が読める。本人が変えられるのは表示名だけ
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- customers
create policy customers_select on public.customers
  for select to authenticated
  using (public.can_access_customer(id));

create policy customers_update on public.customers
  for update to authenticated
  using (public.can_access_customer(id))
  with check (public.can_access_customer(id));

create policy customers_delete on public.customers
  for delete to authenticated
  using (public.is_admin());

-- 登録は create_customer() 経由。更新できるのは台帳の項目だけ
revoke insert, update, truncate on public.customers from authenticated;
grant update (full_name, full_name_kana, phone, email, birth_year, notes) on public.customers to authenticated;

-- customer_assignments
create policy assignments_select on public.customer_assignments
  for select to authenticated
  using (public.is_admin() or staff_id = auth.uid());

create policy assignments_insert on public.customer_assignments
  for insert to authenticated
  with check (
    public.is_admin()
    and granted_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = staff_id and p.role = 'staff')
  );

create policy assignments_delete on public.customer_assignments
  for delete to authenticated
  using (public.is_admin());

revoke update, truncate on public.customer_assignments from authenticated;

-- consent_documents：ログイン済みなら読める。変更は管理用（service_role）のみ
create policy consent_documents_select on public.consent_documents
  for select to authenticated
  using (true);

revoke insert, update, delete, truncate on public.consent_documents from authenticated;

-- consents
create policy consents_select on public.consents
  for select to authenticated
  using (
    (user_id is not null and user_id = auth.uid())
    or (customer_id is not null and public.can_access_customer(customer_id))
  );

create policy consents_insert on public.consents
  for insert to authenticated
  with check (
    revoked_at is null
    and recorded_by = auth.uid()
    and (
      (user_id = auth.uid() and customer_id is null and method = 'self_app'
        and public.app_current_role() = 'user')
      or (customer_id is not null and user_id is null and method = 'salon_tablet'
        and public.can_access_customer(customer_id))
    )
  );

-- 撤回だけを許可する（revoked_at 以外の列は更新できない）
create policy consents_revoke on public.consents
  for update to authenticated
  using (
    revoked_at is null and (
      (user_id is not null and user_id = auth.uid())
      or (customer_id is not null and public.can_access_customer(customer_id)))
  )
  with check (revoked_at is not null);

revoke update, delete, truncate on public.consents from authenticated;
grant update (revoked_at) on public.consents to authenticated;

-- photo_sessions：撮影と保存の同意がある場合だけ作れる
create policy photo_sessions_select on public.photo_sessions
  for select to authenticated
  using (public.can_access_session(id));

create policy photo_sessions_insert on public.photo_sessions
  for insert to authenticated
  with check (
    captured_by = auth.uid()
    and (
      (user_id = auth.uid() and customer_id is null and public.app_current_role() = 'user'
        and public.has_active_consent(user_id, null, 'photo_capture')
        and public.has_active_consent(user_id, null, 'photo_storage'))
      or (customer_id is not null and user_id is null and public.can_access_customer(customer_id)
        and public.has_active_consent(null, customer_id, 'photo_capture')
        and public.has_active_consent(null, customer_id, 'photo_storage'))
    )
  );

create policy photo_sessions_delete on public.photo_sessions
  for delete to authenticated
  using (
    (user_id is not null and user_id = auth.uid())
    or (customer_id is not null and public.is_admin())
  );

revoke update, truncate on public.photo_sessions from authenticated;

-- photos：保存場所はセッションから決まるパスと一致しなければならない
create policy photos_select on public.photos
  for select to authenticated
  using (public.can_access_session(session_id));

create policy photos_insert on public.photos
  for insert to authenticated
  with check (
    public.can_access_session(session_id)
    and storage_path = public.photo_storage_path(session_id, id)
  );

create policy photos_delete on public.photos
  for delete to authenticated
  using (public.can_access_session(session_id));

revoke update, truncate on public.photos from authenticated;

-- audit_logs：管理者だけが読める。誰も直接は書き換えられない
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin());

revoke insert, update, delete, truncate on public.audit_logs from authenticated, service_role;

-- 関数の実行権限
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.app_current_role(), public.is_admin(), public.is_staff_or_admin(),
  public.can_access_customer(uuid), public.can_access_session(uuid),
  public.has_active_consent(uuid, uuid, public.consent_kind),
  public.photo_storage_path(uuid, uuid), public.can_access_storage_object(text),
  public.write_audit_log(text, text, uuid, jsonb),
  public.create_customer(text, text, text, text, smallint, text),
  public.admin_update_member(uuid, public.app_role, boolean)
to authenticated;
grant execute on function public.write_audit_log(text, text, uuid, jsonb) to service_role;

-- =====================================================================
-- Storage：顔写真用の非公開バケット
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('face-photos', 'face-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy face_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'face-photos' and public.can_access_storage_object(name));

create policy face_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'face-photos' and public.can_access_storage_object(name));

create policy face_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'face-photos' and public.can_access_storage_object(name));
