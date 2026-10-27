import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { listServices } from '@/lib/admin-data';
import { PageTitle } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { formatPrice } from '@/lib/time';

export const metadata: Metadata = { title: 'メニュー' };

export default async function ServicesPage({ searchParams }: PageProps<'/admin/services'>) {
  await requireAdmin();
  const sp = await searchParams;
  const services = await listServices();
  return (
    <>
      <PageTitle lead="施術メニューの追加・変更・受付停止ができます。" actions={<LinkButton href="/admin/services/new" size="sm">メニューを追加</LinkButton>}>
        メニュー
      </PageTitle>
      {sp.saved || sp.deleted ? (
        <div className="mb-4">
          <Notice tone="success" live>{sp.saved ? '保存しました。' : '削除しました。'}</Notice>
        </div>
      ) : null}
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {services.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/services/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted">
              <span>
                <span className="font-medium">{s.name}</span>
                <span className="ml-2 text-sm text-ink-muted">
                  {s.duration_minutes}分・{formatPrice(s.price)}
                </span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${s.is_active ? 'bg-primary-soft text-primary-strong' : 'bg-surface-muted text-ink-muted'}`}>
                {s.is_active ? '受付中' : '受付停止'}
              </span>
            </Link>
          </li>
        ))}
        {services.length === 0 ? <li className="px-4 py-6 text-center text-ink-muted">メニューがありません。</li> : null}
      </ul>
    </>
  );
}
