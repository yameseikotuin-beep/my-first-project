import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { VisitHeader } from '@/features/salon/visit-header';
import { CounselingForm } from '@/features/salon/counseling-form';
import { DoctorNotice } from '@/features/salon/doctor-notice';
import { readIntakeAnswers } from '@/features/salon/schema';
import { saveCounseling } from '@/features/salon/actions';

export const metadata: Metadata = { title: 'カウンセリング' };

export default async function CounselingPage({ params }: PageProps<'/staff/visits/[visitId]/counseling'>) {
  await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const supabase = await createClient();
  const visit = await loadVisit(supabase, visitId);
  if (!visit) notFound();

  // まだシートがなければ、問診と、この来店の最新の分析の説明文を初期値にする
  let defaults = { concerns: '', analysisSummary: '', customerWishes: '' };
  if (!visit.counseling) {
    const answers = readIntakeAnswers(visit.intake?.answers);
    const sessionIds = visit.sessions.map((s) => s.id);
    const { data: latest } = sessionIds.length
      ? await supabase
          .from('analyses')
          .select('analyzer_validated, analysis_descriptions(summary)')
          .in('session_id', sessionIds)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
      : { data: [] };
    const analysis = latest?.[0];
    const summary = analysis?.analysis_descriptions?.summary ?? '';
    defaults = {
      concerns: answers?.concerns.join('、') ?? '',
      analysisSummary: summary && !analysis?.analyzer_validated ? `（仮の分析の結果です）${summary}` : summary,
      customerWishes: answers?.wishes ?? '',
    };
  }

  return (
    <div className="space-y-6">
      <VisitHeader visit={visit} current="counseling" />
      <PageTitle>カウンセリングシート</PageTitle>
      {visit.intake?.skin_condition_under_treatment ? <DoctorNotice /> : null}
      <Card>
        <CounselingForm action={saveCounseling.bind(null, visitId)} sheet={visit.counseling} defaults={defaults} />
      </Card>
    </div>
  );
}
