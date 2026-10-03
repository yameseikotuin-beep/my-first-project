'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';
import { isSupabaseConfigured } from '@/lib/env';
import { safeNextPath } from '@/lib/auth/roles';
import { formValues, type FormState } from '@/lib/form-state';

import {
  emailSchema,
  fieldErrorsOf,
  loginSchema,
  newPasswordSchema,
  signupSchema,
} from '@/lib/validation/schemas';

const notConfigured: FormState = {
  message: 'アプリの初期設定（Supabase との接続）が完了していないため、今は利用できません。',
};

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ...notConfigured, values: formValues(formData, ['email']) };
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const values = formValues(formData, ['email', 'next']);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // 登録の有無を推測されないよう、理由をまとめた文言にする
    return {
      message:
        error.code === 'email_not_confirmed'
          ? 'メールアドレスの確認が済んでいません。届いたメールのリンクを開いてください。'
          : 'メールアドレスまたはパスワードが違います。',
      values,
    };
  }
  redirect(safeNextPath(formData.get('next')?.toString()) ?? '/home');
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ...notConfigured, values: formValues(formData, ['email']) };
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  const values = formValues(formData, ['displayName', 'email']);
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
      data: { display_name: parsed.data.displayName, adult_confirmed: 'true' },
    },
  });
  if (error) {
    if (error.code === 'weak_password') {
      return { fieldErrors: { password: ['このパスワードは使えません。推測されにくいものにしてください。'] }, values };
    }
    return { message: '登録できませんでした。時間をおいてもう一度お試しください。', values };
  }
  return {
    ok: true,
    message: '確認メールを送信しました。メールのリンクを開くと登録が完了します。',
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return { ...notConfigured, values: formValues(formData, ['email']) };
  const parsed = emailSchema.safeParse(formData.get('email'));
  const values = formValues(formData, ['email']);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues.map((i) => i.message) }, values };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${getSiteUrl()}/auth/confirm?next=/update-password`,
  });
  // 登録の有無にかかわらず同じ文言を返す
  return { ok: true, message: '登録されているメールアドレスであれば、再設定用のメールを送信しました。' };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: 'リンクの有効期限が切れています。もう一度やり直してください。' };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      message:
        error.code === 'same_password'
          ? '以前と同じパスワードは使えません。'
          : 'パスワードを変更できませんでした。もう一度お試しください。',
    };
  }
  redirect('/home');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
