'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { classifyBookingError } from '@/lib/booking-errors';
import type { FormState } from '@/lib/form-state';
import { jstIso } from '@/lib/time';
import { adminBookingSchema, fieldErrorsOf, uuidSchema } from '@/lib/validation/schemas';

// 予約の手動登録・変更。WEB 予約と同じ重複防止ルールをデータベースの関数で適用する。
export async function saveBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = adminBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_save_booking', {
    p_booking_id: v.bookingId,
    p_service_id: v.serviceId,
    p_start_at: jstIso(v.date, v.time),
    p_customer_name: v.customerName,
    p_customer_phone: v.customerPhone,
    p_notes: v.notes,
    p_room_id: v.roomId,
    p_practitioner_id: v.practitionerId,
    p_status: v.status,
  });
  if (error || typeof data !== 'string') {
    const e = classifyBookingError(error);
    return {
      message:
        e.kind === 'slot'
          ? e.message.replace('別の時間を選んでください。', '時間・スペース・施術者を変えてください。')
          : e.kind === 'unknown'
            ? '保存できませんでした。予約は登録・変更されていません。時間をおいてもう一度お試しください。'
            : e.message,
    };
  }
  revalidatePath('/admin', 'layout');
  redirect(`/admin/bookings/${data}?saved=1`);
}

export async function cancelBooking(bookingId: string): Promise<FormState> {
  await requireAdmin();
  if (!uuidSchema.safeParse(bookingId).success) return { message: '予約が見つかりません。' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_cancel_booking', { p_booking_id: bookingId });
  if (error) return { message: classifyBookingError(error).message };
  revalidatePath('/admin', 'layout');
  return { ok: true, message: '予約をキャンセルしました。' };
}
