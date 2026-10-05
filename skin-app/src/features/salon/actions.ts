'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formValues, type FormState } from '@/lib/form-state';
import { fieldErrorsOf, uuidSchema } from '@/lib/validation/schemas';
import { metricAverages } from '@/lib/analysis/summary';
import { buildProposalDraft } from './proposal-template';
import {
  INTAKE_VERSION,
  counselingSchema,
  intakeSchema,
  measurementSchema,
  menuSchema,
  nextVisitSchema,
  proposalSchema,
  readIntakeAnswers,
  tokyoLocalToIso,
  treatmentSchema,
  treatmentSessionsSchema,
} from './schema';

// サロン向けの操作。RLS とは別に、ここでも役割と ID の形を確認する（二重の確認）。
// ID はアプリ側で決め、作成後に読み返さない（insert ... returning を使わない）。

const SAVE_FAILED = '保存できませんでした。もう一度お試しください。';

function visitPath(visitId: string, step?: string) {
  return `/staff/visits/${visitId}${step ? `/${step}` : ''}`;
}

/** 来店を読み、担当でなければ null（RLS） */
async function getVisit(visitId: string) {
  if (!uuidSchema.safeParse(visitId).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.from('visits').select('id, customer_id, status').eq('id', visitId).maybeSingle();
  return data ? { supabase, visit: data } : null;
}

// ---------------------------------------------------------------------
// 来店
// ---------------------------------------------------------------------
export async function startVisit(customerId: string): Promise<void> {
  const user = await requireRole(['staff', 'admin']);
  if (!uuidSchema.safeParse(customerId).success) redirect('/staff/customers');
  const supabase = await createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase.from('visits').insert({ id, customer_id: customerId, staff_id: user.id });
  if (error) redirect(`/staff/customers/${customerId}?tab=visits&error=visit`);
  revalidatePath(`/staff/customers/${customerId}`);
  revalidatePath('/staff');
  redirect(visitPath(id));
}

export async function setVisitStatus(visitId: string, status: 'in_progress' | 'completed'): Promise<void> {
  await requireRole(['staff', 'admin']);
  // 画面で bind した値も送り手が書き換えられるため、ここで確かめる
  if (status !== 'in_progress' && status !== 'completed') return;
  const found = await getVisit(visitId);
  if (!found) return;
  await found.supabase.from('visits').update({ status }).eq('id', visitId);
  revalidatePath(visitPath(visitId), 'layout');
  revalidatePath(`/staff/customers/${found.visit.customer_id}`);
  revalidatePath('/staff');
}

export async function deleteVisit(visitId: string): Promise<void> {
  await requireRole(['admin']);
  const found = await getVisit(visitId);
  if (!found) return;
  const { error } = await found.supabase.from('visits').delete().eq('id', visitId);
  if (error) throw new Error('visit_delete_failed');
  revalidatePath(`/staff/customers/${found.visit.customer_id}`);
  redirect(`/staff/customers/${found.visit.customer_id}?tab=visits`);
}

export async function saveNextVisitMemo(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  const parsed = nextVisitSchema.safeParse({ nextVisitMemo: formData.get('nextVisitMemo') ?? '' });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, ['nextVisitMemo']) };
  const found = await getVisit(visitId);
  if (!found) return { message: '来店の記録が見つかりません。' };
  const { error } = await found.supabase
    .from('visits')
    .update({ next_visit_memo: parsed.data.nextVisitMemo })
    .eq('id', visitId);
  if (error) return { message: SAVE_FAILED };
  revalidatePath(visitPath(visitId), 'layout');
  revalidatePath('/staff');
  return { ok: true, message: '次回来店メモを保存しました。' };
}

// ---------------------------------------------------------------------
// 問診
// ---------------------------------------------------------------------
const intakeFields = ['skinFeel', 'productTrouble', 'recentProcedures', 'underTreatment', 'wishes', 'notes'] as const;

