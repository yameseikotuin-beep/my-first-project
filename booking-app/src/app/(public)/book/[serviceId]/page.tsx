import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAvailableSlots, getOpenDays, getPublicInfo, getPublicService } from '@/lib/public-data';
import { Selection, StepBar } from '@/features/booking/steps';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/button';
import { addDays, addMonths, isDateString, jstTime, monthGrid, WEEKDAY_LABELS, formatDate } from '@/lib/time';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: '日時の選択' };

// 手順2・3：日付の選択と予約可能な時間の表示
export default async function DatePage({ params, searchParams }: PageProps<'/book/[serviceId]'>) {
  const { serviceId } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(serviceId).success) notFound();
  const [info, service] = await Promise.all([getPublicInfo(), getPublicService(serviceId)]);
  if (!info || !service) notFound();

  const today = info.today;
  const lastDay = addDays(today, info.booking_window_days);
  const selected = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : null;
  const firstMonth = today.slice(0, 7);
  const lastMonth = lastDay.slice(0, 7);
  let month = typeof sp.month === 'string' && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : (selected ?? today).slice(0, 7);
  if (month < firstMonth) month = firstMonth;
  if (month > lastMonth) month = lastMonth;

  const weeks = monthGrid(month);
  const [openDays, slots] = await Promise.all([
    getOpenDays(`${month}-01`, addDays(addMonths(month, 1) + '-01', -1)),
    selected ? getAvailableSlots(serviceId, selected) : Promise.resolve([]),
  ]);
  const base = `/book/${serviceId}`;
  const [y, m] = month.split('-').map(Number);

  return (
    <>
      <StepBar current={2} />
      <Selection service={service} date={selected ?? undefined} />
      <h1 className="mb-3 text-xl font-bold">日付を選んでください</h1>

      <section aria-label={`${y}年${m}月のカレンダー`} className="rounded-xl border border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          {month > firstMonth ? (
            <Link href={`${base}?month=${addMonths(month, -1)}`} className="min-h-10 rounded-lg px-3 py-2 text-primary">
              ‹ 前の月
            </Link>
          ) : (
            <span />
          )}
          <h2 className="font-bold">
            {y}年{m}月
          </h2>
          {month < lastMonth ? (
            <Link href={`${base}?month=${addMonths(month, 1)}`} className="min-h-10 rounded-lg px-3 py-2 text-primary">
              次の月 ›
            </Link>
          ) : (
            <span />
          )}
        </div>
        <table className="w-full table-fixed border-separate border-spacing-1 text-center">
          <thead>
            <tr>
              {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                <th
                  key={w}
                  scope="col"
                  className={`text-xs font-medium ${w === 0 ? 'text-danger' : w === 6 ? 'text-primary' : 'text-ink-muted'}`}
                >
                  {WEEKDAY_LABELS[w]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, i) => (
              <tr key={i}>
                {week.map((day, j) => {
                  if (!day) return <td key={j} />;
                  const open = openDays.get(day) === true;
                  const isSelected = day === selected;
                  const label = `${formatDate(day)}${open ? '' : '（予約不可）'}`;
                  return (
                    <td key={day}>
                      {open ? (
                        <Link
                          href={`${base}?date=${day}#slots`}
                          aria-label={label}
                          aria-current={isSelected ? 'date' : undefined}
                          className={`flex h-11 items-center justify-center rounded-lg text-base font-medium ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'border border-primary/40 bg-primary-soft text-primary-strong hover:border-primary'
                          }`}
                        >
                          {Number(day.slice(8))}
                        </Link>
                      ) : (
                        <span
                          aria-label={label}
                          className="flex h-11 items-center justify-center rounded-lg text-base text-ink-muted/50"
                        >
                          {Number(day.slice(8))}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-muted">色の付いた日を選べます。灰色の日は休業日または受付期間外です。</p>
      </section>

      {selected ? (
        <section id="slots" className="mt-5 scroll-mt-4">
          <h2 className="mb-3 text-lg font-bold">{formatDate(selected)}の空き時間</h2>
          {slots.length === 0 ? (
            <Notice>この日は予約できる時間がありません。別の日を選んでください。</Notice>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((s) => (
                <li key={s.start_at}>
                  <Link
                    href={`${base}/confirm?start=${encodeURIComponent(s.start_at)}`}
                    className="flex h-12 items-center justify-center rounded-lg border border-primary/50 bg-surface text-base font-bold text-primary-strong hover:bg-primary-soft active:bg-primary-soft"
                  >
                    {jstTime(s.start_at)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-ink-muted">表示は開始時刻です（施術時間 {service.duration_minutes}分）。</p>
        </section>
      ) : null}

      <div className="mt-6">
        <LinkButton href="/" variant="secondary" className="w-full">
          メニューを選び直す
        </LinkButton>
      </div>
    </>
  );
}
