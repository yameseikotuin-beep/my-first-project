import { AppShell } from '@/components/app-shell';
import { requireRole } from '@/lib/auth/session';

const nav = [
  { href: '/me', label: 'ホーム', icon: '⌂', exact: true },
  { href: '/me/capture', label: '撮影', icon: '◎' },
  { href: '/me/photos', label: '写真', icon: '▦' },
  { href: '/me/settings', label: '設定', icon: '⚙︎' },
];

export default async function MeLayout({ children }: LayoutProps<'/me'>) {
  const user = await requireRole(['user']);
  return (
    <AppShell nav={nav} displayName={user.profile.display_name} role="user" homeHref="/me" layout="tabs">
      {children}
    </AppShell>
  );
}
