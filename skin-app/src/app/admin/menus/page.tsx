import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listMenus } from '@/lib/salon';
import { MenuList } from '@/features/salon/menu-list';

export const metadata: Metadata = { title: 'メニュー・料金' };

const savedMessages: Record<string, string> = {
  created: 'メニューを追加しました。',
  updated: 'メニューを保存しました。',
  deleted: 'メニューを削除しました。これまでの施術記録には、施術時点の名前と料金が残っています。',
};

export default async function AdminMenusPage({ searchParams }: PageProps<'/admin/menus'>) {
  await requireRole(['admin']);
  const { saved } = await searchParams;
  const supabase = await createClient();
  const menus = await listMenus(supabase, { activeOnly: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle lead="スタッフの施術案内・施術記録で使うメニューです。料金を変えても、過去の施術記録の料金は変わりません。">
          メニュー・料金
        </PageTitle>
        <LinkButton href="/admin/menus/new">メニューを追加する</LinkButton>
      </div>
      {typeof saved === 'string' && savedMessages[saved] ? (
        <Notice tone="success" live>
          {savedMessages[saved]}
        </Notice>
      ) : null}
      <MenuList menus={menus} hrefFor={(id) => `/admin/menus/${id}`} />
    </div>
  );
}
