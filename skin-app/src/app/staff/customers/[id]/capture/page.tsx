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

export default async function CustomerCapturePage({ params, searchParams }: PageProps<'/staff/customers/[id]/capture'>) {
  await requireRole(['staff', 'admin']);
  const { id } = await params;
  const { visit } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();
  // 来店から開いた場合は、撮影をその来店にひも付ける（同じ顧客の来店だけ）
  const visitId = typeof visit === 'string' && uuidSchema.safeParse(visit).success ? visit : null;
  const { data: visitRow } = visitId
    ? await supabase.from('visits').select('id').eq('id', visitId).eq('customer_id', id).maybeSingle()
    : { data: null };
  const active = await getActiveConsents(supabase, { customerId: id });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>顔写真の撮影</PageTitle>
      {canCapture(active) ? (
        <CaptureFlow
          subject={{ kind: 'customer', customerId: id, visitId: visitRow?.id }}
          subjectLabel={`${customer.full_name} 様${visitRow ? '（来店時の撮影）' : ''}`}
          doneHref={visitRow ? `/staff/visits/${visitRow.id}` : `/staff/customers/${id}?tab=photos`}
          cancelHref={visitRow ? `/staff/visits/${visitRow.id}` : `/staff/customers/${id}`}
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
