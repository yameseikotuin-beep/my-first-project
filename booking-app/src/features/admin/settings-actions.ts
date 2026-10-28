'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { dbErrorState, type FormState } from '@/lib/form-state';
import {
  breakSchema,
  businessHourSchema,
  dateOverrideSchema,
  fieldErrorsOf,
  resourceSchema,
  serviceSchema,
  settingsSchema,
  uuidSchema,
  weeklyRangeSchema,
  dateSchema,
} from '@/lib/validation/schemas';

// メニュー・施術スペース・施術者・営業時間・受付設定の保存。
// すべての処理で最初に管理者であることを確認する（データベースの RLS でも確認している）。

const saved: FormState = { ok: true, message: '保存しました。' };

/** 画面の表示を最新にする（予約画面にも反映する） */
function done(state: FormState = saved): FormState {
  revalidatePath('/', 'layout');
  return state;
}

function validId(id: unknown): id is string {
  return uuidSchema.safeParse(id).success;
}

// ---------------------------------------------------------------------
// メニュー
// ---------------------------------------------------------------------
export async function saveService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  const parsed = serviceSchema.safeParse({ ...Object.fromEntries(formData), roomIds: formData.getAll('roomIds') });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const row = {
    name: v.name,
    description: v.description,
    duration_minutes: v.durationMinutes,
    price: v.price,
    sort_order: v.sortOrder,
    is_active: v.isActive,
  };
  let serviceId: string;
  if (validId(id)) {
    const { error } = await supabase.from('services').update(row).eq('id', id);
    if (error) return dbErrorState(error);
    serviceId = id;
  } else {
    const { data, error } = await supabase.from('services').insert(row).select('id').single();
    if (error || !data) return dbErrorState(error);
    serviceId = data.id;
  }
  const del = await supabase.from('service_rooms').delete().eq('service_id', serviceId);
  if (del.error) return dbErrorState(del.error);
  if (v.roomIds.length) {
    const ins = await supabase.from('service_rooms').insert(v.roomIds.map((room_id) => ({ service_id: serviceId, room_id })));
    if (ins.error) return dbErrorState(ins.error);
  }
  done();
  redirect('/admin/services?saved=1');
}

export async function deleteService(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  if (!validId(id)) return { message: 'メニューが見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) {
    return error.code === '23503'
      ? { message: 'このメニューは予約で使われているため削除できません。「WEB予約を受け付ける」をオフにしてください。' }
      : dbErrorState(error);
  }
  done();
  redirect('/admin/services?deleted=1');
}

// ---------------------------------------------------------------------
// 施術スペース・施術者（同じ形の表）
// ---------------------------------------------------------------------
type ResourceTable = 'rooms' | 'practitioners';

async function saveResource(table: ResourceTable, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  const parsed = resourceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const row = { name: parsed.data.name, sort_order: parsed.data.sortOrder, is_active: parsed.data.isActive };
  const supabase = await createClient();
  const { error } = validId(id)
    ? await supabase.from(table).update(row).eq('id', id)
    : await supabase.from(table).insert(row);
  if (error) return dbErrorState(error);
  return done(validId(id) ? saved : { ok: true, message: '追加しました。' });
}

async function deleteResource(table: ResourceTable, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  if (!validId(id)) return { message: '見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return dbErrorState(error);
  done();
  redirect(`/admin/${table}?deleted=1`);
}

export async function saveRoom(_prev: FormState, formData: FormData) {
  await requireAdmin();
  return saveResource('rooms', formData);
}
export async function deleteRoom(_prev: FormState, formData: FormData) {
  await requireAdmin();
  return deleteResource('rooms', formData);
}
export async function savePractitioner(_prev: FormState, formData: FormData) {
  await requireAdmin();
  return saveResource('practitioners', formData);
}
export async function deletePractitioner(_prev: FormState, formData: FormData) {
  await requireAdmin();
  return deleteResource('practitioners', formData);
}

// 曜日ごとの時間帯（スペースの利用可能時間・施術者の出勤時間）
export async function addWeeklyRange(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = formData.get('kind');
  const ownerId = formData.get('ownerId');
  if ((kind !== 'room' && kind !== 'practitioner') || !validId(ownerId)) return { message: '入力内容を確認してください。' };
  const parsed = weeklyRangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const range = { weekday: parsed.data.weekday, start_time: parsed.data.startTime, end_time: parsed.data.endTime };
  const supabase = await createClient();
  const { error } =
    kind === 'room'
      ? await supabase.from('room_hours').insert({ room_id: ownerId, ...range })
      : await supabase.from('practitioner_shifts').insert({ practitioner_id: ownerId, ...range });
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '追加しました。' });
}

export async function deleteWeeklyRange(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = formData.get('kind');
  const id = formData.get('id');
  if ((kind !== 'room' && kind !== 'practitioner') || !validId(id)) return { message: '見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from(kind === 'room' ? 'room_hours' : 'practitioner_shifts').delete().eq('id', id);
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '削除しました。' });
}

