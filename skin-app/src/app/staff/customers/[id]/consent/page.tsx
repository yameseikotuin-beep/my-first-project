import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getActiveConsents, getLatestConsentDocuments } from '@/lib/consent';
import { uuidSchema } from '@/lib/validation/schemas';
import { ConsentForm } from '@/features/consent/consent-form';
import { grantCustomerConsents } from '@/features/consent/actions';

export const metadata: Metadata = { title: '同意の取得' };

// サロンのタブレットで、お客さまご本人に読んでいただいて同意を取る画面
export default async function CustomerConsentPage({ params }: PageProps<'/staff/customers/[id]/consent'>) {
  await requireRole(['staff', 'admin']);
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();
  const [documents, active] = await Promise.all([
    getLatestConsentDocuments(supabase),
    getActiveConsents(supabase, { customerId: id }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle lead="この画面をお客さまにお渡しし、内容を読んでいただいたうえで、同意する項目にチェックを入れていただいてください。">
        {customer.full_name} 様：写真の撮影・保存についての同意
      </PageTitle>
      <ConsentForm
        documents={documents}
        alreadyGranted={{
          photo_capture: Boolean(active.photo_capture),
          photo_storage: Boolean(active.photo_storage),
          ai_processing: Boolean(active.ai_processing),
        }}
        action={grantCustomerConsents.bind(null, id)}
        mode="salon"
      />
      <p className="mt-6">
        <Link href={`/staff/customers/${id}`} className="text-sage-strong underline-offset-4 hover:underline">
          顧客の詳細に戻る
        </Link>
      </p>
    </div>
  );
}
