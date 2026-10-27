import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listRooms } from '@/lib/admin-data';
import { ServiceForm } from '@/features/admin/service-form';
import { deleteService } from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: 'メニューの編集' };

export default async function EditServicePage({ params }: PageProps<'/admin/services/[id]'>) {
  await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: service }, { data: links }, rooms] = await Promise.all([
    supabase.from('services').select('*').eq('id', id).maybeSingle(),
    supabase.from('service_rooms').select('*').eq('service_id', id),
    listRooms(),
  ]);
  if (!service) notFound();
  return (
    <>
      <PageTitle>メニューの編集</PageTitle>
      <ServiceForm service={service} rooms={rooms} roomIds={(links ?? []).map((l) => l.room_id)} />
      <section className="mt-8">
        <SectionTitle>メニューの削除</SectionTitle>
        <p className="mb-3 text-sm text-ink-muted">予約で使われたメニューは削除できません。受付をやめる場合は「WEB予約を受け付ける」をオフにしてください。</p>
        <ActionForm action={deleteService} confirmMessage={`「${service.name}」を削除しますか？`}>
          <input type="hidden" name="id" value={service.id} />
          <FormSubmit variant="danger" size="sm">削除する</FormSubmit>
        </ActionForm>
      </section>
    </>
  );
}
