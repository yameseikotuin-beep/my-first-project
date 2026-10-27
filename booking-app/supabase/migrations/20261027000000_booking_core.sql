-- 整骨院・整体院向け WEB 予約システム：テーブル・制約・RLS・予約処理
--
-- 方針
-- * 時刻は timestamptz で保存し、営業時間などの「時刻」は日本時間（Asia/Tokyo）として扱う。
-- * 予約の重複は、データベースの排他制約（EXCLUDE）で最終的に防ぐ。
--   さらに予約確定処理では日付ごとのロックを取ってから空きを再確認する。
-- * 未ログイン（anon）はテーブルを一切読めない。空き状況・メニュー・予約登録は
--   必要な情報だけを返す関数（SECURITY DEFINER）経由でのみ利用できる。
-- * 管理者は public.admins に登録された利用者。RLS とすべての管理用関数で確認する。

create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- 管理者
-- ---------------------------------------------------------------------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.admins is '管理画面を使える利用者。SQL Editor から登録する（docs/setup.md）';

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------
-- 共通：updated_at の自動更新
-- ---------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- システム設定（1行だけ）
-- ---------------------------------------------------------------------
create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  shop_name text not null default '整骨院' check (char_length(shop_name) between 1 and 60),
  shop_phone text not null default '' check (char_length(shop_phone) <= 20),
  -- 予約枠の開始間隔（分）。施術時間とは別に管理する
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  -- 何日先まで予約を受け付けるか（今日を 0 日目とする）
  booking_window_days integer not null default 60 check (booking_window_days between 0 and 365),
  -- 開始時刻の何分前まで WEB 予約を受け付けるか
  min_lead_minutes integer not null default 60 check (min_lead_minutes between 0 and 10080),
  -- 1つの電話番号で持てる今後の予約の上限（WEB 予約のいたずら対策）
  max_active_bookings_per_phone integer not null default 3 check (max_active_bookings_per_phone between 1 and 20),
  -- 施術者を管理するか。false の場合は施術スペースだけで空きを判定する
  use_practitioners boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 施術メニュー
-- ---------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price integer not null check (price between 0 and 1000000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 施術スペース（ベッド・個室など）
-- ---------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger rooms_updated_at before update on public.rooms
  for each row execute function public.set_updated_at();

-- スペースの利用可能時間（任意）。1行もなければ営業時間中はいつでも使える
create table public.room_hours (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0=日曜 … 6=土曜
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index room_hours_room_idx on public.room_hours (room_id, weekday);

-- メニューが使えるスペース（任意）。1行もなければ、どのスペースでも施術できる
create table public.service_rooms (
  service_id uuid not null references public.services (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  primary key (service_id, room_id)
);

-- ---------------------------------------------------------------------
-- 施術者
-- ---------------------------------------------------------------------
create table public.practitioners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger practitioners_updated_at before update on public.practitioners
  for each row execute function public.set_updated_at();

-- 対応できるメニュー。1行もなければ全メニューに対応できる
create table public.practitioner_services (
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (practitioner_id, service_id)
);

-- 曜日ごとの出勤時間。1行もなければ営業時間中はいつでも対応できる
create table public.practitioner_shifts (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index practitioner_shifts_idx on public.practitioner_shifts (practitioner_id, weekday);

-- 休み（日付単位）
create table public.practitioner_days_off (
  practitioner_id uuid not null references public.practitioners (id) on delete cascade,
  off_date date not null,
  note text not null default '' check (char_length(note) <= 100),
  primary key (practitioner_id, off_date)
);

-- ---------------------------------------------------------------------
-- 営業時間・休業日・受付停止時間
-- ---------------------------------------------------------------------
create table public.business_hours (
  weekday smallint primary key check (weekday between 0 and 6),
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  -- 最終受付時刻（この時刻までに開始する予約だけを受け付ける）。null なら終了時刻に収まればよい
  last_start_time time,
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time)),
  check (last_start_time is null or is_closed or (last_start_time >= open_time and last_start_time < close_time))
);
insert into public.business_hours (weekday, is_closed, open_time, close_time, last_start_time) values
  (0, true, null, null, null),
  (1, false, '09:00', '20:00', '19:00'),
  (2, false, '09:00', '20:00', '19:00'),
  (3, false, '09:00', '20:00', '19:00'),
  (4, false, '09:00', '20:00', '19:00'),
  (5, false, '09:00', '20:00', '19:00'),
  (6, false, '09:00', '17:00', '16:00');

-- 祝日・臨時休業・特定日の営業時間変更。曜日の設定より優先する
create table public.business_date_overrides (
  business_date date primary key,
  is_closed boolean not null,
  open_time time,
  close_time time,
  last_start_time time,
  note text not null default '' check (char_length(note) <= 100),
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time)),
  check (last_start_time is null or is_closed or (last_start_time >= open_time and last_start_time < close_time))
);

