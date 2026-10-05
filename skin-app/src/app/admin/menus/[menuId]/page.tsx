import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validation/schemas';
import { MenuForm } from '@/features/salon/menu-form';
import { deleteMenu, saveMenu } from '@/features/salon/actions';

export const metadata: Metadata = { title: 'メニューの編集' };

export default async function EditMenuPage({ params }: PageProps<'/admin/menus/[menuId]'>) {
  await requireRole(['admin']);
  const { menuId } = await params;
  if (!uuidSchema.safeParse(menuId).success) notFound();
  const supabase = await createClient();
  const { data: menu } = await supabase.from('treatment_menus').select('*').eq('id', menuId).maybeSingle();
  if (!menu) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle>メニューの編集</PageTitle>
      <Card>
        <MenuForm action={saveMenu.bind(null, menuId)} menu={menu} submitLabel="保存する" />
      </Card>
      <Card>
        <h2 className="font-serif text-lg font-semibold">メニューの削除</h2>
        <p className="mt-2 text-ink-muted">
          一時的に提供をやめる場合は、削除せずに「休止中」にしてください。削除しても、これまでの施術記録の名前と料金は残ります。
        </p>
        <form action={deleteMenu.bind(null, menuId)} className="mt-4">
          <ConfirmSubmit confirmMessage={`「${menu.name}」を削除します。よろしいですか？`}>削除する</ConfirmSubmit>
        </form>
      </Card>
    </div>
  );
}
