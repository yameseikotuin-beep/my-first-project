import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getAvailableSlots, getPublicService } from '@/lib/public-data';
import { BookingForm } from '@/features/booking/booking-form';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/button';
import { jstDate } from '@/lib/time';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: 'お客様情報の入力' };

// 手順4・5：選んだ時間がまだ空いているかを確認してから、入力フォームを表示する
export default async function ConfirmPage({ params, searchParams }: PageProps<'/book/[serviceId]/confirm'>) {
  const { serviceId } = await params;
  const { start } = await searchParams;
  if (!uuidSchema.safeParse(serviceId).success) notFound();
  const service = await getPublicService(serviceId);
  if (!service) notFound();

  const startMs = typeof start === 'string' ? Date.parse(start) : NaN;
  const date = Number.isNaN(startMs) ? null : jstDate(new Date(startMs).toISOString());
  const slots = date ? await getAvailableSlots(serviceId, date) : [];
  const slot = slots.find((s) => Date.parse(s.start_at) === startMs);

  if (!slot) {
    return (
      <div className="space-y-4">
        <Notice tone="warning" title="この時間は予約できなくなりました">
          ほかのご予約で埋まったか、受付時間を過ぎました。お手数ですが、別の時間を選んでください。
        </Notice>
        <LinkButton href={`/book/${serviceId}${date ? `?date=${date}#slots` : ''}`} className="w-full">
          空き時間を選び直す
        </LinkButton>
      </div>
    );
  }
  return <BookingForm service={service} slot={slot} />;
}
