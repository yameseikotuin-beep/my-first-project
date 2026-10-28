'use server';

import { cookies, headers } from 'next/headers';
import { jstDate } from '@/lib/time';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import { interpretCreateBooking, type BookingErrorKind } from '@/lib/booking-errors';
import { fieldErrorsOf, publicBookingSchema } from '@/lib/validation/schemas';
import { sendMails } from '@/lib/mail';
import { COMPLETE_COOKIE, encodeCompleted } from './completed';
import { clinicNotificationMail, customerConfirmationMail } from './booking-mail';

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
  let row: Record<string, unknown> | undefined;
  try {
    const supabase = await createClient();
    const response = await supabase.rpc('create_booking', {
      p_service_id: v.serviceId,
      p_start_at: v.startAt,
      p_customer_name: v.customerName,
      p_customer_phone: v.customerPhone,
      p_notes: v.notes,
      p_customer_email: v.customerEmail,
    });
    result = interpretCreateBooking(response);
    row = Array.isArray(response.data) ? response.data[0] : undefined;
  } catch {
    // 通信障害など。予約は確定していない
    result = interpretCreateBooking({ data: null, error: { message: 'NETWORK' } });
  }
  if (!result.ok) return { kind: result.kind, message: result.message };

  // 予約完了メール（お客様あて）と新しい予約の通知（院あて）。送れなくても予約は確定している
  const b = result.booking;
  const shopName = typeof row?.shop_name === 'string' ? row.shop_name : '';
  const notifyEmails = Array.isArray(row?.notify_emails) ? (row.notify_emails as string[]) : [];
  const mail = {
    shopName,
    shopPhone: typeof row?.shop_phone === 'string' ? row.shop_phone : '',
    bookingNumber: b.bookingNumber,
    serviceName: b.serviceName,
    price: b.price,
    startAt: b.startAt,
    endAt: b.endAt,
    customerName: v.customerName,
    customerPhone: v.customerPhone,
    customerEmail: v.customerEmail,
    notes: v.notes,
  };
  const adminUrl = `${await siteOrigin()}/admin/bookings?from=${jstDate(b.startAt)}`;
  const [customerSent] = await sendMails([
    { ...customerConfirmationMail(mail), to: v.customerEmail ? [v.customerEmail] : [], fromName: shopName },
    { ...clinicNotificationMail(mail, adminUrl), to: notifyEmails, replyTo: v.customerEmail || undefined, fromName: '予約システム' },
  ]).catch(() => [false]);
  result.booking.mailSent = customerSent;

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

/**
 * メールに載せる管理画面の URL の起点。
 * 要求の Host ヘッダーは書き換えられる可能性があるため、Vercel が設定する本番の URL を優先する。
 */
async function siteOrigin(): Promise<string> {
  const configured = process.env.SITE_URL?.trim() || process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (configured) return (configured.startsWith('http') ? configured : `https://${configured}`).replace(/\/$/, '');
  const host = (await headers()).get('host') ?? 'localhost:3000';
  return `${/^(localhost|127\.)/.test(host) ? 'http' : 'https'}://${host}`;
}
