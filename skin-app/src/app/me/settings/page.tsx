import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getActiveConsents } from '@/lib/consent';
import { DisplayNameForm } from '@/features/account/display-name-form';
import { ConsentStatus } from '@/features/consent/consent-status';

export const metadata: Metadata = { title: '設定' };

export default async function MeSettingsPage({ searchParams }: PageProps<'/me/settings'>) {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const active = await getActiveConsents(supabase, { userId: user.id });
  const { saved } = await searchParams;
  const missing = !active.photo_capture || !active.photo_storage || !active.ai_processing;

  return (
    <div className="space-y-6">
      <PageTitle>設定</PageTitle>
      {saved === 'consent' ? (
        <Notice tone="success" live>
          同意内容を保存しました。
        </Notice>
      ) : null}

      <Card>
        <h2 className="font-serif text-lg font-semibold">アカウント</h2>
        <p className="mt-1 text-sm text-ink-muted">メールアドレス：{user.email}</p>
        <div className="mt-4">
          <DisplayNameForm current={user.profile.display_name} />
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-lg font-semibold">同意の確認・撤回</h2>
        <ConsentStatus active={active} />
        {missing ? (
          <LinkButton href="/consent" variant="secondary" className="mt-4">
            同意していない項目を確認する
          </LinkButton>
        ) : null}
      </Card>

      <Card>
        <h2 className="font-serif text-lg font-semibold">写真とデータの削除</h2>
        <p className="mt-2 text-ink-muted">写真は「写真」画面から、1枚ずつまたは撮影ごとに削除できます。</p>
        <LinkButton href="/me/photos" variant="secondary" className="mt-3">
          写真を管理する
        </LinkButton>
        <Notice tone="info" title="退会（すべてのデータの削除）は準備中です">
          今後のアップデートで、この画面から退会できるようになります。それまでに退会を希望される場合は、運営者にお問い合わせください。
        </Notice>
      </Card>
    </div>
  );
}
