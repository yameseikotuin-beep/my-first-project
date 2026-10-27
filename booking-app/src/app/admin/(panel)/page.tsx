import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';
import { getSettings, listBookingsBetween, listUpcomingBookings } from '@/lib/admin-data';
import { BookingList } from '@/features/admin/booking-parts';
import { Card, PageTitle, SectionTitle } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { formatDate, todayJst } from '@/lib/time';

export default async function DashboardPage() {
  await requireAdmin();
  const today = todayJst();
  const [settings, todays, upcoming] = await Promise.all([
    getSettings(),
    listBookingsBetween(today, today),
    listUpcomingBookings(10),
  ]);
  const confirmedToday = todays.filter((b) => b.status === 'confirmed');
  return (
    <>
      <PageTitle
        lead={formatDate(today, true)}
        actions={
          <>
            <LinkButton href="/admin/bookings/new" size="sm">
              予約を登録
            </LinkButton>
            <LinkButton href={`/admin/calendar?date=${today}`} size="sm" variant="secondary">
              予約カレンダー
            </LinkButton>
          </>
        }
      >
        ダッシュボード
      </PageTitle>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">本日の予約件数</p>
          <p className="text-3xl font-bold" data-testid="today-count">
            {confirmedToday.length}
            <span className="ml-1 text-base font-normal">件</span>
          </p>
          {todays.length > confirmedToday.length ? (
            <p className="text-xs text-ink-muted">ほかにキャンセル {todays.length - confirmedToday.length} 件</p>
          ) : null}
        </Card>
        <Card className="sm:col-span-2">
          <p className="mb-2 text-sm text-ink-muted">各種設定</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {[
              ['/admin/services', 'メニュー'],
              ['/admin/rooms', '施術スペース'],
              ['/admin/practitioners', '施術者'],
              ['/admin/hours', '営業時間・休業日'],
              ['/admin/settings', '予約受付の設定'],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-primary underline">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section className="mb-8">
        <SectionTitle>本日の予約</SectionTitle>
        <BookingList bookings={todays} usePractitioners={settings.use_practitioners} />
      </section>

      <section>
        <SectionTitle>直近の予約</SectionTitle>
        <BookingList bookings={upcoming} showDate usePractitioners={settings.use_practitioners} />
        <p className="mt-2 text-right text-sm">
          <Link href="/admin/bookings" className="text-primary underline">
            予約一覧へ
          </Link>
        </p>
      </section>
    </>
  );
}