-- 昼休みなどの受付停止時間。曜日ごと（毎週）または特定の日付
create table public.breaks (
  id uuid primary key default gen_random_uuid(),
  weekday smallint check (weekday between 0 and 6),
  break_date date,
  start_time time not null,
  end_time time not null,
  label text not null default '' check (char_length(label) <= 40),
  check ((weekday is null) <> (break_date is null)),
  check (end_time > start_time)
);
insert into public.breaks (weekday, start_time, end_time, label)
select d, '12:00', '13:00', '昼休み' from generate_series(1, 6) as d;

-- ---------------------------------------------------------------------
-- 予約
-- ---------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  customer_name text not null check (char_length(customer_name) between 1 and 50),
  -- 数字だけに正規化した国内の電話番号
  customer_phone text not null check (customer_phone ~ '^0[0-9]{9,10}$'),
  notes text not null default '' check (char_length(notes) <= 500),
  service_id uuid not null references public.services (id) on delete restrict,
  -- 予約時点のメニュー名・料金（後でメニューを変更しても予約内容が変わらないように）
  service_name text not null,
  price integer not null check (price >= 0),
  start_at timestamptz not null,
  end_at timestamptz not null,
  room_id uuid not null references public.rooms (id) on delete restrict,
  practitioner_id uuid references public.practitioners (id) on delete restrict,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source text not null check (source in ('web', 'admin')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  -- 重複防止の最終防衛線：確定済みの予約どうしで、同じスペース・同じ施術者の時間帯が重ならない
  constraint bookings_no_room_overlap exclude using gist (
    room_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'confirmed'),
  constraint bookings_no_practitioner_overlap exclude using gist (
    practitioner_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status = 'confirmed' and practitioner_id is not null)
);
create index bookings_start_idx on public.bookings (start_at);
create index bookings_phone_idx on public.bookings (customer_phone) where status = 'confirmed';
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- 管理画面用：予約にスペース名・施術者名を付けたもの（呼び出した人の権限＝RLS で読む）
create view public.admin_booking_list with (security_invoker = true) as
select
  b.id, b.booking_number, b.customer_name, b.customer_phone, b.notes,
  b.service_id, b.service_name, b.price, b.start_at, b.end_at,
  b.room_id, r.name as room_name,
  b.practitioner_id, p.name as practitioner_name,
  b.status, b.source, b.cancelled_at, b.created_at, b.updated_at
from public.bookings b
join public.rooms r on r.id = b.room_id
left join public.practitioners p on p.id = b.practitioner_id;

-- ---------------------------------------------------------------------
-- RLS：管理者だけがすべてのテーブルを扱える。未ログインは何も読めない
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'admins', 'app_settings', 'services', 'rooms', 'room_hours', 'service_rooms',
    'practitioners', 'practitioner_services', 'practitioner_shifts', 'practitioner_days_off',
    'business_hours', 'business_date_overrides', 'breaks', 'bookings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;

  foreach t in array array[
    'services', 'rooms', 'room_hours', 'service_rooms',
    'practitioners', 'practitioner_services', 'practitioner_shifts', 'practitioner_days_off',
    'business_date_overrides', 'breaks'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t || '_admin_all', t);
  end loop;
end $$;

-- 1行固定の表は更新だけ許可する
grant select, update on public.app_settings, public.business_hours to authenticated;
create policy app_settings_admin_select on public.app_settings for select to authenticated using (public.is_admin());
create policy app_settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy business_hours_admin_select on public.business_hours for select to authenticated using (public.is_admin());
create policy business_hours_admin_update on public.business_hours for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 予約は読むだけ。登録・変更・キャンセルは重複確認を行う関数からだけ行う
grant select on public.bookings to authenticated;
create policy bookings_admin_select on public.bookings for select to authenticated using (public.is_admin());

revoke all on public.admin_booking_list from anon, authenticated;
grant select on public.admin_booking_list to authenticated;

-- ---------------------------------------------------------------------
-- 内部関数（API からは呼べない）
-- ---------------------------------------------------------------------

