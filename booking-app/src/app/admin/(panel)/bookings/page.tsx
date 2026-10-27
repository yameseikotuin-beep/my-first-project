import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { getSettings, listBookingsBetween } from '@/lib/admin-data';
import { BookingList } from '@/features/admin/booking-parts';
import { PageTitle } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { addDays, formatDate, isDateString, todayJst } from '@/lib/time';

export const metadata: Metadata = { title: '予約一覧' };

export default async function BookingsPage({ searchParams }: PageProps<'/admin/bookings'>) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayJst();
  const from = typeof sp.from === 'string' && isDateString(sp.from) ? sp.from : today;
  let to = typeof sp.to === 'string' && isDateString(sp.to) ? sp.to : from;
  if (to < from) to = from;
  if (to > addDays(from, 92)) to = addDays(from, 92);
  const status = sp.status === 'confirmed' || sp.status === 'cancelled' ? sp.status : undefined;
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 50) : '';

  const [settings, bookings] = await Promise.all([
    getSettings(),
    listBookingsBetween(from, to, { status, nameOrPhone: q || undefined }),
  ]);
  const single = from === to;
  const shift = (days: number) => `/admin/bookings?from=${addDays(from, days)}&to=${addDays(to, days)}${status ? `&status=${status}` : ''}`;

  return (
    <>
      <PageTitle actions={<LinkButton href="/admin/bookings/new" size="sm">予約を登録</LinkButton>}>予約一覧</PageTitle>

      <form method="get" className="mb-4 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[auto_auto_auto_1fr_auto] sm:items-end">
        <label className="block text-sm">
          開始日
          <input type="date" name="from" defaultValue={from} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-base" />
        </label>
        <label className="block text-sm">
          終了日
          <input type="date" name="to" defaultValue={to} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-base" />
        </label>
        <label className="block text-sm">
          ステータス
          <select name="status" defaultValue={status ?? ''} className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base">
            <option value="">すべて</option>
            <option value="confirmed">予約確定</option>
            <option value="cancelled">キャンセル</option>
          </select>
        </label>
        <label className="block text-sm">
          お名前・電話番号
          <input type="search" name="q" defaultValue={q} className="mt-1 block w-full rounded-lg border border-line px-3 py-2 text-base" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-primary px-5 text-white">
          絞り込む
        </button>
      </form>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          {single ? formatDate(from, true) : `${formatDate(from, true)} 〜 ${formatDate(to)}`}
          <span className="ml-2 text-sm font-normal text-ink-muted">{bookings.length}件</span>
        </p>
        <div className="flex gap-2 text-sm">
          <Link href={shift(single ? -1 : -7)} className="rounded-lg border border-line bg-surface px-3 py-2">
            ‹ 前{single ? 'の日' : 'へ'}
          </Link>
          <Link href="/admin/bookings" className="rounded-lg border border-line bg-surface px-3 py-2">
            今日
          </Link>
          <Link href={shift(single ? 1 : 7)} className="rounded-lg border border-line bg-surface px-3 py-2">
            次{single ? 'の日' : 'へ'} ›
          </Link>
        </div>
      </div>
      <BookingList bookings={bookings} showDate={!single} usePractitioners={settings.use_practitioners} />
    </>
  );
}
