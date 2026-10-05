'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PHOTO_BUCKET } from '@/lib/photos';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import type { FormState } from '@/lib/form-state';
import { displayNameSchema } from '@/lib/validation/schemas';

export async function updateDisplayName(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['user', 'staff', 'admin']);
  const parsed = displayNameSchema.safeParse(formData.get('displayName'));
  if (!parsed.success) {
    return { fieldErrors: { displayName: parsed.error.issues.map((i) => i.message) } };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ display_name: parsed.data }).eq('id', user.id);
  if (error) return { message: '保存できませんでした。もう一度お試しください。' };
  revalidatePath('/', 'layout');
  return { ok: true, message: '表示名を保存しました。' };
}

/**
 * 退会：本人の写真ファイルを削除してから、アカウントとすべてのデータを削除する（docs/05-security.md §10）。
 * 本人確認のためにパスワードを再入力してもらう。
 */
export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['user']);
  if (formData.get('confirmText') !== '退会する') {
    return { fieldErrors: { confirmText: ['確認のため「退会する」と入力してください'] } };
  }
  const password = formData.get('password');
  if (typeof password !== 'string' || password.length === 0 || !user.email) {
    return { fieldErrors: { password: ['パスワードを入力してください'] } };
  }

  const supabase = await createClient();
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
  if (authError) return { fieldErrors: { password: ['パスワードが違います'] } };

  // 1. 写真ファイルを削除する（Storage の RLS により、本人のファイルだけが対象）
  const { data: sessions } = await supabase.from('photo_sessions').select('photos(storage_path)').eq('user_id', user.id);
  const paths = (sessions ?? []).flatMap((s) => s.photos.map((p) => p.storage_path));
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths.slice(i, i + 100));
    if (error) return { message: '写真の削除に失敗しました。時間をおいて、もう一度お試しください。' };
  }

  // 2. アカウントと、ひもづくデータをまとめて削除する
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    return { message: '退会の処理に失敗しました。写真は削除されています。時間をおいて、もう一度お試しください。' };
  }
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/?account=deleted');
}