export async function saveIntake(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  const parsed = intakeSchema.safeParse({
    concerns: formData.getAll('concerns'),
    skinFeel: formData.get('skinFeel') ?? undefined,
    productTrouble: formData.get('productTrouble') ?? undefined,
    recentProcedures: formData.get('recentProcedures') ?? undefined,
    underTreatment: formData.get('underTreatment') ?? undefined,
    wishes: formData.get('wishes') ?? '',
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, intakeFields) };
  }
  const found = await getVisit(visitId);
  if (!found) return { message: '来店の記録が見つかりません。' };
  const { supabase } = found;
  const fields = {
    form_version: INTAKE_VERSION,
    answers: parsed.data,
    skin_condition_under_treatment: parsed.data.underTreatment === 'はい',
  };
  const { data: existing } = await supabase.from('intake_forms').select('visit_id').eq('visit_id', visitId).maybeSingle();
  const { error } = existing
    ? await supabase.from('intake_forms').update(fields).eq('visit_id', visitId)
    : await supabase.from('intake_forms').insert({ visit_id: visitId, ...fields });
  if (error) return { message: SAVE_FAILED, values: formValues(formData, intakeFields) };
  revalidatePath(visitPath(visitId), 'layout');
  redirect(`${visitPath(visitId)}?saved=intake`);
}

// ---------------------------------------------------------------------
// カウンセリングシート
// ---------------------------------------------------------------------
const counselingFields = ['concerns', 'analysisSummary', 'proposal', 'customerWishes', 'staffNotes'] as const;

export async function saveCounseling(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole(['staff', 'admin']);
  const parsed = counselingSchema.safeParse(Object.fromEntries(counselingFields.map((k) => [k, formData.get(k) ?? ''])));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, counselingFields) };
  }
  const found = await getVisit(visitId);
  if (!found) return { message: '来店の記録が見つかりません。' };
  const { supabase } = found;
  const v = parsed.data;
  const fields = {
    concerns: v.concerns,
    analysis_summary: v.analysisSummary,
    proposal: v.proposal,
    customer_wishes: v.customerWishes,
    staff_notes: v.staffNotes,
  };
  const { data: existing } = await supabase
    .from('counseling_sheets')
    .select('visit_id')
    .eq('visit_id', visitId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('counseling_sheets').update(fields).eq('visit_id', visitId)
    : await supabase.from('counseling_sheets').insert({ visit_id: visitId, ...fields });
  if (error) return { message: SAVE_FAILED, values: formValues(formData, counselingFields) };
  revalidatePath(visitPath(visitId), 'layout');
  redirect(`${visitPath(visitId)}?saved=counseling`);
}

// ---------------------------------------------------------------------
// 施術案内文
// ---------------------------------------------------------------------

/** 選んだメニューから、テンプレートで下書きを作る（AI は使わない） */
export async function draftProposal(visitId: string, formData: FormData): Promise<void> {
  const user = await requireRole(['staff', 'admin']);
  const menuIds = proposalSchema.shape.menuIds.safeParse(formData.getAll('menuIds'));
  if (!menuIds.success) return;
  const found = await getVisit(visitId);
  if (!found) return;
  const { supabase, visit } = found;

  const [{ data: customer }, { data: menus }, { data: intake }, { data: latest }] = await Promise.all([
    supabase.from('customers').select('full_name').eq('id', visit.customer_id).maybeSingle(),
    menuIds.data.length
      ? supabase.from('treatment_menus').select('*').in('id', menuIds.data).eq('is_active', true)
      : Promise.resolve({ data: [] }),
    supabase.from('intake_forms').select('answers, skin_condition_under_treatment').eq('visit_id', visitId).maybeSingle(),
    supabase
      .from('analyses')
      .select('analyzer_validated, analysis_items(metric, determinable, grade), photo_sessions!inner(visit_id)')
      .eq('photo_sessions.visit_id', visitId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1),
  ]);
  const answers = readIntakeAnswers(intake?.answers);
  const analysis = latest?.[0];
  const ordered = menuIds.data.map((id) => menus?.find((m) => m.id === id)).filter((m) => m !== undefined);
  const draft = buildProposalDraft({
    customerName: customer?.full_name ?? 'お客さま',
    menus: ordered,
    concerns: answers?.concerns ?? [],
    averages: analysis ? metricAverages(analysis.analysis_items) : null,
    analysisValidated: analysis?.analyzer_validated ?? false,
    underTreatment: intake?.skin_condition_under_treatment ?? false,
  });

  const fields = {
    menu_ids: ordered.map((m) => m.id),
    draft_text: draft.text,
    final_text: draft.text,
    generated_by: 'mock' as const,
    ai_model: null,
    status: 'draft' as const,
  };
  const { data: existing } = await supabase.from('care_proposals').select('id').eq('visit_id', visitId).maybeSingle();
  if (existing) {
    await supabase.from('care_proposals').update(fields).eq('id', existing.id);
  } else {
    await supabase
      .from('care_proposals')
      .insert({ id: crypto.randomUUID(), visit_id: visitId, created_by: user.id, ...fields });
  }
  revalidatePath(visitPath(visitId), 'layout');
  redirect(`${visitPath(visitId, 'proposal')}?drafted=1`);
}

