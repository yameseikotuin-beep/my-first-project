import Link from 'next/link';
import type { AnalysisSummary } from '@/lib/analyses';

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export function AnalysisList({ analyses, hrefFor }: { analyses: AnalysisSummary[]; hrefFor: (id: string) => string }) {
  if (analyses.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">
        まだ分析の記録がありません。撮影した写真から分析できます。
      </p>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {analyses.map((a) => (
        <li key={a.id}>
          <Link href={hrefFor(a.id)} className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted active:bg-sage-soft">
            <span className="font-medium">{dateFormat.format(new Date(a.created_at))} の分析</span>
            <span className="flex flex-wrap gap-2 text-sm">
              {a.status === 'retake_required' ? (
                <span className="rounded-full bg-warning-soft px-3 py-1 text-warning">撮り直しが必要</span>
              ) : (
                <span className="rounded-full bg-sage-soft px-3 py-1 text-sage-strong">完了</span>
              )}
              {!a.analyzer_validated ? <span className="rounded-full bg-surface-muted px-3 py-1">モック</span> : null}
              <span className="rounded-full bg-surface-muted px-3 py-1">
                {a.provider === 'anthropic' ? 'AI 説明あり' : 'AI なし'}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
