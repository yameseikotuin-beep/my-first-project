import Link from 'next/link';
import type { AdminBookingListRow, BookingStatus } from '@/lib/supabase/database.types';
import { formatPrice, formatTimeRange } from '@/lib/time';

export const STATUS_LABEL: Record<BookingStatus, string> = { confirmed: '予約確定', cancelled: 'キャンセル' };

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
        status === 'confirmed' ? 'bg-primary-soft text-primary-strong' : 'bg-surface-muted text-ink-muted line-through'
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function formatPhone(digits: string): string {
  if (/^0[5789]0\d{8}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (/^0\d{9}$/.test(digits)) return digits.startsWith('03') || digits.startsWith('06')
    ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
    : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

/** 予約の一覧（スマートフォンではカード、パソコンでは表） */
export function BookingList({ bookings, showDate = false, usePractitioners }: {
  bookings: AdminBookingListRow[];
  showDate?: boolean;
  usePractitioners: boolean;
}) {
  if (bookings.length === 0) return <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-ink-muted">予約はありません。</p>;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link
            href={`/admin/bookings/${b.id}`}
            className={`grid gap-x-4 gap-y-0.5 px-4 py-3 hover:bg-surface-muted sm:grid-cols-[11rem_1fr_auto] ${b.status === 'cancelled' ? 'opacity-60' : ''}`}
          >
            <span className="font-bold tabular-nums">
              {showDate ? <span className="mr-2 font-normal">{shortDateOf(b.start_at)}</span> : null}
              {formatTimeRange(b.start_at, b.end_at)}
            </span>
            <span className="min-w-0">
              <span className="font-medium">{b.customer_name}</span>
              <span className="ml-2 text-sm text-ink-muted">{b.service_name}</span>
              <span className="block text-sm text-ink-muted">
                {b.room_name}
                {usePractitioners && b.practitioner_name ? `／${b.practitioner_name}` : ''}
                {b.source === 'admin' ? '／電話・来店' : '／WEB'}
                ／{formatPrice(b.price)}
              </span>
            </span>
            <span className="sm:text-right">
              <StatusBadge status={b.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function shortDateOf(iso: string) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', weekday: 'short' }).format(d);
  return p;
}
