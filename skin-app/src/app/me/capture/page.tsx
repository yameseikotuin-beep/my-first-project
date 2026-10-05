import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canCapture, getActiveConsents } from '@/lib/consent';
import { CaptureFlow } from '@/features/capture/capture-flow';
import { getSupabaseConfig } from '@/lib/env';

export const metadata: Metadata = { title: '撮影' };

export default async function MeCapturePage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const active = await getActiveConsents(supabase, { userId: user.id });

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>顔写真の撮影</PageTitle>
      {canCapture(active) ? (
        <CaptureFlow
          subject={{ kind: 'self' }}
          doneHref="/me/photos"
          cancelHref="/me"
          supabaseConfig={getSupabaseConfig()}
          analyzeHrefBase="/me/analyses/new?session="
        />
      ) : (
        <Notice tone="warning" title="撮影と保存への同意が必要です">
          <LinkButton href="/consent" className="mt-3">
            同意の内容を確認する
          </LinkButton>
        </Notice>
      )}
    </div>
  );
}
