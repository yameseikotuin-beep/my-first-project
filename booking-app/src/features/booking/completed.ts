import type { CreatedBooking } from '@/lib/booking-errors';

// 予約完了画面に渡す内容（ブラウザの Cookie に一時的に保存する）
export const COMPLETE_COOKIE = 'booking_completed';

export function encodeCompleted(b: CreatedBooking): string {
  return Buffer.from(JSON.stringify(b), 'utf8').toString('base64url');
}

export function decodeCompleted(value: string | undefined): CreatedBooking | null {
  if (!value) return null;
  try {
    const b = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof b?.bookingNumber === 'string' &&
      typeof b.serviceName === 'string' &&
      typeof b.price === 'number' &&
      typeof b.startAt === 'string' &&
      typeof b.endAt === 'string'
    ) {
      return b;
    }
  } catch {
    // 壊れた値は無視する
  }
  return null;
}
