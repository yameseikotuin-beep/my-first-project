import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'WEB予約', template: '%s | WEB予約' },
  description: '整骨院・整体院のWEB予約',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#f5f7f7',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // CSP の nonce を使うため、すべての画面をリクエストごとに描画する
  await headers();
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2"
        >
          本文へ移動
        </a>
        {children}
      </body>
    </html>
  );
}
