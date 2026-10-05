import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalysisDescriptionRow,
  AnalysisItemRow,
  AnalysisRow,
  Database,
} from '@/lib/supabase/database.types';
import { loadSessionsWithPhotos, type SessionWithPhotos } from '@/lib/photos';
import { metricAverages } from '@/lib/analysis/summary';

export type AnalysisDetail = {
  analysis: AnalysisRow;
  items: AnalysisItemRow[];
  description: AnalysisDescriptionRow | null;
  session: SessionWithPhotos | null;
};

/** 分析結果を読み込む（RLS により、見る権限のないものは null） */
export async function loadAnalysis(supabase: SupabaseClient<Database>, id: string): Promise<AnalysisDetail | null> {
  const { data } = await supabase
    .from('analyses')
    .select('*, analysis_items(*), analysis_descriptions(*)')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const { analysis_items, analysis_descriptions, ...analysis } = data;
  const [session] = await loadSessionsWithPhotos(supabase, { sessionId: analysis.session_id }, 1);
  return {
    analysis,
    items: analysis_items,
    description: analysis_descriptions ?? null,
    session: session ?? null,
  };
}

export type AnalysisSummary = AnalysisRow & {
  provider: string | null;
  sessionCreatedAt: string;
};

/** 分析の一覧（新しい順） */
export async function listAnalyses(
  supabase: SupabaseClient<Database>,
  filter: { userId: string } | { customerId: string },
  limit = 30,
): Promise<AnalysisSummary[]> {
  let query = supabase
    .from('analyses')
    .select('*, analysis_descriptions(provider), photo_sessions!inner(user_id, customer_id, created_at)')
    .order('created_at', { ascending: false })
    .limit(limit);
  query =
    'userId' in filter
      ? query.eq('photo_sessions.user_id', filter.userId)
      : query.eq('photo_sessions.customer_id', filter.customerId);
  const { data } = await query;
  return (data ?? []).map(({ analysis_descriptions, photo_sessions, ...a }) => ({
    ...a,
    provider: analysis_descriptions?.provider ?? null,
    sessionCreatedAt: photo_sessions.created_at,
  }));
}

/** 同じ人（本人または同じ顧客）の、ひとつ前の「完了した」分析 */
export async function loadPreviousAnalysis(
  supabase: SupabaseClient<Database>,
  current: AnalysisDetail,
): Promise<AnalysisDetail | null> {
  if (!current.session) return null;
  let query = supabase
    .from('analyses')
    .select('id, photo_sessions!inner(user_id, customer_id)')
    .eq('status', 'completed')
    .lt('created_at', current.analysis.created_at)
    .order('created_at', { ascending: false })
    .limit(1);
  query = current.session.user_id
    ? query.eq('photo_sessions.user_id', current.session.user_id)
    : query.eq('photo_sessions.customer_id', current.session.customer_id!);
  const { data } = await query;
  const previousId = data?.[0]?.id;
  return previousId ? loadAnalysis(supabase, previousId) : null;
}

export type ProgressPoint = { analysisId: string; createdAt: string; averages: Record<string, number | null> };

/** 経過グラフ用：完了した分析ごとの、項目別の平均評価（古い順） */
export async function loadProgress(
  supabase: SupabaseClient<Database>,
  filter: { userId: string } | { customerId: string },
  limit = 30,
): Promise<ProgressPoint[]> {
  let query = supabase
    .from('analyses')
    .select('id, created_at, analysis_items(metric, determinable, grade), photo_sessions!inner(user_id, customer_id)')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit);
  query =
    'userId' in filter
      ? query.eq('photo_sessions.user_id', filter.userId)
      : query.eq('photo_sessions.customer_id', filter.customerId);
  const { data } = await query;
  return (data ?? [])
    .map((a) => ({ analysisId: a.id, createdAt: a.created_at, averages: metricAverages(a.analysis_items) }))
    .reverse();
}
