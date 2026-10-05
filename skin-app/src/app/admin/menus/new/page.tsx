import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { MenuForm } from '@/features/salon/menu-form';
import { saveMenu } from '@/features/salon/actions';

export const metadata: Metadata = { title: 'メニューを追加' };

export default async function NewMenuPage() {
  await requireRole(['admin']);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle>メニューを追加</PageTitle>
      <Card>
        <MenuForm action={saveMenu.bind(null, null)} submitLabel="追加する" />
      </Card>
    </div>
  );
}
