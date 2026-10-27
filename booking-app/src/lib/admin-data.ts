import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addDays, jstIso } from '@/lib/time';
import type { AdminBookingListRow, AppSettingsRow, PractitionerRow, RoomRow, ServiceRow } from '@/lib/supabase/database.types';

// 管理画面で読むデータ。ログイン中の管理者の権限（RLS）で読む。
// 呼び出す画面では必ず先に requireAdmin() を呼ぶこと。

export class AdminDataError extends Error {}

function check<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data === null) throw new AdminDataError(`${what} failed`);
  return result.data;
}

export async function getSettings(): Promise<AppSettingsRow> {
  const supabase = await createClient();
  return check(await supabase.from('app_settings').select('*').eq('id', 1).single(), 'app_settings');
}

export async function listServices(): Promise<ServiceRow[]> {
  const supabase = await createClient();
  return check(await supabase.from('services').select('*').order('sort_order').order('name'), 'services');
}

export async function listRooms(): Promise<RoomRow[]> {
  const supabase = await createClient();
  return check(await supabase.from('rooms').select('*').order('sort_order').order('name'), 'rooms');
}

export async function listPractitioners(): Promise<PractitionerRow[]> {
  const supabase = await createClient();
  return check(await supabase.from('practitioners').select('*').order('sort_order').order('name'), 'practitioners');
}

/** 日本時間の from 日 0:00 から to 日の終わりまでに始まる予約 */
export async function listBookingsBetween(
  from: string,
  to: string,
  opts: { status?: 'confirmed' | 'cancelled'; nameOrPhone?: string } = {},
): Promise<AdminBookingListRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from('admin_booking_list')
    .select('*')
    .gte('start_at', jstIso(from, '00:00'))
    .lt('start_at', jstIso(addDays(to, 1), '00:00'));
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.nameOrPhone) {
    const term = opts.nameOrPhone.replace(/[%_\\]/g, '');
    const digits = term.replace(/[^0-9]/g, '');
    q = /^[0-9\-\s]+$/.test(term) && digits ? q.like('customer_phone', `%${digits}%`) : q.ilike('customer_name', `%${term}%`);
  }
  return check(await q.order('start_at').order('room_name').limit(500), 'bookings');
}

/** これから始まる確定済みの予約（直近） */
export async function listUpcomingBookings(limit: number): Promise<AdminBookingListRow[]> {
  const supabase = await createClient();
  return check(
    await supabase
      .from('admin_booking_list')
      .select('*')
      .eq('status', 'confirmed')
      .gte('start_at', new Date().toISOString())
      .order('start_at')
      .limit(limit),
    'upcoming bookings',
  );
}

export async function getBooking(id: string): Promise<AdminBookingListRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('admin_booking_list').select('*').eq('id', id).maybeSingle();
  if (error) throw new AdminDataError('booking failed');
  return data;
}
