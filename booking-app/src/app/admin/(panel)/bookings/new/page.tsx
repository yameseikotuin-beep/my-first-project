import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { loadEditorData } from '@/features/admin/editor-data';
import { BookingEditor } from '@/features/admin/booking-editor';
import { PageTitle } from '@/components/ui/card';
import { isDateString, todayJst } from '@/lib/time';

export const metadata: Metadata = { title: '予約の登録' };

export default async function NewBookingPage({ searchParams }: PageProps<'/admin/bookings/new'>) {
  await requireAdmin();
  const sp = await searchParams;
  const serviceId = typeof sp.service === 'string' ? sp.service : '';
  const date = typeof sp.date === 'string' && isDateString(sp.date) ? sp.date : todayJst();
  const time = typeof sp.time === 'string' && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : '';
  const data = await loadEditorData(serviceId, date);
  return (
    <>
      <PageTitle lead="電話・来店での予約を登録します。WEB予約と同じく、重なる予約は登録できません。">予約の登録</PageTitle>
      <BookingEditor
        initial={{
          serviceId: data.services.some((s) => s.id === serviceId) ? serviceId : '',
          date,
          time,
          customerName: '',
          customerPhone: '',
          notes: '',
          roomId: '',
          practitionerId: '',
          status: 'confirmed',
        }}
        services={data.services}
        rooms={data.rooms}
        practitioners={data.practitioners}
        usePractitioners={data.settings.use_practitioners}
        slots={data.slots}
      />
    </>
  );
}
