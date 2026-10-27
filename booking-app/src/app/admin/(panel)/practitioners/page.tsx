import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { getSettings, listPractitioners } from '@/lib/admin-data';
import { ResourceForm, ResourceList } from '@/features/admin/resource-parts';
import { savePractitioner, setUsePractitioners } from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';

export const metadata: Metadata = { title: '施術者' };

export default async function PractitionersPage({ searchParams }: PageProps<'/admin/practitioners'>) {
  await requireAdmin();
  const sp = await searchParams;
  const [settings, practitioners] = await Promise.all([getSettings(), listPractitioners()]);
  const enabled = settings.use_practitioners;
  return (
    <>
      <PageTitle lead="施術者を管理すると、施術者の空きも合わせて予約の可否を判定します。">施術者</PageTitle>
      {sp.deleted ? <div className="mb-4"><Notice tone="success" live>削除しました。</Notice></div> : null}
      <section className="mb-6 rounded-xl border border-line bg-surface p-4">
        <p className="mb-2">
          施術者の管理：<strong data-testid="use-practitioners">{enabled ? '有効' : '無効'}</strong>
        </p>
        <p className="mb-3 text-sm text-ink-muted">
          {enabled
            ? '予約には、空いている施術スペースと、対応できる空いている施術者の両方が必要です。'
            : '施術スペースの空きだけで予約の可否を判定しています。'}
        </p>
        {enabled && !practitioners.some((p) => p.is_active) ? (
          <div className="mb-3">
            <Notice tone="warning">利用可能な施術者がいないため、現在は予約を受け付けられません。</Notice>
          </div>
        ) : null}
        <ActionForm action={setUsePractitioners} confirmMessage={enabled ? '施術者の管理を無効にしますか？' : '施術者の管理を有効にしますか？'}>
          <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
          <FormSubmit variant={enabled ? 'secondary' : 'primary'} size="sm">{enabled ? '無効にする' : '有効にする'}</FormSubmit>
        </ActionForm>
      </section>
      <ResourceList rows={practitioners} base="/admin/practitioners" emptyText="施術者が登録されていません。" />
      <section className="mt-8">
        <SectionTitle>施術者を追加</SectionTitle>
        <ResourceForm action={savePractitioner} nameLabel="施術者名" activeLabel="利用可能" submitLabel="追加する" resetOnSuccess />
      </section>
    </>
  );
}
