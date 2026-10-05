import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listAnalyses } from '@/lib/analyses';
import { AnalysisList } from '@/features/analysis/analysis-list';

export const metadata: Metadata = { title: '分析の記録' };

export default async function MeAnalysesPage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const analyses = await listAnalyses(supabase, { userId: user.id });
  return (
    <div className="space-y-6">
      <PageTitle lead="分析するには、撮影した写真の一覧から「この撮影で分析する」を押してください。">分析の記録</PageTitle>
      <LinkButton href="/me/photos" variant="secondary">
        写真から分析する
      </LinkButton>
      <AnalysisList analyses={analyses} hrefFor={(id) => `/me/analyses/${id}`} />
    </div>
  );
}
