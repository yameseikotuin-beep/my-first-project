-- お客様のメールアドレス（任意）を予約に追加する
--
-- 既存の環境では、この SQL をアプリの更新（Vercel への公開）より先に実行すること。
-- 予約関数のメールアドレスの引数には既定値があるため、この SQL を実行した後も
-- 更新前のアプリはそのまま動く（メールアドレスは空欄として保存される）。

alter table public.bookings
  add column customer_email text not null default ''
  check (customer_email = '' or (char_length(customer_email) <= 254 and customer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- 管理画面用の一覧にメールアドレスを加える（列は末尾に追加する）
create or replace view public.admin_booking_list with (security_invoker = true) as
select
  b.id, b.booking_number, b.customer_name, b.customer_phone, b.notes,
  b.service_id, b.service_name, b.price, b.start_at, b.end_at,
  b.room_id, r.name as room_name,
  b.practitioner_id, p.name as practitioner_name,
  b.status, b.source, b.cancelled_at, b.created_at, b.updated_at,
  b.customer_email
from public.bookings b
join public.rooms r on r.id = b.room_id
left join public.practitioners p on p.id = b.practitioner_id;

-- メールアドレスを小文字・前後の空白なしにそろえる
create function public._normalize_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select lower(btrim(coalesce(p_email, '')))
$$;

-- 空欄、または形式の正しいメールアドレスだけを受け付ける
create function public._validate_email(p_email text) returns void
language plpgsql immutable set search_path = '' as $$
declare
  v text := public._normalize_email(p_email);
begin
  if v <> '' and (char_length(v) > 254 or v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception using errcode = 'P0001', message = 'INVALID_EMAIL';
  end if;
end $$;

-- 予約関数にメールアドレスの引数を追加する（引数が変わるため、作り直す）
drop function public.create_booking(uuid, timestamptz, text, text, text);
drop function public.admin_save_booking(uuid, uuid, timestamptz, text, text, text, uuid, uuid, text);

-- WEB 予約の登録。空きを再確認し、スペース・施術者を割り当ててから保存する
create function public.create_booking(
  p_service_id uuid, p_start_at timestamptz,
  p_customer_name text, p_customer_phone text, p_notes text default '',
  p_customer_email text default ''
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
  perform public._validate_email(p_customer_email);
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
      booking_number, customer_name, customer_phone, customer_email, notes, service_id, service_name, price,
      start_at, end_at, room_id, practitioner_id, status, source
    ) values (
      public._new_booking_number(public._local_date(p_start_at)), btrim(p_customer_name), v_phone,
      public._normalize_email(p_customer_email),
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
  p_status text default 'confirmed',
  p_customer_email text default ''
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
  perform public._validate_email(p_customer_email);
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
        booking_number, customer_name, customer_phone, customer_email, notes, service_id, service_name, price,
        start_at, end_at, room_id, practitioner_id, status, source, cancelled_at
      ) values (
        public._new_booking_number(public._local_date(p_start_at)), btrim(p_customer_name),
        public._normalize_phone(p_customer_phone), public._normalize_email(p_customer_email),
        btrim(coalesce(p_notes, '')),
        svc.id, svc.name, svc.price, p_start_at, v_end, v_res.room_id, v_res.practitioner_id,
        p_status, 'admin', case when p_status = 'cancelled' then now() end
      ) returning id into v_id;
    else
      update public.bookings set
        customer_name = btrim(p_customer_name),
        customer_phone = public._normalize_phone(p_customer_phone),
        customer_email = public._normalize_email(p_customer_email),
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

-- 関数の実行権限
revoke execute on function
  public._normalize_email(text),
  public._validate_email(text),
  public.create_booking(uuid, timestamptz, text, text, text, text),
  public.admin_save_booking(uuid, uuid, timestamptz, text, text, text, uuid, uuid, text, text)
from public, anon, authenticated;

grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_save_booking(uuid, uuid, timestamptz, text, text, text, uuid, uuid, text, text) to authenticated;
