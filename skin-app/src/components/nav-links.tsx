'use client';

import Link from 'next/link';
import { LinkPending } from './ui/link-pending';
import { usePathname } from 'next/navigation';

export type NavItem = { href: string; label: string; icon?: string; exact?: boolean };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'tabs' | 'side' | 'scroll' }) {
  const pathname = usePathname();

  if (variant === 'tabs') {
    // スマホ：片手で届く画面下部のタブ（PC では AppShell がヘッダーの下に横並びで表示する）
    return (
      <nav
        aria-label="メインメニュー"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden print:hidden"
      >
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors active:bg-sage-soft ${
                    active ? 'font-bold text-sage-strong' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <span aria-hidden className="relative text-lg">
                    {item.icon}
                    <span className="absolute -right-4 top-0.5">
                      <LinkPending />
                    </span>
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
                className={`flex min-h-11 items-center gap-2 rounded-full px-4 transition-colors active:bg-sage-soft ${
                  active ? 'bg-sage-soft font-bold text-sage-strong' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                }`}
              >
                {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                {item.label}
                <LinkPending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
