import { describe, expect, it } from 'vitest';
import { adminBookingSchema, businessHourSchema, customerSchema, normalizePhone, publicBookingSchema, serviceSchema } from '@/lib/validation/schemas';

describe('お客様情報の検証', () => {
  it('電話番号を数字だけにする（全角・ハイフン・空白を許容）', () => {
    expect(normalizePhone('０９０－１２３４－５６７８')).toBe('09012345678');
    expect(normalizePhone('03 (1234) 5678')).toBe('0312345678');
  });
  it('正しい入力を受け付ける', () => {
    const r = customerSchema.safeParse({ customerName: ' 山田 太郎 ', customerPhone: '090-1234-5678', notes: '' });
    expect(r.success && r.data).toEqual({ customerName: '山田 太郎', customerPhone: '09012345678', customerEmail: '', notes: '' });
  });
  it('メールアドレスは任意。入力があれば形式を確認し、小文字にそろえる', () => {
    const base = { customerName: '山田', customerPhone: '09012345678' };
    expect(customerSchema.parse({ ...base, customerEmail: ' Yamada@Example.COM ' }).customerEmail).toBe('yamada@example.com');
    expect(customerSchema.parse({ ...base, customerEmail: '' }).customerEmail).toBe('');
    for (const bad of ['yamada', 'yamada@', '@example.com', 'a b@example.com', `${'a'.repeat(250)}@example.com`]) {
      const r = customerSchema.safeParse({ ...base, customerEmail: bad });
      expect(r.success, bad).toBe(false);
      expect(r.error?.issues[0].path[0]).toBe('customerEmail');
    }
  });
  it.each([
    [{ customerName: '', customerPhone: '09012345678' }, 'customerName'],
    [{ customerName: '   ', customerPhone: '09012345678' }, 'customerName'],
    [{ customerName: 'あ'.repeat(51), customerPhone: '09012345678' }, 'customerName'],
    [{ customerName: '山田', customerPhone: '' }, 'customerPhone'],
    [{ customerName: '山田', customerPhone: '12345' }, 'customerPhone'],
    [{ customerName: '山田', customerPhone: '9012345678' }, 'customerPhone'],
    [{ customerName: '山田', customerPhone: 'abc-defg-hijk' }, 'customerPhone'],
    [{ customerName: '山田', customerPhone: '090123456789' }, 'customerPhone'],
    [{ customerName: '山田', customerPhone: '09012345678', notes: 'あ'.repeat(501) }, 'notes'],
  ])('不正な入力を拒否する %#', (input, field) => {
    const r = customerSchema.safeParse(input);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path[0]).toBe(field);
  });
  it('WEB 予約：いたずら対策の見えない欄に入力があれば拒否する', () => {
    const base = {
      serviceId: '9383a06f-ad39-48ad-b8d9-fffa31017e69',
      startAt: '2026-11-03T01:00:00+00:00',
      customerName: '山田',
      customerPhone: '09012345678',
    };
    expect(publicBookingSchema.safeParse(base).success).toBe(true);
    expect(publicBookingSchema.safeParse({ ...base, website: 'http://spam' }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, startAt: 'tomorrow' }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, serviceId: '1 or 1=1' }).success).toBe(false);
  });
});

describe('管理画面の入力の検証', () => {
  it('予約：空欄のスペース・施術者は自動割り当て（null）', () => {
    const r = adminBookingSchema.parse({
      serviceId: '9383a06f-ad39-48ad-b8d9-fffa31017e69', date: '2026-11-03', time: '10:00',
      customerName: '山田', customerPhone: '0312345678', roomId: '', practitionerId: '',
    });
    expect(r.roomId).toBeNull();
    expect(r.practitionerId).toBeNull();
    expect(r.status).toBe('confirmed');
  });
  it('メニュー：施術時間・料金の範囲を確認する', () => {
    expect(serviceSchema.safeParse({ name: '整体', durationMinutes: '60', price: '6600' }).success).toBe(true);
    expect(serviceSchema.safeParse({ name: '整体', durationMinutes: '0', price: '6600' }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: '整体', durationMinutes: '60', price: '-1' }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: '', durationMinutes: '60', price: '0' }).success).toBe(false);
  });
  it('営業時間：終了は開始より後、最終受付は営業時間内', () => {
    expect(businessHourSchema.safeParse({ weekday: 1, openTime: '09:00', closeTime: '20:00', lastStartTime: '19:00' }).success).toBe(true);
    expect(businessHourSchema.safeParse({ weekday: 1, openTime: '09:00', closeTime: '08:00' }).success).toBe(false);
    expect(businessHourSchema.safeParse({ weekday: 1, openTime: '09:00', closeTime: '20:00', lastStartTime: '21:00' }).success).toBe(false);
    expect(businessHourSchema.safeParse({ weekday: 0, isClosed: 'on' }).success).toBe(true);
  });
});
