import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadAnalysis } from '@/lib/analyses';
import { uuidSchema } from '@/lib/validation/schemas';
import { AnalysisReport } from '@/features/analysis/analysis-report';

export const metadata: Metadata = { title: '分析結果' };

export default async function MeAnalysisPage({ params, searchParams }: PageProps<'/me/analyses/[id]'>) {
  await requireRole(['user']);
  const { id } = await params;
  const { ai } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const detail = await loadAnalysis(supabase, id);
  if (!detail) notFound();
  return (
    <AnalysisReport
      detail={detail}
      aiNotice={typeof ai === 'string' ? ai : undefined}
      againHref="/me/capture"
      canDelete
    />
  );
}
