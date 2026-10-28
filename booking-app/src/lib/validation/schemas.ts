import { z } from 'zod';
import { isDateString, isTimeString } from '@/lib/time';

// 画面とサーバーの両方で使う入力検証。データベースの関数・制約でも同じ内容を確認している。

/** 電話番号を数字だけにする（全角数字・ハイフン・空白・括弧を許容） */
export function normalizePhone(value: string): string {
  return value
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '');
}

export const customerNameSchema = z
  .string({ error: 'お名前を入力してください' })
  .trim()
  .min(1, 'お名前を入力してください')
  .max(50, 'お名前は50文字以内で入力してください');

export const phoneSchema = z
  .string({ error: '電話番号を入力してください' })
  .trim()
  .min(1, '電話番号を入力してください')
  .max(20, '電話番号の形式が正しくありません')
  .refine((v) => /^[0-9０-９\-－ー‐()（）\s]+$/.test(v), '電話番号は数字で入力してください')
  .transform(normalizePhone)
  .refine((v) => /^0\d{9,10}$/.test(v), '電話番号は0から始まる10桁または11桁で入力してください');

export const notesSchema = z
  .string()
  .trim()
  .max(500, '備考は500文字以内で入力してください')
  .default('');

/** メールアドレスの形式の確認（空欄は通す）。入力があれば小文字にそろえる */
const emailFormat = z
  .string()
  .trim()
  .max(254, 'メールアドレスが長すぎます')
  .transform((v) => v.toLowerCase())
  .refine((v) => v === '' || z.email().safeParse(v).success, 'メールアドレスの形式が正しくありません');

/** メールアドレス（任意）。管理画面からの登録で使う */
export const optionalEmailSchema = emailFormat.default('');

/** メールアドレス（必須）。WEB 予約で使う */
export const requiredEmailSchema = z
  .string({ error: 'メールアドレスを入力してください' })
  .trim()
  .min(1, 'メールアドレスを入力してください')
  .pipe(emailFormat);

/** WEB 予約のお客様情報（メールアドレス必須） */
export const customerSchema = z.object({
  customerName: customerNameSchema,
  customerPhone: phoneSchema,
  customerEmail: requiredEmailSchema,
  notes: notesSchema,
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const uuidSchema = z.uuid({ error: '選択内容が正しくありません' });

export const dateSchema = z
  .string({ error: '日付を選択してください' })
  .refine(isDateString, '日付を選択してください');

export const timeSchema = z
  .string({ error: '時刻を入力してください' })
  .refine(isTimeString, '時刻を正しく入力してください');

/** フォームの空欄を null にする（任意の時刻など） */
const optionalTime = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isTimeString(v), '時刻を正しく入力してください');

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.uuid().safeParse(v).success, '選択内容が正しくありません');

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === 'on' || v === 'true');

