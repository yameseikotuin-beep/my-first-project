import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CareProposalRow,
  CounselingSheetRow,
  Database,
  IntakeFormRow,
  TreatmentMenuRow,
  TreatmentRow,
  VisitRow,
} from '@/lib/supabase/database.types';

type Client = SupabaseClient<Database>;

export type VisitDetail = VisitRow & {
  customer: { id: string; full_name: string; full_name_kana: string };
  staffName: string | null;
  intake: IntakeFormRow | null;
  counseling: CounselingSheetRow | null;
  treatments: TreatmentRow[];
  proposal: CareProposalRow | null;
  sessions: { id: string; created_at: string }[];
};

/** 来店1件と関連する記録。RLS により、担当でない顧客の来店は null になる */
export async function loadVisit(supabase: Client, visitId: string): Promise<VisitDetail | null> {
  const { data: visit } = await supabase
    .from('visits')
    .select('*, customers(id, full_name, full_name_kana), profiles(display_name)')
    .eq('id', visitId)
    .maybeSingle();
  if (!visit || !visit.customers) return null;

  const [intake, counseling, treatments, proposal, sessions] = await Promise.all([
    supabase.from('intake_forms').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('counseling_sheets').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('treatments').select('*').eq('visit_id', visitId).order('created_at'),
    supabase.from('care_proposals').select('*').eq('visit_id', visitId).maybeSingle(),
    supabase.from('photo_sessions').select('id, created_at').eq('visit_id', visitId).order('created_at'),
  ]);

  const { customers, profiles, ...row } = visit;
  return {
    ...row,
    customer: customers,
    staffName: profiles?.display_name ?? null,
    intake: intake.data,
    counseling: counseling.data,
    treatments: treatments.data ?? [],
    proposal: proposal.data,
    sessions: sessions.data ?? [],
  };
}

export type VisitSummary = VisitRow & { staffName: string | null; menuNames: string[] };

export async function listVisits(supabase: Client, customerId: string, limit = 50): Promise<VisitSummary[]> {
  const { data } = await supabase
    .from('visits')
    .select('*, profiles(display_name), treatments(menu_name_snapshot)')
    .eq('customer_id', customerId)
    .order('visited_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(({ profiles, treatments, ...v }) => ({
    ...v,
    staffName: profiles?.display_name ?? null,
    menuNames: treatments.map((t) => t.menu_name_snapshot),
  }));
}

/** スタッフには有効なメニューだけ、管理者にはすべて返る（RLS） */
export async function listMenus(supabase: Client, { activeOnly }: { activeOnly: boolean }): Promise<TreatmentMenuRow[]> {
  let query = supabase.from('treatment_menus').select('*').order('category').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data } = await query;
  return data ?? [];
}

/** 撮影の一覧（前後比較・施術記録の選択肢に使う。写真の URL は含めない） */
export async function listCustomerSessions(supabase: Client, customerId: string, limit = 30) {
  const { data } = await supabase
    .from('photo_sessions')
    .select('id, created_at, visit_id')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export const VISIT_STEPS = [
  { key: 'intake', label: '問診' },
  { key: 'capture', label: '撮影・分析' },
  { key: 'counseling', label: 'カウンセリング' },
  { key: 'proposal', label: '施術案内' },
  { key: 'treatment', label: '施術・次回メモ' },
] as const;

export type VisitStepKey = (typeof VISIT_STEPS)[number]['key'];

/** ステップごとの記入状況 */
export function visitProgress(v: VisitDetail): Record<VisitStepKey, boolean> {
  return {
    intake: v.intake !== null,
    capture: v.sessions.length > 0,
    counseling: v.counseling !== null,
    proposal: v.proposal?.status === 'approved',
    treatment: v.treatments.length > 0,
  };
}
