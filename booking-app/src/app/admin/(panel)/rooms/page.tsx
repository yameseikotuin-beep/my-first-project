import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { listRooms } from '@/lib/admin-data';
import { ResourceForm, ResourceList } from '@/features/admin/resource-parts';
import { saveRoom } from '@/features/admin/settings-actions';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';

export const metadata: Metadata = { title: '施術スペース' };

export default async function RoomsPage({ searchParams }: PageProps<'/admin/rooms'>) {
  await requireAdmin();
  const sp = await searchParams;
  const rooms = await listRooms();
  return (
    <>
      <PageTitle lead="ベッドや個室を登録します。同じスペースに時間が重なる予約は入りません。">施術スペース</PageTitle>
      {sp.deleted ? <div className="mb-4"><Notice tone="success" live>削除しました。</Notice></div> : null}
      {rooms.every((r) => !r.is_active) ? (
        <div className="mb-4">
          <Notice tone="warning">利用可能なスペースがないため、現在は予約を受け付けられません。</Notice>
        </div>
      ) : null}
      <ResourceList rows={rooms} base="/admin/rooms" emptyText="施術スペースがありません。" />
      <section className="mt-8">
        <SectionTitle>スペースを追加</SectionTitle>
        <ResourceForm action={saveRoom} nameLabel="スペース名" activeLabel="利用可能" submitLabel="追加する" resetOnSuccess />
      </section>
    </>
  );
}