const intField = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label}を数字で入力してください` })
    .int(`${label}は整数で入力してください`)
    .min(min, `${label}は${min}以上にしてください`)
    .max(max, `${label}は${max.toLocaleString('ja-JP')}以下にしてください`);

// ---- WEB 予約 ----
export const publicBookingSchema = customerSchema.extend({
  serviceId: uuidSchema,
  startAt: z.iso.datetime({ offset: true, error: '予約時間を選び直してください' }),
  // いたずら対策の見えない入力欄（人は入力しない）
  website: z.string().max(0).optional().default(''),
});

// ---- 管理画面：予約（電話予約などのため、メールアドレスは任意） ----
export const adminBookingSchema = customerSchema.extend({
  customerEmail: optionalEmailSchema,
  bookingId: optionalUuid,
  serviceId: uuidSchema,
  date: dateSchema,
  time: timeSchema,
  roomId: optionalUuid,
  practitionerId: optionalUuid,
  status: z.enum(['confirmed', 'cancelled']).default('confirmed'),
});

// ---- 管理画面：メニュー ----
export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'メニュー名を入力してください').max(60, 'メニュー名は60文字以内で入力してください'),
  description: z.string().trim().max(500, '説明は500文字以内で入力してください').default(''),
  durationMinutes: intField('施術時間', 5, 480),
  price: intField('料金', 0, 1_000_000),
  sortOrder: intField('表示順', -1000, 1000).default(0),
  isActive: checkbox,
  roomIds: z.array(z.uuid()).default([]),
});

// ---- 管理画面：施術スペース・施術者 ----
export const resourceSchema = z.object({
  name: z.string().trim().min(1, '名前を入力してください').max(40, '名前は40文字以内で入力してください'),
  sortOrder: intField('表示順', -1000, 1000).default(0),
  isActive: checkbox,
});

export const weeklyRangeSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .refine((v) => v.endTime > v.startTime, { message: '終了時刻は開始時刻より後にしてください', path: ['endTime'] });

// ---- 管理画面：営業時間 ----
const hoursShape = {
  isClosed: checkbox,
  openTime: optionalTime,
  closeTime: optionalTime,
  lastStartTime: optionalTime,
};

function checkHours(
  v: { isClosed: boolean; openTime: string | null; closeTime: string | null; lastStartTime: string | null },
  ctx: z.RefinementCtx,
) {
  if (v.isClosed) return;
  if (!v.openTime) ctx.addIssue({ code: 'custom', message: '開始時刻を入力してください', path: ['openTime'] });
  if (!v.closeTime) ctx.addIssue({ code: 'custom', message: '終了時刻を入力してください', path: ['closeTime'] });
  if (v.openTime && v.closeTime && v.closeTime <= v.openTime) {
    ctx.addIssue({ code: 'custom', message: '終了時刻は開始時刻より後にしてください', path: ['closeTime'] });
  }
  if (v.lastStartTime && v.openTime && v.closeTime && (v.lastStartTime < v.openTime || v.lastStartTime >= v.closeTime)) {
    ctx.addIssue({ code: 'custom', message: '最終受付は営業時間内にしてください', path: ['lastStartTime'] });
  }
}

export const businessHourSchema = z
  .object({ weekday: z.coerce.number().int().min(0).max(6), ...hoursShape })
  .superRefine(checkHours);

export const dateOverrideSchema = z
  .object({
    businessDate: dateSchema,
    note: z.string().trim().max(100, 'メモは100文字以内で入力してください').default(''),
    ...hoursShape,
  })
  .superRefine(checkHours);

export const breakSchema = z
  .object({
    kind: z.enum(['weekly', 'date']),
    weekday: z.string().optional(),
    breakDate: z.string().optional(),
    startTime: timeSchema,
    endTime: timeSchema,
    label: z.string().trim().max(40, '名前は40文字以内で入力してください').default(''),
  })
  .superRefine((v, ctx) => {
    if (v.endTime <= v.startTime) {
      ctx.addIssue({ code: 'custom', message: '終了時刻は開始時刻より後にしてください', path: ['endTime'] });
    }
    if (v.kind === 'weekly' && !/^[0-6]$/.test(v.weekday ?? '')) {
      ctx.addIssue({ code: 'custom', message: '曜日を選択してください', path: ['weekday'] });
    }
    if (v.kind === 'date' && !isDateString(v.breakDate)) {
      ctx.addIssue({ code: 'custom', message: '日付を選択してください', path: ['breakDate'] });
    }
  });

export const settingsSchema = z.object({
  shopName: z.string().trim().min(1, '店舗名を入力してください').max(60, '店舗名は60文字以内で入力してください'),
  shopPhone: z
    .string()
    .trim()
    .max(20, '電話番号は20文字以内で入力してください')
    .refine((v) => v === '' || /^[0-9\-()\s]+$/.test(v), '電話番号は半角数字とハイフンで入力してください')
    .default(''),
  slotIntervalMinutes: z.coerce
    .number()
    .refine((v) => [5, 10, 15, 20, 30, 60].includes(v), '予約枠の間隔を選択してください'),
  bookingWindowDays: intField('受付可能な期間', 0, 365),
  minLeadMinutes: intField('受付締切', 0, 10080),
  maxActiveBookingsPerPhone: intField('1つの電話番号の予約数の上限', 1, 20),
  // 新しい予約の通知メールの送り先（1行に1件、最大5件）
  notifyEmails: z
    .string()
    .optional()
    .transform((v) => [...new Set((v ?? '').split(/[\s,、]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))])
    .refine((list) => list.length <= 5, '通知メールの送り先は5件までです')
    .refine((list) => list.every((e) => e.length <= 254 && z.email().safeParse(e).success), '通知メールの送り先に、形式の正しくないメールアドレスがあります'),
});

// ---- ログイン ----
export const loginSchema = z.object({
  email: z.string().trim().min(1, 'メールアドレスを入力してください').max(254).pipe(z.email('メールアドレスの形式が正しくありません')),
  password: z.string().min(1, 'パスワードを入力してください').max(72),
});

/** zod のエラーを、フォームの項目ごとのメッセージにする */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
