-- =====================================================================
-- 第4段階-2：サロン向けの機能
--   施術メニュー・来店・問診・カウンセリングシート・施術履歴（前後比較）・
--   施術案内文・機器の実測値・管理者向けの利用状況の集計
-- =====================================================================

-- ---------------------------------------------------------------------
-- 施術メニュー（管理者が編集し、スタッフは有効なものを見る）
-- ---------------------------------------------------------------------
create table public.treatment_menus (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  category     text not null default '' check (char_length(category) <= 50),
  description  text not null default '' check (char_length(description) <= 2000),
  cautions     text not null default '' check (char_length(cautions) <= 2000),
  price_yen    integer not null check (price_yen between 0 and 10000000),
  duration_min integer check (duration_min between 1 and 600),
  is_active    boolean not null default true,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger treatment_menus_updated_at before update on public.treatment_menus
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 来店
-- ---------------------------------------------------------------------
create table public.visits (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete cascade,
  staff_id        uuid references public.profiles (id) on delete set null,
  visited_at      timestamptz not null default now(),
  status          text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  next_visit_memo text not null default '' check (char_length(next_visit_memo) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index visits_customer_idx on public.visits (customer_id, visited_at desc);
create index visits_visited_idx on public.visits (visited_at desc);

create trigger visits_updated_at before update on public.visits
  for each row execute function public.set_updated_at();

-- 来店にアクセスできるか（顧客にアクセスできる人だけ）
create or replace function public.can_access_visit(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.visits v
    where v.id = target and public.can_access_customer(v.customer_id)
  )
$$;

-- 来店の顧客（来店と撮影・実測値の顧客が一致するかの確認に使う。トリガーの中だけで使う）
create or replace function public.visit_customer(target uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select v.customer_id from public.visits v where v.id = target $$;

-- 撮影を来店にひも付ける（来店時の撮影）
alter table public.photo_sessions
  add column visit_id uuid references public.visits (id) on delete set null;
create index photo_sessions_visit_idx on public.photo_sessions (visit_id) where visit_id is not null;

-- ---------------------------------------------------------------------
-- 問診（来店1件に1つ）
-- ---------------------------------------------------------------------
create table public.intake_forms (
  visit_id     uuid primary key references public.visits (id) on delete cascade,
  form_version text not null check (char_length(form_version) <= 20),
  answers      jsonb not null default '{}'::jsonb
               check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 20000),
  -- 通院中の皮膚の病気がある：施術前に医師への確認を促す
  skin_condition_under_treatment boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger intake_forms_updated_at before update on public.intake_forms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- カウンセリングシート（来店1件に1つ）
-- ---------------------------------------------------------------------
create table public.counseling_sheets (
  visit_id         uuid primary key references public.visits (id) on delete cascade,
  concerns         text not null default '' check (char_length(concerns) <= 2000),
  analysis_summary text not null default '' check (char_length(analysis_summary) <= 2000),
  proposal         text not null default '' check (char_length(proposal) <= 2000),
  customer_wishes  text not null default '' check (char_length(customer_wishes) <= 2000),
  staff_notes      text not null default '' check (char_length(staff_notes) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger counseling_sheets_updated_at before update on public.counseling_sheets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 施術履歴（施術時点のメニュー名と料金を残す）
-- ---------------------------------------------------------------------
create table public.treatments (
  id                 uuid primary key default gen_random_uuid(),
  visit_id           uuid not null references public.visits (id) on delete cascade,
  menu_id            uuid references public.treatment_menus (id) on delete set null,
  menu_name_snapshot text not null default '',
  price_yen_snapshot integer not null default 0,
  notes              text not null default '' check (char_length(notes) <= 2000),
  before_session_id  uuid references public.photo_sessions (id) on delete set null,
  after_session_id   uuid references public.photo_sessions (id) on delete set null,
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now()
);

create index treatments_visit_idx on public.treatments (visit_id, created_at);

-- メニュー名と料金は、送られた値ではなくメニューの現在の値を記録する
create or replace function public.treatments_fill_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.treatment_menus;
begin
  select * into m from public.treatment_menus where id = new.menu_id and is_active;
  if not found then
    raise exception 'menu not available' using errcode = '23514';
  end if;
  new.menu_name_snapshot := m.name;
  new.price_yen_snapshot := m.price_yen;
  return new;
end;
$$;

create trigger treatments_snapshot before insert on public.treatments
  for each row execute function public.treatments_fill_snapshot();

-- ---------------------------------------------------------------------
-- 施術案内文（来店1件に1つ。下書き → スタッフが確認・編集 → 承認）
-- ---------------------------------------------------------------------
create table public.care_proposals (
  id           uuid primary key default gen_random_uuid(),
  visit_id     uuid not null unique references public.visits (id) on delete cascade,
  menu_ids     uuid[] not null default '{}' check (cardinality(menu_ids) <= 10),
  draft_text   text not null default '' check (char_length(draft_text) <= 4000),
  final_text   text not null default '' check (char_length(final_text) <= 4000),
  generated_by text not null check (generated_by in ('ai', 'mock', 'manual')),
  ai_model     text,
  status       text not null default 'draft' check (status in ('draft', 'approved')),
  approved_by  uuid references public.profiles (id) on delete set null,
  approved_at  timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger care_proposals_updated_at before update on public.care_proposals
  for each row execute function public.set_updated_at();

-- 承認した人と日時はデータベースで記録する（送られた値は使わない）
create or replace function public.care_proposals_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'approved' then
    if char_length(btrim(new.final_text)) = 0 then
      raise exception 'final text is required' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' or old.status <> 'approved' then
      new.approved_by := auth.uid();
      new.approved_at := now();
    else
      new.approved_by := old.approved_by;
      new.approved_at := old.approved_at;
    end if;
  else
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end;
$$;

create trigger care_proposals_approval before insert or update on public.care_proposals
  for each row execute function public.care_proposals_approval();

-- ---------------------------------------------------------------------
-- 機器の実測値（AI の評価とは別に記録する）
-- ---------------------------------------------------------------------
create table public.device_measurements (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  visit_id    uuid references public.visits (id) on delete set null,
  device_name text not null check (char_length(device_name) between 1 and 100),
  metric      text not null check (char_length(metric) between 1 and 50),
  value       numeric(12, 3) not null,
  unit        text not null default '' check (char_length(unit) <= 20),
  measured_at timestamptz not null default now(),
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index device_measurements_customer_idx on public.device_measurements (customer_id, measured_at desc);

-- ---------------------------------------------------------------------
-- 来店・撮影・実測値の組み合わせの確認
--   来店時の撮影・実測値は、その来店の顧客のものでなければならない。
--   施術の前後の撮影は、その来店の顧客の撮影でなければならない。
-- ---------------------------------------------------------------------
create or replace function public.check_visit_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid;
begin
  if tg_table_name in ('photo_sessions', 'device_measurements') then
    if new.visit_id is not null
       and public.visit_customer(new.visit_id) is distinct from new.customer_id then
      raise exception 'visit does not belong to the customer' using errcode = '23514';
    end if;
  elsif tg_table_name = 'treatments' then
    v_customer := public.visit_customer(new.visit_id);
    if (new.before_session_id is not null and not exists (
          select 1 from public.photo_sessions s
          where s.id = new.before_session_id and s.customer_id = v_customer))
       or (new.after_session_id is not null and not exists (
          select 1 from public.photo_sessions s
          where s.id = new.after_session_id and s.customer_id = v_customer)) then
      raise exception 'photo session does not belong to the customer' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger photo_sessions_visit_check before insert or update on public.photo_sessions
  for each row execute function public.check_visit_links();
create trigger device_measurements_visit_check before insert or update on public.device_measurements
  for each row execute function public.check_visit_links();
create trigger treatments_session_check before insert or update on public.treatments
  for each row execute function public.check_visit_links();

-- ---------------------------------------------------------------------
-- 監査ログ（自由記述の内容は記録しない）
-- ---------------------------------------------------------------------
create or replace function public.audit_salon_change()
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
  target := (rec ->> 'id')::uuid;

  if tg_table_name = 'treatment_menus' then
    meta := jsonb_build_object('price_yen', rec -> 'price_yen', 'is_active', rec -> 'is_active');
    if tg_op = 'UPDATE' then
      meta := meta || jsonb_build_object('previous_price_yen', old.price_yen, 'previous_is_active', old.is_active);
    end if;
  elsif tg_table_name = 'visits' then
    meta := jsonb_build_object('customer_id', rec ->> 'customer_id', 'status', rec ->> 'status');
    if tg_op = 'UPDATE' then
      if old.status = new.status then
        return null; -- メモだけの変更は記録しない
      end if;
      verb := case new.status when 'completed' then 'complete' else 'reopen' end;
    end if;
  elsif tg_table_name = 'treatments' then
    meta := jsonb_build_object('visit_id', rec ->> 'visit_id', 'menu_id', rec ->> 'menu_id');
  elsif tg_table_name = 'care_proposals' then
    if tg_op = 'UPDATE' and old.status = new.status then
      return null; -- 文の編集だけは記録しない
    end if;
    meta := jsonb_build_object('visit_id', rec ->> 'visit_id', 'generated_by', rec ->> 'generated_by');
    verb := case when tg_op = 'UPDATE' and new.status = 'approved' then 'approve'
                 when tg_op = 'UPDATE' then 'reopen' else verb end;
  elsif tg_table_name = 'device_measurements' then
    meta := jsonb_build_object('customer_id', rec ->> 'customer_id', 'visit_id', rec ->> 'visit_id');
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  values (auth.uid(), public.app_current_role(),
          case tg_table_name
            when 'treatment_menus' then 'menu'
            when 'visits' then 'visit'
            when 'treatments' then 'treatment'
            when 'care_proposals' then 'proposal'
            when 'device_measurements' then 'measurement'
          end || '.' || verb,
          tg_table_name, target, meta);
  return null;
end;
$$;

create trigger audit_treatment_menus after insert or update or delete on public.treatment_menus
  for each row execute function public.audit_salon_change();
create trigger audit_visits after insert or update or delete on public.visits
  for each row execute function public.audit_salon_change();
create trigger audit_treatments after insert or delete on public.treatments
  for each row execute function public.audit_salon_change();
create trigger audit_care_proposals after insert or update on public.care_proposals
  for each row execute function public.audit_salon_change();
create trigger audit_device_measurements after insert or delete on public.device_measurements
  for each row execute function public.audit_salon_change();

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.treatment_menus enable row level security;
alter table public.visits enable row level security;
alter table public.intake_forms enable row level security;
alter table public.counseling_sheets enable row level security;
alter table public.treatments enable row level security;
alter table public.care_proposals enable row level security;
alter table public.device_measurements enable row level security;

revoke all on public.treatment_menus, public.visits, public.intake_forms, public.counseling_sheets,
  public.treatments, public.care_proposals, public.device_measurements from anon;

-- treatment_menus：スタッフは有効なものだけ、管理者はすべて。編集は管理者だけ
create policy treatment_menus_select on public.treatment_menus
  for select to authenticated
  using (public.is_admin() or (public.is_staff_or_admin() and is_active));
create policy treatment_menus_insert on public.treatment_menus
  for insert to authenticated
  with check (public.is_admin() and updated_by = auth.uid());
create policy treatment_menus_update on public.treatment_menus
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin() and updated_by = auth.uid());
create policy treatment_menus_delete on public.treatment_menus
  for delete to authenticated
  using (public.is_admin());
revoke update, truncate on public.treatment_menus from authenticated;
grant update (name, category, description, cautions, price_yen, duration_min, is_active, updated_by)
  on public.treatment_menus to authenticated;

-- visits：担当の顧客だけ。削除は管理者だけ
create policy visits_select on public.visits
  for select to authenticated
  using (public.can_access_customer(customer_id));
create policy visits_insert on public.visits
  for insert to authenticated
  with check (public.can_access_customer(customer_id) and staff_id = auth.uid());
create policy visits_update on public.visits
  for update to authenticated
  using (public.can_access_customer(customer_id))
  with check (public.can_access_customer(customer_id));
create policy visits_delete on public.visits
  for delete to authenticated
  using (public.is_admin());
revoke update, truncate on public.visits from authenticated;
grant update (visited_at, status, next_visit_memo) on public.visits to authenticated;

-- intake_forms
create policy intake_forms_select on public.intake_forms
  for select to authenticated using (public.can_access_visit(visit_id));
create policy intake_forms_insert on public.intake_forms
  for insert to authenticated with check (public.can_access_visit(visit_id));
create policy intake_forms_update on public.intake_forms
  for update to authenticated
  using (public.can_access_visit(visit_id)) with check (public.can_access_visit(visit_id));
create policy intake_forms_delete on public.intake_forms
  for delete to authenticated using (public.is_admin());
revoke update, truncate on public.intake_forms from authenticated;
grant update (form_version, answers, skin_condition_under_treatment) on public.intake_forms to authenticated;

-- counseling_sheets
create policy counseling_sheets_select on public.counseling_sheets
  for select to authenticated using (public.can_access_visit(visit_id));
create policy counseling_sheets_insert on public.counseling_sheets
  for insert to authenticated with check (public.can_access_visit(visit_id));
create policy counseling_sheets_update on public.counseling_sheets
  for update to authenticated
  using (public.can_access_visit(visit_id)) with check (public.can_access_visit(visit_id));
create policy counseling_sheets_delete on public.counseling_sheets
  for delete to authenticated using (public.is_admin());
revoke update, truncate on public.counseling_sheets from authenticated;
grant update (concerns, analysis_summary, proposal, customer_wishes, staff_notes)
  on public.counseling_sheets to authenticated;

-- treatments：記録の削除は担当者も可能（入力の誤りを直すため）
create policy treatments_select on public.treatments
  for select to authenticated using (public.can_access_visit(visit_id));
create policy treatments_insert on public.treatments
  for insert to authenticated
  with check (public.can_access_visit(visit_id) and created_by = auth.uid());
create policy treatments_update on public.treatments
  for update to authenticated
  using (public.can_access_visit(visit_id)) with check (public.can_access_visit(visit_id));
create policy treatments_delete on public.treatments
  for delete to authenticated using (public.can_access_visit(visit_id));
revoke update, truncate on public.treatments from authenticated;
grant update (notes, before_session_id, after_session_id) on public.treatments to authenticated;

-- care_proposals
create policy care_proposals_select on public.care_proposals
  for select to authenticated using (public.can_access_visit(visit_id));
create policy care_proposals_insert on public.care_proposals
  for insert to authenticated
  with check (public.can_access_visit(visit_id) and created_by = auth.uid());
create policy care_proposals_update on public.care_proposals
  for update to authenticated
  using (public.can_access_visit(visit_id)) with check (public.can_access_visit(visit_id));
create policy care_proposals_delete on public.care_proposals
  for delete to authenticated using (public.can_access_visit(visit_id));
revoke update, truncate on public.care_proposals from authenticated;
grant update (menu_ids, draft_text, final_text, generated_by, ai_model, status) on public.care_proposals to authenticated;

-- device_measurements：書き換えはできない。誤りは削除して記録し直す（記録した人か管理者）
create policy device_measurements_select on public.device_measurements
  for select to authenticated using (public.can_access_customer(customer_id));
create policy device_measurements_insert on public.device_measurements
  for insert to authenticated
  with check (public.can_access_customer(customer_id) and recorded_by = auth.uid());
create policy device_measurements_delete on public.device_measurements
  for delete to authenticated
  using (public.is_admin() or (recorded_by = auth.uid() and public.can_access_customer(customer_id)));
revoke update, truncate on public.device_measurements from authenticated;

-- photo_sessions：来店のひも付けは作成時だけ（更新の権限は引き続きなし）

-- =====================================================================
-- 管理者向けの利用状況の集計（顧客を特定できる情報は返さない）
-- =====================================================================
create or replace function public.admin_usage_daily(p_days integer default 30)
returns table (day date, analyses bigint, ai_calls bigint, ai_failed bigint, visits bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 1), 366);
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  with d as (
    select g::date as day from generate_series(today - (days - 1), today, interval '1 day') g
  )
  select d.day,
    (select count(*) from public.analyses a where (a.created_at at time zone 'Asia/Tokyo')::date = d.day),
    (select count(*) from public.ai_usage u where (u.created_at at time zone 'Asia/Tokyo')::date = d.day),
    (select count(*) from public.ai_usage u where (u.created_at at time zone 'Asia/Tokyo')::date = d.day
       and not u.succeeded),
    (select count(*) from public.visits v where (v.visited_at at time zone 'Asia/Tokyo')::date = d.day)
  from d
  order by d.day;
end;
$$;

create or replace function public.admin_usage_by_staff(p_days integer default 30)
returns table (staff_id uuid, display_name text, role public.app_role, is_active boolean,
               visits bigint, analyses bigint, ai_calls bigint)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  days integer := least(greatest(coalesce(p_days, 30), 1), 366);
  since timestamptz := (((now() at time zone 'Asia/Tokyo')::date - (days - 1))::timestamp) at time zone 'Asia/Tokyo';
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.role, p.is_active,
    (select count(*) from public.visits v where v.staff_id = p.id and v.visited_at >= since),
    (select count(*) from public.analyses a where a.created_by = p.id and a.created_at >= since),
    (select count(*) from public.ai_usage u where u.actor_id = p.id and u.created_at >= since)
  from public.profiles p
  where p.role in ('staff', 'admin')
  order by p.is_active desc, p.display_name;
end;
$$;

-- 関数の実行権限
revoke execute on function
  public.can_access_visit(uuid), public.visit_customer(uuid),
  public.treatments_fill_snapshot(), public.care_proposals_approval(), public.check_visit_links(),
  public.audit_salon_change(),
  public.admin_usage_daily(integer), public.admin_usage_by_staff(integer)
from public, anon;
grant execute on function
  public.can_access_visit(uuid),
  public.admin_usage_daily(integer), public.admin_usage_by_staff(integer)
to authenticated;
-- トリガーの中だけで使う関数は、ログイン中の利用者も直接は使えない
revoke execute on function
  public.visit_customer(uuid), public.treatments_fill_snapshot(), public.check_visit_links(),
  public.audit_salon_change()
from authenticated;
