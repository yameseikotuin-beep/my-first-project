'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, isAdminClientConfigured } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import { writeAudit } from '@/lib/audit';
import { formValues, type FormState } from '@/lib/form-state';
import { fieldErrorsOf, inviteSchema, memberUpdateSchema, uuidSchema } from '@/lib/validation/schemas';

/** スタッフ・管理者の招待（招待メールから本人がパスワードを設定する） */
export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['admin']);
  const values = formValues(formData, ['email', 'displayName', 'role']);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values };
  if (!isAdminClientConfigured()) {
    return { message: 'サーバーに SUPABASE_SERVICE_ROLE_KEY が設定されていないため、招待できません。', values };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { display_name: parsed.data.displayName },
    redirectTo: `${publicEnv.siteUrl}/auth/confirm`,
  });
  if (error || !data.user) {
    return {
      message:
        error?.code === 'email_exists'
          ? 'このメールアドレスはすでに登録されています。役割の変更は一覧から行ってください。'
          : '招待メールを送信できませんでした。',
      values,
    };
  }
  // 新規登録時は必ず 'user' で作られるため、ここで役割を設定する（管理用クライアントのみが可能）
  const { error: roleError } = await admin.from('profiles').update({ role: parsed.data.role }).eq('id', data.user.id);
  if (roleError) {
    return { message: '招待しましたが、役割を設定できませんでした。一覧から役割を設定してください。' };
  }
  const supabase = await createClient();
  await writeAudit(supabase, 'member.invite', { type: 'profiles', id: data.user.id }, { role: parsed.data.role });
  revalidatePath('/admin/staff');
  return { ok: true, message: `${parsed.data.email} に招待メールを送信しました。` };
}

export async function updateMember(formData: FormData): Promise<void> {
  await requireRole(['admin']);
  const parsed = memberUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_update_member', {
    p_target: parsed.data.target,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  if (error) throw new Error('member_update_failed');
  revalidatePath('/admin/staff');
  revalidatePath('/admin/assignments');
}

export async function grantAssignment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['admin']);
  const staffId = uuidSchema.safeParse(formData.get('staffId'));
  const customerId = uuidSchema.safeParse(formData.get('customerId'));
  if (!staffId.success || !customerId.success) {
    return {
      fieldErrors: {
        staffId: staffId.success ? undefined : ['スタッフを選んでください'],
        customerId: customerId.success ? undefined : ['顧客を選んでください'],
      },
    };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('customer_assignments')
    .insert({ staff_id: staffId.data, customer_id: customerId.data, granted_by: user.id });
  if (error) {
    return {
      message: error.code === '23505' ? 'すでに担当に割り当てられています。' : '割り当てできませんでした（スタッフの役割を確認してください）。',
    };
  }
  revalidatePath('/admin/assignments');
  return { ok: true, message: '担当を割り当てました。' };
}

export async function revokeAssignment(formData: FormData): Promise<void> {
  await requireRole(['admin']);
  const staffId = uuidSchema.safeParse(formData.get('staffId'));
  const customerId = uuidSchema.safeParse(formData.get('customerId'));
  if (!staffId.success || !customerId.success) return;
  const supabase = await createClient();
  await supabase.from('customer_assignments').delete().eq('staff_id', staffId.data).eq('customer_id', customerId.data);
  revalidatePath('/admin/assignments');
}
