import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { logout } from '@/features/admin/auth-actions';
import { AdminNav } from '@/features/admin/admin-nav';

export const metadata: Metadata = { title: { default: '管理画面', template: '%s | 管理画面' } };

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:w-56 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:block">
          <Link href="/admin" className="font-bold">
            予約管理
          </Link>
          <p className="hidden truncate text-xs text-ink-muted lg:mt-1 lg:block">{admin.email}</p>
        </div>
        <AdminNav />
        <form action={logout} className="hidden px-4 py-3 lg:block">
          <button type="submit" className="text-sm text-ink-muted underline">
            ログアウト
          </button>
        </form>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-5 sm:px-6">
        {children}
        <form action={logout} className="mt-10 border-t border-line pt-4 lg:hidden">
          <button type="submit" className="text-sm text-ink-muted underline">
            ログアウト（{admin.email}）
          </button>
        </form>
      </main>
    </div>
  );
}
