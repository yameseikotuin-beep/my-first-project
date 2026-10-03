import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Noto_Sans_JP, Noto_Serif_JP } from 'next/font/google';
import './globals.css';

const sans = Noto_Sans_JP({ variable: '--font-noto-sans-jp', weight: ['400', '500', '700'], preload: false });
const serif = Noto_Serif_JP({ variable: '--font-noto-serif-jp', weight: ['500', '600'], preload: false });

export const metadata: Metadata = {
  title: { default: 'Skin Note', template: '%s | Skin Note' },
  description: '美容目的の肌の見た目の記録とカウンセリング補助アプリ',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#faf7f0',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // CSP の nonce を使うため、すべての画面をリクエストごとに描画する
  await headers();
  return (
    <html lang="ja" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
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
