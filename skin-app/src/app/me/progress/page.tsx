import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadProgress } from '@/lib/analyses';
import { ProgressCharts } from '@/features/analysis/progress-chart';

export const metadata: Metadata = { title: '経過グラフ' };

export default async function ProgressPage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const progress = await loadProgress(supabase, { userId: user.id });
  return (
    <div className="space-y-6">
      <PageTitle lead="完了した分析ごとに、項目別の平均の評価（1〜5、数字が大きいほど目立つ）を並べています。">経過グラフ</PageTitle>
      <Notice tone="warning" title="モック（未検証）の値のグラフです">
        今の評価は検証されていない仮の値のため、グラフの変化は肌の状態の変化を表しません。
      </Notice>
      {progress.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">
          まだ完了した分析がありません。撮影して分析すると、ここに経過が表示されます。
        </p>
      ) : (
        <ProgressCharts points={progress.map((p) => ({ id: p.analysisId, date: p.createdAt, averages: p.averages }))} />
      )}
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/me/analyses" variant="secondary">
          分析の記録へ
        </LinkButton>
        <LinkButton href="/me/care" variant="secondary">
          セルフケアの記録へ
        </LinkButton>
      </div>
    </div>
  );
}
