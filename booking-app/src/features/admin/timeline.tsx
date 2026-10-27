import Link from 'next/link';
import type { AdminBookingListRow } from '@/lib/supabase/database.types';
import { jstTime } from '@/lib/time';
import { STATUS_LABEL } from './booking-parts';

export type TimelineColumn = { key: string; label: string; sub?: string; href?: string; bookings: AdminBookingListRow[] };

const PX_PER_MIN = 1.6;

function minutesOf(iso: string): number {
  const [h, m] = jstTime(iso).split(':').map(Number);
  return h * 60 + m;
}

/** 重なる予約を横に並べるための列（レーン）を割り当てる */
function layout(bookings: AdminBookingListRow[]) {
  const sorted = [...bookings].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const laneEnds: string[] = [];
  const placed = sorted.map((b) => {
    let lane = laneEnds.findIndex((end) => end <= b.start_at);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.end_at);
    } else {
      laneEnds[lane] = b.end_at;
    }
    return { b, lane };
  });
  return { placed, lanes: Math.max(1, laneEnds.length) };
}

/** 日別・週別の予約カレンダー（縦軸が時刻、横に列が並ぶ） */
export function Timeline({
  columns,
  startHour,
  endHour,
  usePractitioners,
  showRoom,
}: {
  columns: TimelineColumn[];
  startHour: number;
  endHour: number;
  usePractitioners: boolean;
  showRoom: boolean;
}) {
  const startMin = startHour * 60;
  const height = (endHour - startHour) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <div className="flex min-w-fit">
        <div className="w-12 shrink-0 border-r border-line">
          <div className="h-12 border-b border-line" />
          <div className="relative" style={{ height }}>
            {hours.slice(0, -1).map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-xs text-ink-muted tabular-nums" style={{ top: (h * 60 - startMin) * PX_PER_MIN }}>
                {h}:00
              </span>
            ))}
          </div>
        </div>
        {columns.map((col) => {
          const { placed, lanes } = layout(col.bookings);
          return (
            <div key={col.key} className="min-w-36 flex-1 border-r border-line last:border-r-0">
              <div className="flex h-12 flex-col items-center justify-center border-b border-line px-1 text-center text-sm leading-tight">
                {col.href ? (
                  <Link href={col.href} className="font-bold text-primary underline">
                    {col.label}
                  </Link>
                ) : (
                  <span className="font-bold">{col.label}</span>
                )}
                {col.sub ? <span className="text-xs text-ink-muted">{col.sub}</span> : null}
              </div>
              <div className="relative" style={{ height }}>
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: (h * 60 - startMin) * PX_PER_MIN }} />
                ))}
                {placed.map(({ b, lane }) => {
                  const top = Math.max(0, (minutesOf(b.start_at) - startMin) * PX_PER_MIN);
                  const h = Math.max(22, (minutesOf(b.end_at) - minutesOf(b.start_at)) * PX_PER_MIN - 2);
                  const cancelled = b.status === 'cancelled';
                  return (
                    <Link
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      title={`${jstTime(b.start_at)}〜${jstTime(b.end_at)} ${b.service_name} ${b.customer_name}（${STATUS_LABEL[b.status]}）`}
                      className={`absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-xs leading-snug ${
                        cancelled
                          ? 'border-dashed border-line bg-surface-muted text-ink-muted'
                          : 'border-primary/40 bg-primary-soft text-ink hover:border-primary'
                      }`}
                      style={{ top, height: h, left: `calc(${(lane / lanes) * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }}
                    >
                      <span className="block font-bold tabular-nums">
                        {jstTime(b.start_at)}〜{jstTime(b.end_at)}
                        {cancelled ? ' キャンセル' : ''}
                      </span>
                      <span className="block truncate">{b.customer_name}</span>
                      <span className="block truncate text-ink-muted">{b.service_name}</span>
                      {showRoom ? <span className="block truncate text-ink-muted">{b.room_name}</span> : null}
                      {usePractitioners && b.practitioner_name ? (
                        <span className="block truncate text-ink-muted">担当：{b.practitioner_name}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
