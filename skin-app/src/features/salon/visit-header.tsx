import Link from 'next/link';
import { LinkPending } from '@/components/ui/link-pending';
import { VISIT_STEPS, visitProgress, type VisitDetail, type VisitStepKey } from '@/lib/salon';

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export function stepHref(visit: VisitDetail, key: VisitStepKey): string {
  return key === 'capture'
    ? `/staff/customers/${visit.customer.id}/capture?visit=${visit.id}`
    : `/staff/visits/${visit.id}/${key}`;
}

/** 来店の見出しと、ステップの一覧（どこからでも再開できる） */
export function VisitHeader({ visit, current }: { visit: VisitDetail; current?: VisitStepKey }) {
  const done = visitProgress(visit);
  return (
    <header className="space-y-4 print:hidden">
      <div>
        <p className="text-sm text-ink-muted">
          <Link href={`/staff/customers/${visit.customer.id}?tab=visits`} className="underline-offset-4 hover:underline active:opacity-75">
            {visit.customer.full_name} 様
          </Link>
          {' ／ '}
          <Link href={`/staff/visits/${visit.id}`} className="underline-offset-4 hover:underline active:opacity-75">
            {dateFormat.format(new Date(visit.visited_at))} の来店
          </Link>
        </p>
        {visit.status === 'completed' ? (
          <p className="mt-1 inline-block rounded-full bg-sage-soft px-3 py-1 text-sm text-sage-strong">完了した来店</p>
        ) : null}
      </div>
      <nav aria-label="来店のステップ" className="overflow-x-auto">
        <ol className="flex gap-2">
          {VISIT_STEPS.map((s, i) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={stepHref(visit, s.key)}
                aria-current={current === s.key ? 'step' : undefined}
                className={`relative flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors active:bg-sage-soft ${
                  current === s.key
                    ? 'border-sage-strong bg-sage-soft font-bold text-sage-strong'
                    : 'border-line bg-surface text-ink hover:bg-surface-muted'
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    done[s.key] ? 'bg-sage-strong text-white' : 'bg-surface-muted text-ink-muted'
                  }`}
                >
                  {done[s.key] ? '✓' : i + 1}
                </span>
                {s.label}
                <span className="sr-only">{done[s.key] ? '（記入済み）' : '（未記入）'}</span>
                <LinkPending />
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </header>
  );
}
