import { describe, expect, it } from 'vitest';
import { clinicNotificationMail, customerConfirmationMail, type BookingMailInput } from '@/features/booking/booking-mail';

const b: BookingMailInput = {
  shopName: '八女鍼灸整骨院',
  shopPhone: '0943-00-0000',
  bookingNumber: '261109-AB7K',
  serviceName: '肩こり整体',
  price: 4400,
  startAt: '2026-11-09T01:00:00+00:00',
  endAt: '2026-11-09T01:40:00+00:00',
  customerName: '山田 太郎',
  customerPhone: '09012345678',
  customerEmail: 'yamada@example.com',
  notes: '右肩が痛みます',
};

describe('予約完了メール（お客様あて）', () => {
  it('予約番号・日本時間の日時・メニュー・料金・店舗の電話番号を含む', () => {
    const m = customerConfirmationMail(b);
    expect(m.subject).toBe('【八女鍼灸整骨院】ご予約を承りました（予約番号 261109-AB7K）');
    expect(m.text).toContain('山田 太郎 様');
    expect(m.text).toContain('2026年11月9日(月) 10:00〜10:40');
    expect(m.text).toContain('肩こり整体');
    expect(m.text).toContain('4,400円');
    expect(m.text).toContain('0943-00-0000');
  });
  it('お客様あてのメールに備考や電話番号（他人に見られて困る情報）を載せない', () => {
    const m = customerConfirmationMail(b);
    expect(m.text).not.toContain('右肩');
    expect(m.text).not.toContain('09012345678');
  });
});

describe('新しい予約の通知（院あて）', () => {
  it('お客様の連絡先・備考と管理画面へのリンクを含む', () => {
    const m = clinicNotificationMail(b, 'https://clinic.example/admin/bookings?from=2026-11-09');
    expect(m.subject).toBe('【WEB予約】11/9 10:00 肩こり整体 山田 太郎様');
    expect(m.text).toContain('090-1234-5678');
    expect(m.text).toContain('yamada@example.com');
    expect(m.text).toContain('右肩が痛みます');
    expect(m.text).toContain('https://clinic.example/admin/bookings?from=2026-11-09');
  });
});
