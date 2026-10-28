-- 予約のお知らせメール：院あての通知の送り先を設定できるようにする
--
-- * app_settings.notify_emails … 新しい WEB 予約を知らせるメールの送り先（最大5件）。管理画面の「予約受付の設定」で変更する
-- * create_booking … メールの作成に必要な店舗名・電話番号・通知の送り先も返すようにする
--   （送り先は院のアドレスで、お客様への確認メールの送信元と同じく公開されている情報として扱う）
--
-- 既存の環境では、この SQL をアプリの更新（Vercel への公開）より先に実行すること。
-- 返す列が増えるだけなので、更新前のアプリはそのまま動く。何度実行しても同じ結果になる。

create or replace function public._valid_email_list(p_emails text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(cardinality(p_emails), 0) <= 5
     and not exists (
       select 1 from unnest(coalesce(p_emails, '{}')) e
       where char_length(e) > 254 or e !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     )
$$;

alter table public.app_settings
  add column if not exists notify_emails text[] not null default '{}'
  check (public._valid_email_list(notify_emails));

-- 返す列が変わるため、作り直す
drop function if exists public.create_booking(uuid, timestamptz, text, text, text, text);

-- WEB 予約の登録。空きを再確認し、スペース・施術者を割り当ててから保存する
create function public.create_booking(
  p_service_id uuid, p_start_at timestamptz,
  p_customer_name text, p_customer_phone text, p_notes text default '',
  p_customer_email text default null
)
returns table (
  booking_number text, service_name text, price integer, start_at timestamptz, end_at timestamptz,
  shop_name text, shop_phone text, notify_emails text[]
)
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
  -- WEB 予約ではメールアドレスを必須とする（省略＝更新前のアプリからの呼び出しだけは受け付ける）
  if p_customer_email is not null and public._normalize_email(p_customer_email) = '' then
    raise exception using errcode = 'P0001', message = 'EMAIL_REQUIRED';
  end if;
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
  shop_name := s.shop_name;
  shop_phone := s.shop_phone;
  notify_emails := s.notify_emails;
  return next;
end $$;

revoke execute on function public._valid_email_list(text[]) from public, anon, authenticated;
-- 設定の保存時の確認（CHECK 制約）で使うため、ログインした利用者は実行できるようにする（入力を確かめるだけの関数）
grant execute on function public._valid_email_list(text[]) to authenticated;
revoke execute on function public.create_booking(uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_booking(uuid, timestamptz, text, text, text, text) to anon, authenticated;
