import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { VisitHeader } from '@/features/salon/visit-header';
import { IntakeForm } from '@/features/salon/intake-form';
import { readIntakeAnswers } from '@/features/salon/schema';
import { saveIntake } from '@/features/salon/actions';

export const metadata: Metadata = { title: '問診' };

export default async function IntakePage({ params }: PageProps<'/staff/visits/[visitId]/intake'>) {
  await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const visit = await loadVisit(await createClient(), visitId);
  if (!visit) notFound();
  return (
    <div className="space-y-6">
      <VisitHeader visit={visit} current="intake" />
      <PageTitle>問診</PageTitle>
      <Card>
        <IntakeForm action={saveIntake.bind(null, visitId)} answers={readIntakeAnswers(visit.intake?.answers)} />
      </Card>
    </div>
  );
}
