import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/auth/session';

const nav = [
  { href: '/admin', label: '管理トップ', icon: '⌂', exact: true },
  { href: '/admin/staff', label: 'スタッフ・権限', icon: '☺︎' },
  { href: '/admin/assignments', label: '担当の割当', icon: '⇄' },
  { href: '/admin/customers', label: '全顧客', icon: '☰' },
  { href: '/admin/menus', label: 'メニュー・料金', icon: '¥' },
  { href: '/admin/audit-logs', label: '監査ログ', icon: '✎' },
  { href: '/staff', label: 'サロン業務へ', icon: '→' },
];

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const user = await requireRole(['admin']);
  return (
    <AppShell nav={nav} displayName={user.profile.display_name} role="admin" homeHref="/admin" layout="side">
      {children}
    </AppShell>
  );
}
