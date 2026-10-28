'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { interpretCreateBooking, type BookingErrorKind } from '@/lib/booking-errors';
import { fieldErrorsOf, publicBookingSchema } from '@/lib/validation/schemas';
import { COMPLETE_COOKIE, encodeCompleted } from './completed';

export type BookingFormState = {
  message?: string;
  kind?: BookingErrorKind;
  fieldErrors?: Record<string, string[]>;
};

// 手順6：予約確定。サーバー側で入力を再確認し、データベースの予約関数で空きを再確認して保存する。
export async function submitBooking(_prev: BookingFormState, formData: FormData): Promise<BookingFormState> {
  if (!isSupabaseConfigured()) {
    return { kind: 'unknown', message: '現在WEB予約を受け付けられません。お手数ですが店舗へご連絡ください。' };
  }
  const parsed = publicBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error);
    if (fieldErrors.website) {
      // 見えない入力欄に入力がある＝自動送信の可能性が高い。理由は伝えない
      return { kind: 'input', message: '予約を受け付けられませんでした。' };
    }
    return { kind: 'input', message: '入力内容を確認してください。', fieldErrors };
  }
  const v = parsed.data;

  let result;
  try {
    const supabase = await createClient();
    result = interpretCreateBooking(
      await supabase.rpc('create_booking', {
        p_service_id: v.serviceId,
        p_start_at: v.startAt,
        p_customer_name: v.customerName,
        p_customer_phone: v.customerPhone,
        p_notes: v.notes,
        p_customer_email: v.customerEmail,
      }),
    );
  } catch {
    // 通信障害など。予約は確定していない
    result = interpretCreateBooking({ data: null, error: { message: 'NETWORK' } });
  }
  if (!result.ok) return { kind: result.kind, message: result.message };

  // 完了画面に表示する内容（予約番号・メニュー・日時・料金だけ。氏名・電話番号・メールアドレスは含めない）
  const cookieStore = await cookies();
  cookieStore.set(COMPLETE_COOKIE, encodeCompleted(result.booking), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/book/complete',
    maxAge: 60 * 30,
  });
  redirect('/book/complete');
}
