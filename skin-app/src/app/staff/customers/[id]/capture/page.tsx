import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canCapture, getActiveConsents } from '@/lib/consent';
import { uuidSchema } from '@/lib/validation/schemas';
import { CaptureFlow } from '@/features/capture/capture-flow';
import { getSupabaseConfig } from '@/lib/env';

export const metadata: Metadata = { title: '撮影' };

export default async function CustomerCapturePage({ params }: PageProps<'/staff/customers/[id]/capture'>) {
  await requireRole(['staff', 'admin']);
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();
  const active = await getActiveConsents(supabase, { customerId: id });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>顔写真の撮影</PageTitle>
      {canCapture(active) ? (
        <CaptureFlow
          subject={{ kind: 'customer', customerId: id }}
          subjectLabel={`${customer.full_name} 様`}
          doneHref={`/staff/customers/${id}?tab=photos`}
          cancelHref={`/staff/customers/${id}`}
          supabaseConfig={getSupabaseConfig()}
          analyzeHrefBase={`/staff/customers/${id}/analyses/new?session=`}
        />
      ) : (
        <Notice tone="warning" title="撮影と保存への同意が必要です">
          <LinkButton href={`/staff/customers/${id}/consent`} className="mt-3">
            同意を取得する
          </LinkButton>
        </Notice>
      )}
    </div>
  );
}
