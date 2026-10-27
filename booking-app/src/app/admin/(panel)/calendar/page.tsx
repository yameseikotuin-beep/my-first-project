import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getSettings, listBookingsBetween, listRooms } from '@/lib/admin-data';
import { Timeline, type TimelineColumn } from '@/features/admin/timeline';
import { PageTitle } from '@/components/ui/card';
import { addDays, formatDate, isDateString, jstDate, jstTime, startOfWeek, todayJst } from '@/lib/time';

export const metadata: Metadata = { title: '予約カレンダー' };

export default async function CalendarPage({ searchParams }: PageProps<'/admin/calendar'>) {
  await requireAdmin();
  const sp = await searchParams;
  const view = sp.view === 'week' ? 'week' : 'day';
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : todayJst();
  const showCancelled = sp.cancelled === '1';
  const from = view === 'week' ? startOfWeek(date) : date;
  const to = view === 'week' ? addDays(from, 6) : date;

  const supabase = await createClient();
  const [settings, rooms, bookings, hours] = await Promise.all([
    getSettings(),
    listRooms(),
    listBookingsBetween(from, to),
    supabase.from('business_hours').select('open_time, close_time').eq('is_closed', false),
  ]);
  const visible = bookings.filter((b) => showCancelled || b.status === 'confirmed');

  // 表示する時間帯：営業時間と予約が入っている時間をすべて含む
  const hourValues = [
    ...(hours.data ?? []).flatMap((h) => [h.open_time, h.close_time]).filter((t): t is string => Boolean(t)),
    ...visible.flatMap((b) => [jstTime(b.start_at), jstTime(b.end_at)]),
  ].map((t) => Number(t.slice(0, 2)) + (t.slice(3, 5) !== '00' ? 1 : 0));
  const startHour = Math.min(9, ...hourValues.map((h) => Math.max(0, h - 1)));
  const endHour = Math.max(19, ...hourValues);

  let columns: TimelineColumn[];
  if (view === 'day') {
    const used = new Set(visible.map((b) => b.room_id));
    columns = rooms
      .filter((r) => r.is_active || used.has(r.id))
      .map((r) => ({
        key: r.id,
        label: r.name,
        sub: r.is_active ? undefined : '利用停止中',
        bookings: visible.filter((b) => b.room_id === r.id),
      }));
  } else {
    columns = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((d) => ({
      key: d,
      label: formatDate(d),
      href: `/admin/calendar?view=day&date=${d}${showCancelled ? '&cancelled=1' : ''}`,
      bookings: visible.filter((b) => jstDate(b.start_at) === d),
    }));
  }

  const q = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ view, date, ...(showCancelled ? { cancelled: '1' } : {}), ...patch });
    if (p.get('cancelled') === '0') p.delete('cancelled');
    return `/admin/calendar?${p}`;
  };
  const step = view === 'week' ? 7 : 1;
  const tab = (active: boolean) =>
    `rounded-lg px-3 py-2 text-sm ${active ? 'bg-primary text-white' : 'border border-line bg-surface'}`;

  return (
    <>
      <PageTitle lead={view === 'week' ? `${formatDate(from, true)} 〜 ${formatDate(to)}` : formatDate(date, true)}>
        予約カレンダー
      </PageTitle>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={q({ view: 'day' })} className={tab(view === 'day')} aria-current={view === 'day' ? 'page' : undefined}>
          日別
        </Link>
        <Link href={q({ view: 'week' })} className={tab(view === 'week')} aria-current={view === 'week' ? 'page' : undefined}>
          週別
        </Link>
        <span className="mx-1" />
        <Link href={q({ date: addDays(date, -step) })} className={tab(false)}>
          ‹ 前{view === 'week' ? 'の週' : 'の日'}
        </Link>
        <Link href={q({ date: todayJst() })} className={tab(false)}>
          今日
        </Link>
        <Link href={q({ date: addDays(date, step) })} className={tab(false)}>
          次{view === 'week' ? 'の週' : 'の日'} ›
        </Link>
        <form method="get" className="flex items-center gap-1">
          <input type="hidden" name="view" value={view} />
          {showCancelled ? <input type="hidden" name="cancelled" value="1" /> : null}
          <label className="sr-only" htmlFor="cal-date">
            日付を指定
          </label>
          <input id="cal-date" type="date" name="date" defaultValue={date} className="rounded-lg border border-line px-2 py-1.5 text-base" />
          <button type="submit" className={tab(false)}>
            表示
          </button>
        </form>
        <Link href={q({ cancelled: showCancelled ? '0' : '1' })} className="text-sm text-primary underline">
          キャンセルを{showCancelled ? '隠す' : '表示'}
        </Link>
      </div>
      <p className="mb-2 text-sm text-ink-muted">
        {visible.filter((b) => b.status === 'confirmed').length}件の予約。予約を押すと詳細を確認できます。
      </p>
      <Timeline
        columns={columns}
        startHour={startHour}
        endHour={endHour}
        usePractitioners={settings.use_practitioners}
        showRoom={view === 'week'}
      />
    </>
  );
}