-- 日本時間の日付と時刻 → timestamptz
create function public._local_ts(p_date date, p_time time) returns timestamptz
language sql immutable set search_path = '' as $$
  select (p_date + p_time) at time zone 'Asia/Tokyo'
$$;

-- timestamptz → 日本時間の日付
create function public._local_date(p_ts timestamptz) returns date
language sql immutable set search_path = '' as $$
  select (p_ts at time zone 'Asia/Tokyo')::date
$$;

-- 日本時間の今日
create function public._today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Tokyo')::date
$$;

-- その日の営業時間（特定日の設定 → 曜日の設定の順に見る）
create function public._day_hours(
  p_date date,
  out is_open boolean, out open_time time, out close_time time, out last_start_time time
)
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.business_date_overrides;
  h public.business_hours;
begin
  select * into o from public.business_date_overrides where business_date = p_date;
  if found then
    is_open := not o.is_closed;
    if is_open then
      open_time := o.open_time; close_time := o.close_time; last_start_time := o.last_start_time;
    end if;
    return;
  end if;
  select * into h from public.business_hours where weekday = extract(dow from p_date);
  if not found or h.is_closed then
    is_open := false;
    return;
  end if;
  is_open := true;
  open_time := h.open_time; close_time := h.close_time; last_start_time := h.last_start_time;
end $$;

-- 時間に関するルールの確認。問題があれば理由のコード、なければ null を返す。
-- p_admin = true（管理画面からの登録）の場合は、受付期間・直前受付・枠の間隔の制限をかけない。
create function public._time_rule_error(p_start timestamptz, p_end timestamptz, p_admin boolean)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := public._local_date(p_start);
  h record;
  s public.app_settings;
begin
  select * into s from public.app_settings where id = 1;
  select * into h from public._day_hours(d);
  if not h.is_open then
    return 'CLOSED';
  end if;
  if p_start < public._local_ts(d, h.open_time) or p_end > public._local_ts(d, h.close_time) then
    return 'OUTSIDE_HOURS';
  end if;
  if h.last_start_time is not null and p_start > public._local_ts(d, h.last_start_time) then
    return 'AFTER_LAST_START';
  end if;
  if exists (
    select 1 from public.breaks b
    where (b.weekday = extract(dow from d) or b.break_date = d)
      and tstzrange(public._local_ts(d, b.start_time), public._local_ts(d, b.end_time), '[)')
          && tstzrange(p_start, p_end, '[)')
  ) then
    return 'BREAK';
  end if;
  if not p_admin then
    if p_start < now() + make_interval(mins => s.min_lead_minutes) then
      return 'TOO_SOON';
    end if;
    if d > public._today() + s.booking_window_days then
      return 'TOO_FAR';
    end if;
    if mod((extract(epoch from (p_start - public._local_ts(d, h.open_time))) / 60)::integer,
           s.slot_interval_minutes) <> 0
       or extract(second from p_start) <> 0 then
      return 'INVALID_TIME';
    end if;
  end if;
  return null;
end $$;

