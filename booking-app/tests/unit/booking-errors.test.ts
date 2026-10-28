import { describe, expect, it } from 'vitest';
import { classifyBookingError, interpretCreateBooking } from '@/lib/booking-errors';
import { decodeCompleted, encodeCompleted } from '@/features/booking/completed';

const okRow = {
  booking_number: '261103-ABCD',
  service_name: '肩こり整体',
  price: 4400,
  start_at: '2026-11-03T01:00:00+00:00',
  end_at: '2026-11-03T01:40:00+00:00',
};

describe('予約確定処理の結果の判定（データベース障害時に完了と誤表示しない）', () => {
  it('予約番号を含む正常な応答だけを「確定」とする', () => {
    const r = interpretCreateBooking({ data: [okRow], error: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.booking.bookingNumber).toBe('261103-ABCD');
  });
  it.each([
    ['エラー応答', { data: null, error: { message: 'Could not connect to the database', code: 'PGRST000' } }],
    ['通信エラー', { data: null, error: { message: 'TypeError: fetch failed', code: '' } }],
    ['空の応答', { data: [], error: null }],
    ['null の応答', { data: null, error: null }],
    ['形式の違う応答', { data: [{ foo: 1 }], error: null }],
    ['予約番号が空', { data: [{ ...okRow, booking_number: '' }], error: null }],
    ['配列でない応答', { data: okRow, error: null }],
  ])('%s は未確定として扱う', (_label, result) => {
    const r = interpretCreateBooking(result);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('予約は確定していません');
  });
  it('満席・休業などは理由付きのメッセージにする（内部情報は出さない）', () => {
    const r = classifyBookingError({ message: 'SLOT_UNAVAILABLE', details: 'BREAK', code: 'P0001' });
    expect(r.kind).toBe('slot');
    expect(r.message).toContain('受付停止時間');
    expect(classifyBookingError({ message: 'TOO_MANY_BOOKINGS' }).kind).toBe('limit');
    const unknown = classifyBookingError({ message: 'relation "bookings" does not exist', code: '42P01' });
    expect(unknown.message).not.toContain('bookings');
  });
});

describe('予約完了画面に渡す内容', () => {
  it('予約番号・メニュー・日時・料金だけを保存し、復元できる', () => {
    const b = { bookingNumber: '261103-ABCD', serviceName: '肩こり整体', price: 4400, startAt: okRow.start_at, endAt: okRow.end_at, mailSent: true };
    const encoded = encodeCompleted(b);
    expect(decodeCompleted(encoded)).toEqual(b);
    expect(Buffer.from(encoded, 'base64url').toString()).not.toMatch(/customer|phone/);
  });
  it('壊れた値・改ざんされた形式は表示しない', () => {
    expect(decodeCompleted(undefined)).toBeNull();
    expect(decodeCompleted('not-base64-json')).toBeNull();
    expect(decodeCompleted(Buffer.from(JSON.stringify({ bookingNumber: 1 })).toString('base64url'))).toBeNull();
  });
});
