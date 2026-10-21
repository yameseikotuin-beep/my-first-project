import type { Metadata, Viewport } from 'next';
import { AnalyticsHead, AnalyticsScripts } from '@/components/Analytics';
import { lpConfig } from '@/config/lp.config';
import './globals.css';

const siteName = lpConfig.store.name || lpConfig.service.name;

export const metadata: Metadata = {
  title: { default: `骨盤・姿勢のセルフチェック｜${siteName}`, template: `%s｜${siteName}` },
  description: 'いくつかの質問に答えて、骨盤・姿勢に関する気になることを整理できるセルフチェックです。',
  // 個人情報を含まないページだが、外部へパスを渡さない
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1f3354',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <AnalyticsHead />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        <AnalyticsScripts />
      </body>
    </html>
  );
}