-- 空いている施術スペース（と、施術者を管理する場合は施術者）を1組選ぶ。
-- スペースと施術者の空きは互いに独立しているため、それぞれ条件を満たす最初のものを選べばよい。
-- p_room / p_practitioner を指定した場合はそれだけを候補にする。見つからなければ room_id は null。
create function public._find_resources(
  p_service_id uuid, p_start timestamptz, p_end timestamptz,
  p_exclude_booking uuid, p_room uuid, p_practitioner uuid,
  out room_id uuid, out practitioner_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
declare
  d date := public._local_date(p_start);
  dow integer := extract(dow from public._local_date(p_start));
  use_p boolean;
begin
  select use_practitioners into use_p from public.app_settings where id = 1;

  select r.id into room_id
  from public.rooms r
  where r.is_active
    and (p_room is null or r.id = p_room)
    and (
      not exists (select 1 from public.service_rooms sr where sr.service_id = p_service_id)
      or exists (select 1 from public.service_rooms sr where sr.service_id = p_service_id and sr.room_id = r.id)
    )
    and (
      not exists (select 1 from public.room_hours rh where rh.room_id = r.id)
      or exists (
        select 1 from public.room_hours rh
        where rh.room_id = r.id and rh.weekday = dow
          and p_start >= public._local_ts(d, rh.start_time) and p_end <= public._local_ts(d, rh.end_time)
      )
    )
    and not exists (
      select 1 from public.bookings b
      where b.room_id = r.id and b.status = 'confirmed'
        and b.id is distinct from p_exclude_booking
        and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
    )
  order by r.sort_order, r.name, r.id
  limit 1;

  if room_id is null or not use_p then
    practitioner_id := null;
    return;
  end if;

  select p.id into practitioner_id
  from public.practitioners p
  where p.is_active
    and (p_practitioner is null or p.id = p_practitioner)
    and (
      not exists (select 1 from public.practitioner_services ps where ps.practitioner_id = p.id)
      or exists (select 1 from public.practitioner_services ps where ps.practitioner_id = p.id and ps.service_id = p_service_id)
    )
    and (
      not exists (select 1 from public.practitioner_shifts sh where sh.practitioner_id = p.id)
      or exists (
        select 1 from public.practitioner_shifts sh
        where sh.practitioner_id = p.id and sh.weekday = dow
          and p_start >= public._local_ts(d, sh.start_time) and p_end <= public._local_ts(d, sh.end_time)
      )
    )
    and not exists (select 1 from public.practitioner_days_off o where o.practitioner_id = p.id and o.off_date = d)
    and not exists (
      select 1 from public.bookings b
      where b.practitioner_id = p.id and b.status = 'confirmed'
        and b.id is distinct from p_exclude_booking
        and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
    )
  order by p.sort_order, p.name, p.id
  limit 1;

  if practitioner_id is null then
    room_id := null;
  end if;
end $$;

-- 指定日の予約可能な開始時刻の一覧
create function public._available_slots(p_service_id uuid, p_date date, p_admin boolean, p_exclude_booking uuid)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  svc public.services;
  s public.app_settings;
  h record;
  t timestamptz;
  last_t timestamptz;
  dur interval;
  step interval;
begin
  select * into svc from public.services where id = p_service_id and (is_active or p_admin);
  if not found then
    return;
  end if;
  select * into s from public.app_settings where id = 1;
  if not p_admin and (p_date < public._today() or p_date > public._today() + s.booking_window_days) then
    return;
  end if;
  select * into h from public._day_hours(p_date);
  if not h.is_open then
    return;
  end if;
  dur := make_interval(mins => svc.duration_minutes);
  step := make_interval(mins => s.slot_interval_minutes);
  t := public._local_ts(p_date, h.open_time);
  last_t := public._local_ts(p_date, coalesce(h.last_start_time, h.close_time));
  while t <= last_t loop
    if public._time_rule_error(t, t + dur, p_admin) is null
       and (select r.room_id from public._find_resources(p_service_id, t, t + dur, p_exclude_booking, null, null) r) is not null then
      start_at := t;
      end_at := t + dur;
      return next;
    end if;
    t := t + step;
  end loop;
end $$;

-- 予約の登録・変更の前に、その日の予約処理を1つずつ順番に行うためのロック
create function public._lock_booking_day(p_date date) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended('booking-day:' || p_date::text, 0))
$$;

-- 電話番号を数字だけにする（全角数字にも対応）
create function public._normalize_phone(p_phone text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(coalesce(p_phone, ''), '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g')
$$;

create function public._new_booking_number(p_date date) returns text
language plpgsql volatile set search_path = '' as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := to_char(p_date, 'YYMMDD') || '-';
    for i in 1..4 loop
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.bookings where booking_number = candidate);
  end loop;
  return candidate;
end $$;

