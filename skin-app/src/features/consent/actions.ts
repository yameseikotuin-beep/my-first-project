'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { consentKinds, getActiveConsents, getLatestConsentDocuments, type Subject } from '@/lib/consent';
import type { ConsentKind, ConsentMethod } from '@/lib/supabase/database.types';
import type { FormState } from '@/lib/form-state';
import { uuidSchema } from '@/lib/validation/schemas';

async function saveConsents(subject: Subject, method: ConsentMethod, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const latest = await getLatestConsentDocuments(supabase);
  const active = await getActiveConsents(supabase, subject);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { message: 'ログインし直してください。' };

  const rows: { kind: ConsentKind; document_id: string }[] = [];
  for (const kind of consentKinds) {
    if (formData.get(`consent_${kind}`) !== 'on' || active[kind]) continue;
    const doc = latest[kind];
    // 表示した文面と最新の文面が違う場合（表示中に更新された場合）は保存しない
    if (!doc || formData.get(`doc_${kind}`) !== doc.id) {
      return { message: '同意文が更新されました。画面を再読み込みして、内容をご確認ください。' };
    }
    rows.push({ kind, document_id: doc.id });
  }
  if (rows.length === 0) return { ok: true };

  const { error } = await supabase.from('consents').insert(
    rows.map((r) => ({
      ...r,
      method,
      recorded_by: auth.user.id,
      user_id: 'userId' in subject ? subject.userId : null,
      customer_id: 'customerId' in subject ? subject.customerId : null,
    })),
  );
  if (error) return { message: '同意を保存できませんでした。もう一度お試しください。' };
  return { ok: true };
}

export async function grantSelfConsents(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['user']);
  const result = await saveConsents({ userId: user.id }, 'self_app', formData);
  if (!result.ok) return result;
  revalidatePath('/me', 'layout');
  redirect(formData.get('return') === 'settings' ? '/me/settings?saved=consent' : '/me');
}

export async function grantCustomerConsents(
  customerId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  if (!uuidSchema.safeParse(customerId).success) return { message: '顧客が見つかりません。' };
  if (formData.get('confirmedByCustomer') !== 'on') {
    return { fieldErrors: { confirmedByCustomer: ['お客さまご本人による確認が必要です'] } };
  }
  const result = await saveConsents({ customerId }, 'salon_tablet', formData);
  if (!result.ok) return result;
  revalidatePath(`/staff/customers/${customerId}`);
  redirect(`/staff/customers/${customerId}?tab=consents&saved=consent`);
}

export async function revokeConsent(formData: FormData): Promise<void> {
  const user = await requireRole(['user', 'staff', 'admin']);
  const id = uuidSchema.safeParse(formData.get('consentId'));
  if (!id.success) return;
  const supabase = await createClient();
  // RLS により、本人の同意か担当顧客の同意しか撤回できない
  await supabase.from('consents').update({ revoked_at: new Date().toISOString() }).eq('id', id.data);
  const customerId = uuidSchema.safeParse(formData.get('customerId'));
  if (customerId.success && user.profile.role !== 'user') {
    revalidatePath(`/staff/customers/${customerId.data}`);
  } else {
    revalidatePath('/me', 'layout');
  }
}
