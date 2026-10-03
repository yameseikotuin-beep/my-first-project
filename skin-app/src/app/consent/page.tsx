import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand, LegalFooter } from '@/components/brand';
import { PageTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathForRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';
import { getActiveConsents, getLatestConsentDocuments } from '@/lib/consent';
import { ConsentForm } from '@/features/consent/consent-form';
import { grantSelfConsents } from '@/features/consent/actions';

export const metadata: Metadata = { title: '写真の撮影・保存についての同意' };

export default async function ConsentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // スタッフ・管理者の業務アカウントではセルフ撮影を使わない
  if (user.profile.role !== 'user') redirect(homePathForRole(user.profile.role));

  const supabase = await createClient();
  const [documents, active] = await Promise.all([
    getLatestConsentDocuments(supabase),
    getActiveConsents(supabase, { userId: user.id }),
  ]);

  return (
    <>
      <header className="border-b border-line bg-surface/80">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <Brand href="/me" />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <PageTitle lead="項目ごとに同意をお願いします。同意はあとから設定画面で確認・撤回できます。">
          写真の撮影・保存についての同意
        </PageTitle>
        <ConsentForm
          documents={documents}
          alreadyGranted={{
            photo_capture: Boolean(active.photo_capture),
            photo_storage: Boolean(active.photo_storage),
            ai_processing: Boolean(active.ai_processing),
          }}
          action={grantSelfConsents}
          mode="self"
        />
        <p className="mt-6 text-sm">
          <Link href="/me" className="text-sage-strong underline-offset-4 hover:underline">
            今は同意せずに進む（撮影機能は使えません）
          </Link>
        </p>
      </main>
      <LegalFooter />
    </>
  );
}
