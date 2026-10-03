import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';

export const metadata: Metadata = { title: '初期設定が必要です' };

export default function SetupRequiredPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageTitle>初期設定が必要です</PageTitle>
      <Notice tone="warning" title="Supabase に接続されていません">
        環境変数 <code>NEXT_PUBLIC_SUPABASE_URL</code> と <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{' '}
        が設定されていないため、ログインが必要な機能は使えません。設定方法は <code>skin-app/docs/setup.md</code>{' '}
        を参照してください。
      </Notice>
    </div>
  );
}