create function public._validate_customer(p_name text, p_phone text, p_notes text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'INVALID_NAME';
  end if;
  if public._normalize_phone(p_phone) !~ '^0[0-9]{9,10}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_PHONE';
  end if;
  if char_length(coalesce(p_notes, '')) > 500 then
    raise exception using errcode = 'P0001', message = 'INVALID_NOTES';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 公開用の関数（未ログインでも呼べる。個人情報は返さない）
-- ---------------------------------------------------------------------

-- 店舗名・受付条件など、予約画面に必要な設定だけ
create function public.get_public_info()
returns table (shop_name text, shop_phone text, booking_window_days integer, min_lead_minutes integer, today date)
language sql stable security definer set search_path = '' as $$
  select s.shop_name, s.shop_phone, s.booking_window_days, s.min_lead_minutes, public._today()
  from public.app_settings s where s.id = 1
$$;

-- 予約を受け付けているメニュー
create function public.get_public_services()
returns table (id uuid, name text, description text, duration_minutes integer, price integer)
language sql stable security definer set search_path = '' as $$
  select id, name, description, duration_minutes, price
  from public.services where is_active
  order by sort_order, name
$$;

-- 期間内の各日が営業日かどうか（最大 62 日分）
create function public.get_public_open_days(p_from date, p_to date)
returns table (day date, is_open boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.app_settings;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception using errcode = 'P0001', message = 'INVALID_RANGE';
  end if;
  select * into s from public.app_settings where id = 1;
  return query
    select g::date, (select h.is_open from public._day_hours(g::date) h)
                    and g::date between public._today() and public._today() + s.booking_window_days
    from generate_series(p_from, p_to, interval '1 day') g;
end $$;

-- 指定したメニュー・日付の予約可能な時間
create function public.get_available_slots(p_service_id uuid, p_date date)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select * from public._available_slots(p_service_id, p_date, false, null)
$$;

-- WEB 予約の登録。空きを再確認し、スペース・施術者を割り当ててから保存する
create function public.create_booking(
  p_service_id uuid, p_start_at timestamptz,
  p_customer_name text, p_customer_phone text, p_notes text default ''
)
returns table (booking_number text, service_name text, price integer, start_at timestamptz, end_at timestamptz)
language plpgsql volatile security definer set search_path = '' as $$
declare
  svc public.services;
  s public.app_settings;
  v_end timestamptz;
  v_err text;
  v_res record;
  v_phone text := public._normalize_phone(p_customer_phone);
  v_row public.bookings;
begin
  perform public._validate_customer(p_customer_name, p_customer_phone, p_notes);
  select * into svc from public.services where id = p_service_id and is_active;
  if not found or p_start_at is null then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;
  select * into s from public.app_settings where id = 1;
  v_end := p_start_at + make_interval(mins => svc.duration_minutes);

  -- 同じ日の予約処理は順番に行う（同時に確定しようとしても、後の処理は最新の状態で確認する）
  perform public._lock_booking_day(public._local_date(p_start_at));

  v_err := public._time_rule_error(p_start_at, v_end, false);
  if v_err is not null then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = v_err;
  end if;

  if (select count(*) from public.bookings b
      where b.customer_phone = v_phone and b.status = 'confirmed' and b.end_at > now())
     >= s.max_active_bookings_per_phone then
    raise exception using errcode = 'P0001', message = 'TOO_MANY_BOOKINGS';
  end if;

  select * into v_res from public._find_resources(p_service_id, p_start_at, v_end, null, null, null);
  if v_res.room_id is null then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = 'NO_RESOURCE';
  end if;

  begin
    insert into public.bookings (
      booking_number, customer_name, customer_phone, notes, service_id, service_name, price,
      start_at, end_at, room_id, practitioner_id, status, source
    ) values (
      public._new_booking_number(public._local_date(p_start_at)), btrim(p_customer_name), v_phone,
      btrim(coalesce(p_notes, '')), svc.id, svc.name, svc.price,
      p_start_at, v_end, v_res.room_id, v_res.practitioner_id, 'confirmed', 'web'
    ) returning * into v_row;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = 'CONFLICT';
  end;

  booking_number := v_row.booking_number;
  service_name := v_row.service_name;
  price := v_row.price;
  start_at := v_row.start_at;
  end_at := v_row.end_at;
  return next;
end $$;

-- ---------------------------------------------------------------------
-- 管理者用の関数
-- ---------------------------------------------------------------------
create function public._require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
end $$;

-- 手動登録・変更画面用の空き時間（受付期間・直前受付の制限なし）
create function public.admin_available_slots(p_service_id uuid, p_date date, p_exclude_booking uuid default null)
returns table (start_at timestamptz, end_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return query select * from public._available_slots(p_service_id, p_date, true, p_exclude_booking);
end $$;

-- 予約の登録（p_booking_id が null）と変更。WEB 予約と同じ重複防止ルールで確認する。
-- p_room_id / p_practitioner_id が null の場合は自動で割り当てる。
create function public.admin_save_booking(
  p_booking_id uuid,
  p_service_id uuid,
  p_start_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_notes text,
  p_room_id uuid default null,
  p_practitioner_id uuid default null,
  p_status text default 'confirmed'
)
returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  svc public.services;
  old public.bookings;
  v_end timestamptz;
  v_err text;
  v_res record;
  v_use_p boolean;
  v_unchanged boolean := false;
  v_id uuid;
begin
  perform public._require_admin();
  perform public._validate_customer(p_customer_name, p_customer_phone, p_notes);
  if p_status not in ('confirmed', 'cancelled') or p_start_at is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INPUT';
  end if;
  select * into svc from public.services where id = p_service_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'SERVICE_UNAVAILABLE';
  end if;
  select use_practitioners into v_use_p from public.app_settings where id = 1;
  v_end := p_start_at + make_interval(mins => svc.duration_minutes);

  if p_booking_id is not null then
    select * into old from public.bookings where id = p_booking_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'NOT_FOUND';
    end if;
    -- 日付をまたぐ変更でも順番が崩れないよう、日付の小さい順にロックする
    perform public._lock_booking_day(least(public._local_date(old.start_at), public._local_date(p_start_at)));
    perform public._lock_booking_day(greatest(public._local_date(old.start_at), public._local_date(p_start_at)));
    select * into old from public.bookings where id = p_booking_id for update;
    -- 時間・メニュー・割り当てを変えない確定済み予約の修正（名前・備考など）は、営業時間の確認をしない
    v_unchanged := old.status = 'confirmed' and p_status = 'confirmed'
      and old.service_id = p_service_id and old.start_at = p_start_at and old.end_at = v_end
      and (p_room_id is null or p_room_id = old.room_id)
      and (p_practitioner_id is null or p_practitioner_id is not distinct from old.practitioner_id);
  else
    perform public._lock_booking_day(public._local_date(p_start_at));
  end if;

  if v_unchanged then
    select old.room_id as room_id, old.practitioner_id as practitioner_id into v_res;
  elsif p_status = 'confirmed' then
    v_err := public._time_rule_error(p_start_at, v_end, true);
    if v_err is not null then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = v_err;
    end if;
    select * into v_res from public._find_resources(
      p_service_id, p_start_at, v_end, p_booking_id, p_room_id,
      case when v_use_p then p_practitioner_id end);
    if v_res.room_id is null then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = 'NO_RESOURCE';
    end if;
  else
    -- キャンセル扱いの予約は枠を占有しないため、割り当ては今のまま（新規なら指定か最初のスペース）にする
    select coalesce(p_room_id, old.room_id, (select r.id from public.rooms r order by r.sort_order, r.name limit 1)) as room_id,
           case when p_booking_id is null then p_practitioner_id else coalesce(p_practitioner_id, old.practitioner_id) end as practitioner_id
      into v_res;
    if v_res.room_id is null then
      raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = 'NO_RESOURCE';
    end if;
  end if;

  begin
    if p_booking_id is null then
      insert into public.bookings (
        booking_number, customer_name, customer_phone, notes, service_id, service_name, price,
        start_at, end_at, room_id, practitioner_id, status, source, cancelled_at
      ) values (
        public._new_booking_number(public._local_date(p_start_at)), btrim(p_customer_name),
        public._normalize_phone(p_customer_phone), btrim(coalesce(p_notes, '')),
        svc.id, svc.name, svc.price, p_start_at, v_end, v_res.room_id, v_res.practitioner_id,
        p_status, 'admin', case when p_status = 'cancelled' then now() end
      ) returning id into v_id;
    else
      update public.bookings set
        customer_name = btrim(p_customer_name),
        customer_phone = public._normalize_phone(p_customer_phone),
        notes = btrim(coalesce(p_notes, '')),
        service_id = svc.id,
        service_name = case when old.service_id = svc.id then old.service_name else svc.name end,
        price = case when old.service_id = svc.id then old.price else svc.price end,
        start_at = p_start_at,
        end_at = v_end,
        room_id = v_res.room_id,
        practitioner_id = v_res.practitioner_id,
        status = p_status,
        cancelled_at = case when p_status = 'cancelled' then coalesce(old.cancelled_at, now()) end
      where id = p_booking_id
      returning id into v_id;
    end if;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'SLOT_UNAVAILABLE', detail = 'CONFLICT';
  end;
  return v_id;
end $$;

create function public.admin_cancel_booking(p_booking_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public._require_admin();
  update public.bookings
     set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now())
   where id = p_booking_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 関数の実行権限（Supabase は既定で全員に付与するため、明示的に絞る）
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.get_public_info(),
  public.get_public_services(),
  public.get_public_open_days(date, date),
  public.get_available_slots(uuid, date),
  public.create_booking(uuid, timestamptz, text, text, text)
to anon, authenticated;

grant execute on function
  public.is_admin(),
  public.admin_available_slots(uuid, date, uuid),
  public.admin_save_booking(uuid, uuid, timestamptz, text, text, text, uuid, uuid, text),
  public.admin_cancel_booking(uuid)
to authenticated;

-- 今後この移行ファイルの所有者が作る関数も、既定では誰にも実行権限を付けない
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
