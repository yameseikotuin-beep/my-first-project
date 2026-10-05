import { z } from 'zod';

export const CARE_ITEMS = ['洗顔', 'メイク落とし', '化粧水', '保湿（乳液・クリーム）', '日焼け止め', 'パック', 'マッサージ', 'サロンでのケア'] as const;

export const careLogSchema = z.object({
  logDate: z
    .string({ error: '日付を入力してください' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付の形式が正しくありません')
    .refine((v) => !Number.isNaN(Date.parse(v)), '日付が正しくありません'),
  careItems: z.array(z.enum(CARE_ITEMS)).max(20).default([]),
  products: z.string().trim().max(500, '使ったものは500文字以内で入力してください').default(''),
  sleepHours: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^\d{1,2}(\.\d)?$/.test(v), '睡眠時間は数字（例：6.5）で入力してください')
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || (v >= 0 && v <= 24), '睡眠時間は0〜24時間で入力してください'),
  note: z.string().trim().max(1000, 'メモは1000文字以内で入力してください').default(''),
});

/** 日本時間の今日（YYYY-MM-DD） */
export function todayInTokyo(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
}
