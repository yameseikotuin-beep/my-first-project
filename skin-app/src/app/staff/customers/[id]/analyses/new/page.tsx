import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadSessionsWithPhotos } from '@/lib/photos';
import { uuidSchema } from '@/lib/validation/schemas';
import { AnalyzeConfirm } from '@/features/analysis/analyze-confirm';
import { getAiAvailability } from '@/features/analysis/ai-availability';

export const metadata: Metadata = { title: '分析の確認' };
// AI の説明文の作成には時間がかかるため、処理の制限時間を延ばす
export const maxDuration = 60;

export default async function CustomerAnalyzePage({ params, searchParams }: PageProps<'/staff/customers/[id]/analyses/new'>) {
  const user = await requireRole(['staff', 'admin']);
  const { id } = await params;
  const { session: sessionParam } = await searchParams;
  const sessionId = uuidSchema.safeParse(sessionParam);
  if (!uuidSchema.safeParse(id).success || !sessionId.success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();
  const [session] = await loadSessionsWithPhotos(supabase, { sessionId: sessionId.data }, 1);
  if (!session || session.customer_id !== id) notFound();
  const ai = await getAiAvailability(supabase, { customerId: id }, user.profile.role);
  return (
    <AnalyzeConfirm
      session={session}
      ai={ai}
      subjectLabel={`${customer.full_name} 様`}
      consentHref={`/staff/customers/${id}/consent`}
    />
  );
}