export async function savePractitionerServices(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  const serviceIds = formData.getAll('serviceIds').filter(validId);
  if (!validId(id)) return { message: '見つかりません。' };
  const supabase = await createClient();
  const del = await supabase.from('practitioner_services').delete().eq('practitioner_id', id);
  if (del.error) return dbErrorState(del.error);
  if (serviceIds.length) {
    const ins = await supabase
      .from('practitioner_services')
      .insert(serviceIds.map((service_id) => ({ practitioner_id: id, service_id })));
    if (ins.error) return dbErrorState(ins.error);
  }
  return done();
}

export async function addDayOff(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  const date = dateSchema.safeParse(formData.get('offDate'));
  const note = String(formData.get('note') ?? '').trim().slice(0, 100);
  if (!validId(id)) return { message: '見つかりません。' };
  if (!date.success) return { message: '日付を選択してください。' };
  const supabase = await createClient();
  const { error } = await supabase.from('practitioner_days_off').insert({ practitioner_id: id, off_date: date.data, note });
  if (error) return error.code === '23505' ? { message: 'その日はすでに休みに登録されています。' } : dbErrorState(error);
  return done({ ok: true, message: '休みを追加しました。' });
}

export async function deleteDayOff(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  const date = dateSchema.safeParse(formData.get('offDate'));
  if (!validId(id) || !date.success) return { message: '見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from('practitioner_days_off').delete().eq('practitioner_id', id).eq('off_date', date.data);
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '削除しました。' });
}

// ---------------------------------------------------------------------
// 営業時間・受付停止時間・特定日
// ---------------------------------------------------------------------
export async function saveBusinessHours(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const rows = [];
  const errors: string[] = [];
  const names = ['日', '月', '火', '水', '木', '金', '土'];
  for (let w = 0; w < 7; w++) {
    const parsed = businessHourSchema.safeParse({
      weekday: w,
      isClosed: formData.get(`closed_${w}`) ?? undefined,
      openTime: formData.get(`open_${w}`) ?? undefined,
      closeTime: formData.get(`close_${w}`) ?? undefined,
      lastStartTime: formData.get(`last_${w}`) ?? undefined,
    });
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((i) => `${names[w]}曜日：${i.message}`));
      continue;
    }
    const v = parsed.data;
    rows.push({
      weekday: w,
      is_closed: v.isClosed,
      open_time: v.isClosed ? null : v.openTime,
      close_time: v.isClosed ? null : v.closeTime,
      last_start_time: v.isClosed ? null : v.lastStartTime,
    });
  }
  if (errors.length) return { fieldErrors: { hours: errors } };
  const supabase = await createClient();
  for (const { weekday, ...row } of rows) {
    const { error } = await supabase.from('business_hours').update(row).eq('weekday', weekday);
    if (error) return dbErrorState(error);
  }
  return done();
}

export async function addBreak(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = breakSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('breaks').insert({
    weekday: v.kind === 'weekly' ? Number(v.weekday) : null,
    break_date: v.kind === 'date' ? v.breakDate : null,
    start_time: v.startTime,
    end_time: v.endTime,
    label: v.label,
  });
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '受付停止時間を追加しました。' });
}

export async function deleteBreak(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = formData.get('id');
  if (!validId(id)) return { message: '見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from('breaks').delete().eq('id', id);
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '削除しました。' });
}

export async function saveDateOverride(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = dateOverrideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const v = parsed.data;
  const row = {
    is_closed: v.isClosed,
    open_time: v.isClosed ? null : v.openTime,
    close_time: v.isClosed ? null : v.closeTime,
    last_start_time: v.isClosed ? null : v.lastStartTime,
    note: v.note,
  };
  const supabase = await createClient();
  // 同じ日の設定があれば置き換える
  const del = await supabase.from('business_date_overrides').delete().eq('business_date', v.businessDate);
  if (del.error) return dbErrorState(del.error);
  const { error } = await supabase.from('business_date_overrides').insert({ business_date: v.businessDate, ...row });
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '特定日の設定を保存しました。' });
}

export async function deleteDateOverride(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const date = dateSchema.safeParse(formData.get('businessDate'));
  if (!date.success) return { message: '見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.from('business_date_overrides').delete().eq('business_date', date.data);
  if (error) return dbErrorState(error);
  return done({ ok: true, message: '削除しました。' });
}

// ---------------------------------------------------------------------
// 予約受付の設定
// ---------------------------------------------------------------------
export async function saveSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('app_settings')
    .update({
      shop_name: v.shopName,
      shop_phone: v.shopPhone,
      slot_interval_minutes: v.slotIntervalMinutes,
      booking_window_days: v.bookingWindowDays,
      min_lead_minutes: v.minLeadMinutes,
      max_active_bookings_per_phone: v.maxActiveBookingsPerPhone,
      notify_emails: v.notifyEmails,
    })
    .eq('id', 1);
  if (error) return dbErrorState(error);
  return done();
}

export async function setUsePractitioners(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const enabled = formData.get('enabled') === 'true';
  const supabase = await createClient();
  const { error } = await supabase.from('app_settings').update({ use_practitioners: enabled }).eq('id', 1);
  if (error) return dbErrorState(error);
  return done({
    ok: true,
    message: enabled ? '施術者の管理を有効にしました。' : '施術者の管理を無効にしました。',
  });
}
