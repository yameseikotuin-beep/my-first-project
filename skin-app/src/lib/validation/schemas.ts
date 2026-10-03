import { z } from 'zod';

// 画面とサーバーの両方で使う入力検証（docs/05-security.md §8）

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}は${max}文字以内で入力してください`)
    .default('');

export const emailSchema = z
  .string({ error: 'メールアドレスを入力してください' })
  .trim()
  .min(1, 'メールアドレスを入力してください')
  .max(254, 'メールアドレスが長すぎます')
  .pipe(z.email('メールアドレスの形式が正しくありません'));

export const passwordSchema = z
  .string({ error: 'パスワードを入力してください' })
  .min(10, 'パスワードは10文字以上にしてください')
  .max(72, 'パスワードは72文字以内にしてください');

export const displayNameSchema = z
  .string({ error: '表示名を入力してください' })
  .trim()
  .min(1, '表示名を入力してください')
  .max(50, '表示名は50文字以内で入力してください');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'パスワードを入力してください').max(72),
});

export const signupSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
    adult: z.literal('on', { error: '18歳以上の方のみご利用いただけます' }),
    agreeTerms: z.literal('on', { error: '利用規約とプライバシーポリシーへの同意が必要です' }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '確認用のパスワードが一致しません',
  });

export const newPasswordSchema = z
  .object({ password: passwordSchema, passwordConfirm: z.string() })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '確認用のパスワードが一致しません',
  });

const currentYear = () => new Date().getFullYear();

export const customerSchema = z.object({
  fullName: z
    .string({ error: '氏名を入力してください' })
    .trim()
    .min(1, '氏名を入力してください')
    .max(100, '氏名は100文字以内で入力してください'),
  fullNameKana: optionalText(100, 'ふりがな').refine(
    (v) => v === '' || /^[\p{Script=Hiragana}\p{Script=Katakana}ー・\s　]+$/u.test(v),
    'ふりがなは、ひらがな・カタカナで入力してください',
  ),
  phone: optionalText(30, '電話番号').refine(
    (v) => v === '' || /^\+?[0-9\-\s()]{6,}$/.test(v),
    '電話番号は数字とハイフンで入力してください',
  ),
  email: z
    .string()
    .trim()
    .max(254)
    .default('')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'メールアドレスの形式が正しくありません'),
  birthYear: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || /^\d{4}$/.test(v), '生まれ年は西暦4桁で入力してください')
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((v) => v === null || (v >= 1900 && v <= currentYear()), '生まれ年が正しくありません'),
  notes: optionalText(2000, 'メモ'),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const inviteSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  role: z.enum(['staff', 'admin'], { error: '役割を選んでください' }),
});

export const memberUpdateSchema = z.object({
  target: z.uuid(),
  role: z.enum(['user', 'staff', 'admin']),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true'),
});

export const uuidSchema = z.uuid();

/** 検索語：Postgres の LIKE で特別な意味を持つ文字を取り除く */
export function sanitizeSearch(q: string | undefined | null): string {
  return (q ?? '')
    .replace(/[%_\\,()]/g, ' ')
    .trim()
    .slice(0, 50);
}

export function fieldErrorsOf(error: z.ZodError): Record<string, string[] | undefined> {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}
