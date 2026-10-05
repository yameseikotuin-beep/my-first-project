'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formValues, type FormState } from '@/lib/form-state';
import { fieldErrorsOf, uuidSchema } from '@/lib/validation/schemas';
import { careLogSchema } from './schema';

export async function saveCareLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['user']);
  const parsed = careLogSchema.safeParse({
    logDate: formData.get('logDate'),
    careItems: formData.getAll('careItems'),
    products: formData.get('products') ?? '',
    sleepHours: formData.get('sleepHours') ?? '',
    note: formData.get('note') ?? '',
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, ['logDate', 'products', 'sleepHours', 'note']) };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const fields = { care_items: v.careItems, products: v.products, sleep_hours: v.sleepHours, note: v.note };

  // 同じ日の記録があれば上書き、なければ新しく作る
  const { data: existing } = await supabase
    .from('self_care_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('log_date', v.logDate)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('self_care_logs').update(fields).eq('id', existing.id)
    : await supabase.from('self_care_logs').insert({ user_id: user.id, log_date: v.logDate, ...fields });
  if (error) return { message: '保存できませんでした。もう一度お試しください。' };
  revalidatePath('/me/care');
  return { ok: true, message: `${v.logDate} の記録を保存しました。` };
}

export async function deleteCareLog(formData: FormData): Promise<void> {
  await requireRole(['user']);
  const id = uuidSchema.safeParse(formData.get('id'));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from('self_care_logs').delete().eq('id', id.data);
  revalidatePath('/me/care');
}
