'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'ダッシュボード' },
  { href: '/admin/bookings', label: '予約一覧' },
  { href: '/admin/calendar', label: 'カレンダー' },
  { href: '/admin/bookings/new', label: '予約を登録' },
  { href: '/admin/services', label: 'メニュー' },
  { href: '/admin/rooms', label: '施術スペース' },
  { href: '/admin/practitioners', label: '施術者' },
  { href: '/admin/hours', label: '営業時間・休業日' },
  { href: '/admin/settings', label: '予約受付の設定' },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/bookings') return pathname === '/admin/bookings' || /^\/admin\/bookings\/(?!new)/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="管理メニュー" className="overflow-x-auto px-2 pb-2 lg:px-2 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                  current ? 'bg-primary-soft font-bold text-primary-strong' : 'text-ink hover:bg-surface-muted'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
