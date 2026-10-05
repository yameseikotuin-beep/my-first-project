import { z } from 'zod';
import { BANNED_TERMS } from '@/lib/ai/safety';

// サロン向けの入力検証（画面とサーバーの両方で使う）

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label}は${max}文字以内で入力してください`).default('');

/** 効果の断定・医療的な表現が含まれていれば、その言葉を返す */
export function findBannedTerm(value: string): string | null {
  return BANNED_TERMS.find((t) => value.includes(t)) ?? null;
}

const noMedicalClaims = (value: string) => findBannedTerm(value) === null;
const medicalClaimsMessage = (label: string) => ({
  message: `${label}に、効果の断定や医療的な表現（例：「必ず」「治る」「治療」）は使えません`,
});

// ---------------------------------------------------------------------
// 施術メニュー（管理者）
// ---------------------------------------------------------------------
export const menuSchema = z.object({
  name: z.string().trim().min(1, 'メニュー名を入力してください').max(100, 'メニュー名は100文字以内で入力してください'),
  category: text(50, '分類'),
  description: text(2000, '説明').refine(noMedicalClaims, medicalClaimsMessage('説明')),
  cautions: text(2000, '注意事項'),
  priceYen: z
    .string()
    .trim()
    .regex(/^\d{1,8}$/, '料金は0以上の整数（円）で入力してください')
    .transform(Number),
  durationMin: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^\d{1,3}$/.test(v), '所要時間は分（整数）で入力してください')
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || (v >= 1 && v <= 600), '所要時間は1〜600分で入力してください'),
  isActive: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

// ---------------------------------------------------------------------
// 問診（来店ごと）
// 病名や治療の内容は記録しない。施術前の確認に必要な最小限の項目だけ。
// ---------------------------------------------------------------------
export const INTAKE_VERSION = 'v1';

export const INTAKE_CONCERNS = ['毛穴', '赤み', 'くすみ・色むら', 'キメ・ハリ', '乾燥感', 'テカリ', 'その他'] as const;
export const SKIN_FEELS = ['乾燥しやすい', 'べたつきやすい', '部分によって違う', '特に気にならない', 'わからない'] as const;
export const YES_NO = ['はい', 'いいえ', 'わからない'] as const;

export const intakeSchema = z.object({
  concerns: z.array(z.enum(INTAKE_CONCERNS)).max(INTAKE_CONCERNS.length).default([]),
  skinFeel: z.enum(SKIN_FEELS, { error: '肌の感じ方を選んでください' }),
  productTrouble: z.enum(YES_NO, { error: '選んでください' }),
  recentProcedures: z.enum(YES_NO, { error: '選んでください' }),
  underTreatment: z.enum(['はい', 'いいえ'], { error: '選んでください' }),
  wishes: text(500, 'ご希望'),
  notes: text(500, '気をつけてほしいこと'),
});

export type IntakeAnswers = z.infer<typeof intakeSchema>;

/** 保存された問診の回答を読む（形が違えば null） */
export function readIntakeAnswers(json: unknown): IntakeAnswers | null {
  const parsed = intakeSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------
// カウンセリングシート
// ---------------------------------------------------------------------
export const counselingSchema = z.object({
  concerns: text(2000, 'お悩み'),
  analysisSummary: text(2000, '分析のまとめ'),
  proposal: text(2000, 'ご提案').refine(noMedicalClaims, medicalClaimsMessage('ご提案')),
  customerWishes: text(2000, 'お客さまのご希望'),
  staffNotes: text(2000, 'スタッフのメモ'),
});

// ---------------------------------------------------------------------
// 施術案内文
// ---------------------------------------------------------------------
export const proposalSchema = z.object({
  menuIds: z.array(z.uuid()).max(10, 'メニューは10件までです').default([]),
  finalText: text(4000, '案内文').refine(noMedicalClaims, medicalClaimsMessage('案内文')),
  intent: z.enum(['save', 'approve', 'reopen']),
});

// ---------------------------------------------------------------------
// 施術の記録・次回来店メモ
// ---------------------------------------------------------------------
const optionalUuid = z
  .string()
  .default('')
  .refine((v) => v === '' || z.uuid().safeParse(v).success, '選び直してください')
  .transform((v) => (v === '' ? null : v));

export const treatmentSchema = z.object({
  menuId: z.uuid({ error: 'メニューを選んでください' }),
  notes: text(2000, 'メモ'),
  beforeSessionId: optionalUuid,
  afterSessionId: optionalUuid,
});

export const treatmentSessionsSchema = z.object({
  treatmentId: z.uuid(),
  beforeSessionId: optionalUuid,
  afterSessionId: optionalUuid,
});

export const nextVisitSchema = z.object({
  nextVisitMemo: text(1000, '次回来店メモ'),
});

// ---------------------------------------------------------------------
// 機器の実測値（AI の推定とは別に、測定機器で測った値だけを記録する）
// ---------------------------------------------------------------------
export const measurementSchema = z.object({
  deviceName: z.string().trim().min(1, '機器名を入力してください').max(100, '機器名は100文字以内で入力してください'),
  metric: z.string().trim().min(1, '項目を入力してください').max(50, '項目は50文字以内で入力してください'),
  value: z
    .string()
    .trim()
    .regex(/^-?\d{1,9}(\.\d{1,3})?$/, '数値で入力してください（小数は3桁まで）')
    .transform(Number),
  unit: text(20, '単位'),
  measuredAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, '測定日時を入力してください'),
  visitId: optionalUuid,
});

/** 日本時間の日時入力（datetime-local の値）を ISO 形式に変える */
export function tokyoLocalToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString();
}

/** 日本時間の現在時刻を datetime-local の形式で返す */
export function nowTokyoLocal(now = new Date()): string {
  const t = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return t.toISOString().slice(0, 16);
}
