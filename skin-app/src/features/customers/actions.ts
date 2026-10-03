'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formValues, type FormState } from '@/lib/form-state';
import { customerSchema, fieldErrorsOf, uuidSchema } from '@/lib/validation/schemas';
import { PHOTO_BUCKET } from '@/lib/photos';

const fields = ['fullName', 'fullNameKana', 'phone', 'email', 'birthYear', 'notes'] as const;

export async function createCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, fields) };
  const c = parsed.data;

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('create_customer', {
    p_full_name: c.fullName,
    p_full_name_kana: c.fullNameKana,
    p_phone: c.phone,
    p_email: c.email,
    p_birth_year: c.birthYear,
    p_notes: c.notes,
  });
  if (error || !id) {
    return { message: '登録できませんでした。もう一度お試しください。', values: formValues(formData, fields) };
  }
  revalidatePath('/staff', 'layout');
  redirect(`/staff/customers/${id}?saved=created`);
}

export async function updateCustomer(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  if (!uuidSchema.safeParse(customerId).success) return { message: '顧客が見つかりません。' };
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, fields) };
  const c = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .update({
      full_name: c.fullName,
      full_name_kana: c.fullNameKana,
      phone: c.phone,
      email: c.email,
      birth_year: c.birthYear,
      notes: c.notes,
    })
    .eq('id', customerId)
    .select('id');
  if (error || !data?.length) {
    return { message: '保存できませんでした。担当のお客さまか確認してください。', values: formValues(formData, fields) };
  }
  revalidatePath(`/staff/customers/${customerId}`);
  revalidatePath('/staff/customers');
  return { ok: true, message: '保存しました。' };
}

/** 顧客の削除（管理者のみ）。写真ファイル → 顧客の行（関連データは一緒に削除）の順に消す */
export async function deleteCustomer(formData: FormData): Promise<void> {
  await requireRole(['admin']);
  const id = uuidSchema.safeParse(formData.get('customerId'));
  if (!id.success) return;
  const supabase = await createClient();

  const { data: sessions } = await supabase.from('photo_sessions').select('photos(storage_path)').eq('customer_id', id.data);
  const paths = (sessions ?? []).flatMap((s) => s.photos.map((p) => p.storage_path));
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error('photo_delete_failed');
  }
  const { error } = await supabase.from('customers').delete().eq('id', id.data);
  if (error) throw new Error('customer_delete_failed');
  revalidatePath('/admin/customers');
  revalidatePath('/staff', 'layout');
  redirect('/admin/customers?deleted=1');
}
