import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/auth/session';

export default async function StaffLayout({ children }: LayoutProps<'/staff'>) {
  const user = await requireRole(['staff', 'admin']);
  const nav = [
    { href: '/staff', label: 'ダッシュボード', icon: '⌂', exact: true },
    { href: '/staff/customers', label: '顧客台帳', icon: '☰' },
    ...(user.profile.role === 'admin' ? [{ href: '/admin', label: '管理メニュー', icon: '⚙︎' }] : []),
  ];
  return (
    <AppShell
      nav={nav}
      displayName={user.profile.display_name}
      role={user.profile.role}
      homeHref="/staff"
      layout="side"
    >
      {children}
    </AppShell>
  );
}
