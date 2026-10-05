import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { PrintButton } from '@/components/ui/print-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadSessionsWithPhotos, type SessionWithPhotos } from '@/lib/photos';
import { listCustomerSessions } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { METRICS } from '@/lib/analysis/types';
import { metricLabels } from '@/lib/analysis/labels';
import { changeLabel, lightingDiffers, metricAverages } from '@/lib/analysis/summary';
import { SessionSelect } from '@/features/salon/treatment-forms';

export const metadata: Metadata = { title: '施術前後の比較' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });
const angles = [
  { key: 'front', label: '正面' },
  { key: 'left', label: '左' },
  { key: 'right', label: '右' },
] as const;

const pickId = (v: string | string[] | undefined) => (typeof v === 'string' && uuidSchema.safeParse(v).success ? v : null);

export default async function ComparePage({ params, searchParams }: PageProps<'/staff/customers/[id]/compare'>) {
  await requireRole(['staff', 'admin']);
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('id, full_name').eq('id', id).maybeSingle();
  if (!customer) notFound();

  const sessions = await listCustomerSessions(supabase, id);
  const options = sessions.map((s) => ({ id: s.id, label: dateFormat.format(new Date(s.created_at)) }));
  // 指定がなければ、直近の2回を比べる（古い方が「前」）
  const own = new Set(sessions.map((s) => s.id));
  const beforeId = pickId(sp.before) ?? sessions[1]?.id ?? null;
  const afterId = pickId(sp.after) ?? sessions[0]?.id ?? null;
  const ready = beforeId && afterId && beforeId !== afterId && own.has(beforeId) && own.has(afterId);

  let pair: { before: SessionWithPhotos; after: SessionWithPhotos } | null = null;
  let averages: { before: ReturnType<typeof metricAverages> | null; after: ReturnType<typeof metricAverages> | null; validated: boolean } | null =
    null;
  if (ready) {
    const [[before], [after], { data: analyses }] = await Promise.all([
      loadSessionsWithPhotos(supabase, { sessionId: beforeId }, 1),
      loadSessionsWithPhotos(supabase, { sessionId: afterId }, 1),
      supabase
        .from('analyses')
        .select('session_id, analyzer_validated, created_at, analysis_items(metric, determinable, grade)')
        .in('session_id', [beforeId, afterId])
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
    ]);
    if (before && after) {
      pair = { before, after };
      const latest = (sid: string) => (analyses ?? []).find((a) => a.session_id === sid);
      const a = latest(beforeId);
      const b = latest(afterId);
      averages = {
        before: a ? metricAverages(a.analysis_items) : null,
        after: b ? metricAverages(b.analysis_items) : null,
        validated: Boolean(a?.analyzer_validated && b?.analyzer_validated),
      };
    }
  }

  const brightness = (s: SessionWithPhotos) =>
    (s.photos.find((p) => p.angle === 'front')?.quality as { brightness?: number } | null)?.brightness ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle lead={`${customer.full_name} 様`}>施術前後の比較</PageTitle>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton />
          <LinkButton href={`/staff/customers/${id}?tab=visits`} variant="ghost">
            顧客の画面に戻る
          </LinkButton>
        </div>
      </div>

      {sessions.length < 2 ? (
        <Notice title="比べる撮影が足りません">撮影が2回以上あると比べられます。施術の前と後に撮影してください。</Notice>
      ) : (
        <Card className="print:hidden">
          <form method="get" className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <SessionSelect label="前（比べるもと）" name="before" sessions={options} defaultValue={beforeId} />
            <SessionSelect label="後" name="after" sessions={options} defaultValue={afterId} />
            <Button type="submit" variant="secondary">
              比べる
            </Button>
          </form>
        </Card>
      )}

      {sessions.length >= 2 && !pair ? <Notice tone="warning">違う日の撮影を2つ選んでください。</Notice> : null}

      {pair ? (
        <Card className="space-y-5">
          {lightingDiffers(brightness(pair.before), brightness(pair.after)) ? (
            <p className="text-sm text-warning">⚠︎ 2回の撮影で明るさが大きく異なるため、見た目の差が実際より大きく、または小さく見えることがあります。</p>
          ) : null}
          {angles.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-2 gap-3 break-inside-avoid">
              {[
                { side: '前', session: pair.before },
                { side: '後', session: pair.after },
              ].map(({ side, session }) => {
                const photo = session.photos.find((p) => p.angle === key);
                return (
                  <figure key={side}>
                    {photo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 短時間で失効する署名付き URL のため
                      <img src={photo.url} alt={`${side}・${label}の写真`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                    ) : (
                      <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-surface-muted text-sm text-ink-muted">写真なし</div>
                    )}
                    <figcaption className="mt-1 text-sm">
                      {side}・{label}（{dateFormat.format(new Date(session.created_at))}）
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ))}

          {averages?.before && averages.after ? (
            <div className="space-y-2">
              <h2 className="font-serif text-lg font-semibold">分析の項目別の平均</h2>
              {!averages.validated ? (
                <p className="text-sm text-warning">
                  ⚠︎ 仮の分析（モック）の値のため、数字の変化は肌の状態の変化を表しません。写真を並べて見比べる用途でお使いください。
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-left text-[0.95rem]">
                  <caption className="sr-only">施術前後の項目別の平均評価</caption>
                  <thead className="text-sm text-ink-muted">
                    <tr>
                      <th scope="col" className="py-2 pr-3 font-medium">項目</th>
                      <th scope="col" className="py-2 pr-3 font-medium">前</th>
                      <th scope="col" className="py-2 pr-3 font-medium">後</th>
                      <th scope="col" className="py-2 font-medium">変化</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {METRICS.map((m) => (
                      <tr key={m}>
                        <td className="py-2 pr-3">{metricLabels[m]}</td>
                        <td className="py-2 pr-3">{averages.before?.[m]?.toFixed(1) ?? '－'}</td>
                        <td className="py-2 pr-3">{averages.after?.[m]?.toFixed(1) ?? '－'}</td>
                        <td className="py-2">{changeLabel(averages.before?.[m] ?? null, averages.after?.[m] ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">両方の撮影を分析すると、項目別の平均も並べて表示します。</p>
          )}
          <p className="text-sm text-ink-muted">
            写真の見た目の比較です。施術の効果を示したり、約束したりするものではありません。
          </p>
        </Card>
      ) : null}
    </div>
  );
}
