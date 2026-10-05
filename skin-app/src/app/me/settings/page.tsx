import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { getActiveConsents } from '@/lib/consent';
import { DisplayNameForm } from '@/features/account/display-name-form';
import { DeleteAccountForm } from '@/features/account/delete-account-form';
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
      </Card>

      <Card className="space-y-4">
        <h2 className="font-serif text-lg font-semibold">退会（すべてのデータの削除）</h2>
        <Notice tone="warning" title="元に戻せません">
          <ul className="list-disc space-y-1 pl-5">
            <li>写真・分析結果・セルフケアの記録・同意の記録・アカウントがすべて削除されます。</li>
            <li>削除したデータも、システムのバックアップに一定期間残る場合があります。</li>
            <li>操作の記録（監査ログ）には、退会したことと件数だけが残ります（写真や氏名は残りません）。</li>
            <li>サロンで登録された情報は、このアカウントとは別に管理されているため削除されません。サロンにお問い合わせください。</li>
          </ul>
        </Notice>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}
