'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { FormState } from '@/lib/form-state';
import { fieldErrorsOf, loginSchema } from '@/lib/validation/schemas';

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) {
    return { message: 'Supabase との接続が設定されていません（docs/setup.md を参照）。' };
  }
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // 登録の有無を推測されないよう、理由をまとめた文言にする
    return { message: 'メールアドレスまたはパスワードが違います。' };
  }
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { message: 'このアカウントには管理画面を使う権限がありません。' };
  }
  redirect('/admin');
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}
