import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { getBooking } from '@/lib/admin-data';
import { loadEditorData } from '@/features/admin/editor-data';
import { BookingEditor } from '@/features/admin/booking-editor';
import { CancelBookingButton } from '@/features/admin/cancel-booking-button';
import { formatPhone, StatusBadge } from '@/features/admin/booking-parts';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { formatDate, formatDateTime, formatPrice, formatTimeRange, isDateString, jstDate, jstTime } from '@/lib/time';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: '予約の詳細' };

export default async function BookingDetailPage({ params, searchParams }: PageProps<'/admin/bookings/[id]'>) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const booking = await getBooking(id);
  if (!booking) notFound();

  const serviceId = typeof sp.service === 'string' ? sp.service : booking.service_id;
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : jstDate(booking.start_at);
  const data = await loadEditorData(serviceId, date, booking.id);
  const rows: [string, React.ReactNode][] = [
    ['予約番号', <span key="n" className="font-mono">{booking.booking_number}</span>],
    ['ステータス', <StatusBadge key="s" status={booking.status} />],
    ['日時', `${formatDate(jstDate(booking.start_at), true)} ${formatTimeRange(booking.start_at, booking.end_at)}`],
    ['メニュー', `${booking.service_name}（${formatPrice(booking.price)}）`],
    ['施術スペース', booking.room_name],
    ...(data.settings.use_practitioners || booking.practitioner_name
      ? [['担当施術者', booking.practitioner_name ?? '未割り当て'] as [string, React.ReactNode]]
      : []),
    ['お名前', booking.customer_name],
    [
      '電話番号',
      <a key="p" href={`tel:${booking.customer_phone}`} className="text-primary underline">
        {formatPhone(booking.customer_phone)}
      </a>,
    ],
    [
      'メールアドレス',
      booking.customer_email ? (
        <a key="e" href={`mailto:${booking.customer_email}`} className="break-all text-primary underline">
          {booking.customer_email}
        </a>
      ) : (
        'なし'
      ),
    ],
    ['備考', <span key="m" className="whitespace-pre-wrap">{booking.notes || 'なし'}</span>],
    ['受付方法', booking.source === 'web' ? 'WEB予約' : '管理画面（電話・来店）'],
    ['登録日時', formatDateTime(booking.created_at, true)],
    ...(booking.cancelled_at ? [['キャンセル日時', formatDateTime(booking.cancelled_at, true)] as [string, React.ReactNode]] : []),
  ];

  return (
    <>
      <PageTitle>予約の詳細</PageTitle>
      {sp.saved ? (
        <div className="mb-4">
          <Notice tone="success" live>
            保存しました。
          </Notice>
        </div>
      ) : null}
      <dl className="mb-4 divide-y divide-line rounded-xl border border-line bg-surface">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-2.5">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mb-8 flex flex-wrap gap-3">
        {booking.status === 'confirmed' ? <CancelBookingButton bookingId={booking.id} /> : null}
        <Link href={`/admin/calendar?date=${jstDate(booking.start_at)}`} className="self-center text-primary underline">
          カレンダーで見る
        </Link>
      </div>

      <section>
        <SectionTitle>予約内容の変更</SectionTitle>
        <BookingEditor
          initial={{
            bookingId: booking.id,
            serviceId: booking.service_id,
            date: jstDate(booking.start_at),
            time: jstTime(booking.start_at),
            customerName: booking.customer_name,
            customerPhone: booking.customer_phone,
            customerEmail: booking.customer_email,
            notes: booking.notes,
            roomId: booking.room_id,
            practitionerId: booking.practitioner_id ?? '',
            status: booking.status,
          }}
          services={data.services}
          rooms={data.rooms}
          practitioners={data.practitioners}
          usePractitioners={data.settings.use_practitioners}
          slots={data.slots}
        />
      </section>
    </>
  );
}
