'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; icon?: string; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'tabs' | 'side' | 'scroll' }) {
  const pathname = usePathname();

  if (variant === 'tabs') {
    // スマホ：片手で届く画面下部のタブ（PC では上部に横並び）
    return (
      <nav
        aria-label="メインメニュー"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:order-first sm:mx-auto sm:mt-0 sm:w-full sm:max-w-6xl sm:border-0 sm:bg-transparent sm:px-4 sm:pt-4"
      >
        <ul className="grid grid-cols-4 sm:flex sm:gap-2">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-base ${
                    active ? 'font-bold text-sage-strong sm:bg-sage-soft' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <span aria-hidden className="text-lg sm:text-base">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="メインメニュー">
      <ul className={variant === 'side' ? 'space-y-1' : 'flex gap-1 overflow-x-auto px-2 py-1'}>
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 ${
                  active ? 'bg-sage-soft font-bold text-sage-strong' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
