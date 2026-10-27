import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { listRooms } from '@/lib/admin-data';
import { ServiceForm } from '@/features/admin/service-form';
import { PageTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'メニューの追加' };

export default async function NewServicePage() {
  await requireAdmin();
  const rooms = await listRooms();
  return (
    <>
      <PageTitle>メニューの追加</PageTitle>
      <ServiceForm rooms={rooms} roomIds={[]} />
    </>
  );
}