export async function saveProposal(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['staff', 'admin']);
  const parsed = proposalSchema.safeParse({
    menuIds: formData.getAll('menuIds'),
    finalText: formData.get('finalText') ?? '',
    intent: formData.get('intent'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, ['finalText']) };
  const v = parsed.data;
  if (v.intent === 'approve' && v.finalText === '') {
    return { fieldErrors: { finalText: ['承認する前に案内文を入力してください'] }, values: formValues(formData, ['finalText']) };
  }
  const found = await getVisit(visitId);
  if (!found) return { message: '来店の記録が見つかりません。' };
  const { supabase } = found;

  const status = v.intent === 'approve' ? ('approved' as const) : ('draft' as const);
  const { data: existing } = await supabase
    .from('care_proposals')
    .select('id')
    .eq('visit_id', visitId)
    .maybeSingle();
  if (v.intent === 'reopen') {
    if (existing) await supabase.from('care_proposals').update({ status: 'draft' }).eq('id', existing.id);
    revalidatePath(visitPath(visitId), 'layout');
    return { ok: true, message: '承認を取り消しました。編集できます。' };
  }
  const { error } = existing
    ? await supabase.from('care_proposals').update({ menu_ids: v.menuIds, final_text: v.finalText, status }).eq('id', existing.id)
    : await supabase.from('care_proposals').insert({
        id: crypto.randomUUID(),
        visit_id: visitId,
        menu_ids: v.menuIds,
        final_text: v.finalText,
        generated_by: 'manual',
        status,
        created_by: user.id,
      });
  if (error) return { message: SAVE_FAILED, values: formValues(formData, ['finalText']) };
  revalidatePath(visitPath(visitId), 'layout');
  return {
    ok: true,
    message: status === 'approved' ? '案内文を承認しました。お客さまにお見せできます。' : '下書きを保存しました。',
  };
}

// ---------------------------------------------------------------------
// 施術の記録
// ---------------------------------------------------------------------
export async function addTreatment(visitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['staff', 'admin']);
  const parsed = treatmentSchema.safeParse({
    menuId: formData.get('menuId') ?? '',
    notes: formData.get('notes') ?? '',
    beforeSessionId: formData.get('beforeSessionId') ?? '',
    afterSessionId: formData.get('afterSessionId') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, ['notes']) };
  const found = await getVisit(visitId);
  if (!found) return { message: '来店の記録が見つかりません。' };
  const v = parsed.data;
  // メニュー名と料金は、データベースがメニューの現在の値を記録する
  const { error } = await found.supabase.from('treatments').insert({
    id: crypto.randomUUID(),
    visit_id: visitId,
    menu_id: v.menuId,
    notes: v.notes,
    before_session_id: v.beforeSessionId,
    after_session_id: v.afterSessionId,
    created_by: user.id,
  });
  if (error) return { message: '記録できませんでした。メニューが休止中でないか確認してください。', values: formValues(formData, ['notes']) };
  revalidatePath(visitPath(visitId), 'layout');
  revalidatePath(`/staff/customers/${found.visit.customer_id}`);
  return { ok: true, message: '施術を記録しました。' };
}

export async function updateTreatmentSessions(visitId: string, formData: FormData): Promise<void> {
  await requireRole(['staff', 'admin']);
  const parsed = treatmentSessionsSchema.safeParse({
    treatmentId: formData.get('treatmentId'),
    beforeSessionId: formData.get('beforeSessionId') ?? '',
    afterSessionId: formData.get('afterSessionId') ?? '',
  });
  if (!parsed.success) return;
  const found = await getVisit(visitId);
  if (!found) return;
  await found.supabase
    .from('treatments')
    .update({ before_session_id: parsed.data.beforeSessionId, after_session_id: parsed.data.afterSessionId })
    .eq('id', parsed.data.treatmentId)
    .eq('visit_id', visitId);
  revalidatePath(visitPath(visitId), 'layout');
}

