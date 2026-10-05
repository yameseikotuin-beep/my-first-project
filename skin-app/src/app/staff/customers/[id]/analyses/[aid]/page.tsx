import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadAnalysis } from '@/lib/analyses';
import { uuidSchema } from '@/lib/validation/schemas';
import { AnalysisReport } from '@/features/analysis/analysis-report';

export const metadata: Metadata = { title: '分析結果' };

export default async function CustomerAnalysisPage({ params, searchParams }: PageProps<'/staff/customers/[id]/analyses/[aid]'>) {
  const user = await requireRole(['staff', 'admin']);
  const { id, aid } = await params;
  const { ai } = await searchParams;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(aid).success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();
  const detail = await loadAnalysis(supabase, aid);
  if (!detail || detail.session?.customer_id !== id) notFound();
  return (
    <AnalysisReport
      detail={detail}
      aiNotice={typeof ai === 'string' ? ai : undefined}
      againHref={`/staff/customers/${id}/capture`}
      customerId={id}
      canDelete={user.profile.role === 'admin'}
      subjectLabel={`${customer.full_name} 様`}
    />
  );
}
