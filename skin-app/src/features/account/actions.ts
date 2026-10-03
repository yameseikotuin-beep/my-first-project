'use server';

import { revalidatePath } from 'next/cache';
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