export async function deleteTreatment(visitId: string, formData: FormData): Promise<void> {
  await requireRole(['staff', 'admin']);
  const id = uuidSchema.safeParse(formData.get('treatmentId'));
  if (!id.success) return;
  const found = await getVisit(visitId);
  if (!found) return;
  await found.supabase.from('treatments').delete().eq('id', id.data).eq('visit_id', visitId);
  revalidatePath(visitPath(visitId), 'layout');
}

// ---------------------------------------------------------------------
// 機器の実測値
// ---------------------------------------------------------------------
const measurementFields = ['deviceName', 'metric', 'value', 'unit', 'measuredAt', 'visitId'] as const;

export async function addMeasurement(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['staff', 'admin']);
  if (!uuidSchema.safeParse(customerId).success) return { message: '顧客が見つかりません。' };
  const parsed = measurementSchema.safeParse(
    Object.fromEntries(measurementFields.map((k) => [k, formData.get(k) ?? ''])),
  );
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, measurementFields) };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('device_measurements').insert({
    id: crypto.randomUUID(),
    customer_id: customerId,
    visit_id: v.visitId,
    device_name: v.deviceName,
    metric: v.metric,
    value: v.value,
    unit: v.unit,
    measured_at: tokyoLocalToIso(v.measuredAt),
    recorded_by: user.id,
  });
  if (error) return { message: SAVE_FAILED, values: formValues(formData, measurementFields) };
  revalidatePath(`/staff/customers/${customerId}`);
  // 続けて入力しやすいよう、機器名・単位・日時は残す
  return {
    ok: true,
    message: `${v.metric} を記録しました。`,
    values: { deviceName: v.deviceName, unit: v.unit, measuredAt: v.measuredAt, visitId: v.visitId ?? '' },
  };
}

export async function deleteMeasurement(customerId: string, formData: FormData): Promise<void> {
  await requireRole(['staff', 'admin']);
  const id = uuidSchema.safeParse(formData.get('id'));
  if (!id.success || !uuidSchema.safeParse(customerId).success) return;
  const supabase = await createClient();
  await supabase.from('device_measurements').delete().eq('id', id.data).eq('customer_id', customerId);
  revalidatePath(`/staff/customers/${customerId}`);
}

// ---------------------------------------------------------------------
// 施術メニュー（管理者）
// ---------------------------------------------------------------------
const menuFields = ['name', 'category', 'description', 'cautions', 'priceYen', 'durationMin', 'isActive'] as const;

export async function saveMenu(menuId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole(['admin']);
  const parsed = menuSchema.safeParse(Object.fromEntries(menuFields.map((k) => [k, formData.get(k) ?? undefined])));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error), values: formValues(formData, menuFields) };
  const v = parsed.data;
  const fields = {
    name: v.name,
    category: v.category,
    description: v.description,
    cautions: v.cautions,
    price_yen: v.priceYen,
    duration_min: v.durationMin,
    is_active: v.isActive,
    updated_by: user.id,
  };
  const supabase = await createClient();
  if (menuId) {
    if (!uuidSchema.safeParse(menuId).success) return { message: 'メニューが見つかりません。' };
    const { error } = await supabase.from('treatment_menus').update(fields).eq('id', menuId);
    if (error) return { message: SAVE_FAILED, values: formValues(formData, menuFields) };
  } else {
    const { error } = await supabase.from('treatment_menus').insert({ id: crypto.randomUUID(), ...fields });
    if (error) return { message: SAVE_FAILED, values: formValues(formData, menuFields) };
  }
  revalidatePath('/admin/menus');
  revalidatePath('/staff/menus');
  redirect(`/admin/menus?saved=${menuId ? 'updated' : 'created'}`);
}

export async function deleteMenu(menuId: string): Promise<void> {
  await requireRole(['admin']);
  if (!uuidSchema.safeParse(menuId).success) return;
  const supabase = await createClient();
  const { error } = await supabase.from('treatment_menus').delete().eq('id', menuId);
  if (error) throw new Error('menu_delete_failed');
  revalidatePath('/admin/menus');
  revalidatePath('/staff/menus');
  redirect('/admin/menus?saved=deleted');
}
