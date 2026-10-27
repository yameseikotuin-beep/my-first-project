import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ResourceForm, WeeklyRanges } from '@/features/admin/resource-parts';
import { deleteRoom, saveRoom } from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: '施術スペースの編集' };

export default async function EditRoomPage({ params }: PageProps<'/admin/rooms/[id]'>) {
  await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: room }, { data: hours }] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
    supabase.from('room_hours').select('*').eq('room_id', id),
  ]);
  if (!room) notFound();
  return (
    <>
      <PageTitle>施術スペースの編集</PageTitle>
      <ResourceForm
        action={saveRoom}
        row={room}
        nameLabel="スペース名"
        activeLabel="利用可能"
        activeHint="オフにすると、このスペースには新しい予約が入りません（既存の予約はそのまま残ります）。"
        submitLabel="保存する"
      />
      <section className="mt-8">
        <SectionTitle>利用可能時間（任意）</SectionTitle>
        <WeeklyRanges kind="room" ownerId={room.id} ranges={hours ?? []} emptyText="設定がないため、営業時間中はいつでも利用できます。設定すると、その曜日・時間帯だけ利用できます。" />
      </section>
      <section className="mt-8">
        <SectionTitle>スペースの削除</SectionTitle>
        <p className="mb-3 text-sm text-ink-muted">予約で使われたスペースは削除できません。「利用可能」をオフにしてください。</p>
        <ActionForm action={deleteRoom} confirmMessage={`「${room.name}」を削除しますか？`}>
          <input type="hidden" name="id" value={room.id} />
          <FormSubmit variant="danger" size="sm">削除する</FormSubmit>
        </ActionForm>
      </section>
    </>
  );
}
