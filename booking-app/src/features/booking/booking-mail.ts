import { formatDate, formatPrice, formatTimeRange, jstDate } from '@/lib/time';
import { formatPhone } from '@/lib/phone';

// 予約完了メール（お客様あて）と、新しい予約の通知メール（院あて）の文面

export type BookingMailInput = {
  shopName: string;
  shopPhone: string;
  bookingNumber: string;
  serviceName: string;
  price: number;
  startAt: string;
  endAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
};

function when(b: BookingMailInput) {
  return `${formatDate(jstDate(b.startAt), true)} ${formatTimeRange(b.startAt, b.endAt)}`;
}

export function customerConfirmationMail(b: BookingMailInput) {
  const lines = [
    `${b.customerName} 様`,
    '',
    `${b.shopName}です。ご予約ありがとうございます。`,
    '以下の内容でご予約を承りました。',
    '',
    '――――――――――――――――',
    `予約番号：${b.bookingNumber}`,
    `日時　　：${when(b)}`,
    `メニュー：${b.serviceName}`,
    `料金　　：${formatPrice(b.price)}（当日店頭でお支払いください）`,
    '――――――――――――――――',
    '',
    b.shopPhone
      ? `ご予約の変更・キャンセルは、お電話（${b.shopPhone}）でご連絡ください。`
      : 'ご予約の変更・キャンセルは、店舗までご連絡ください。',
    'ご来院をお待ちしております。',
    '',
    '※このメールは予約システムから自動で送信しています。',
    '※お心当たりのない場合は、お手数ですがこのメールを破棄してください。',
    '',
    b.shopName,
    ...(b.shopPhone ? [`TEL：${b.shopPhone}`] : []),
  ];
  return { subject: `【${b.shopName}】ご予約を承りました（予約番号 ${b.bookingNumber}）`, text: lines.join('\n') };
}

export function clinicNotificationMail(b: BookingMailInput, adminUrl: string) {
  const lines = [
    'WEBから新しい予約が入りました。',
    '',
    `予約番号：${b.bookingNumber}`,
    `日時　　：${when(b)}`,
    `メニュー：${b.serviceName}（${formatPrice(b.price)}）`,
    `お名前　：${b.customerName} 様`,
    `電話番号：${formatPhone(b.customerPhone)}`,
    `メール　：${b.customerEmail || 'なし'}`,
    `備考　　：${b.notes || 'なし'}`,
    '',
    `管理画面で確認する：${adminUrl}`,
    '',
    '※このメールは予約システムから自動で送信しています。',
  ];
  const d = jstDate(b.startAt);
  const shortDate = `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return {
    subject: `【WEB予約】${shortDate} ${formatTimeRange(b.startAt, b.endAt).split('〜')[0]} ${b.serviceName} ${b.customerName}様`,
    text: lines.join('\n'),
  };
}
