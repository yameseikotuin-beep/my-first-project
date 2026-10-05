import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listMenus } from '@/lib/salon';
import { MenuList } from '@/features/salon/menu-list';

export const metadata: Metadata = { title: 'メニュー' };

export default async function StaffMenusPage() {
  const user = await requireRole(['staff', 'admin']);
  const supabase = await createClient();
  const menus = await listMenus(supabase, { activeOnly: true });
  return (
    <div className="space-y-6">
      <PageTitle
        lead={
          user.profile.role === 'admin'
            ? '提供中のメニューです。編集は「管理メニュー → メニュー・料金」から行います。'
            : '提供中のメニューです。内容や料金の変更は管理者にご相談ください。'
        }
      >
        メニュー
      </PageTitle>
      <MenuList menus={menus} />
    </div>
  );
}
