import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/validation/schemas';
import { deleteCustomer } from '@/features/customers/actions';

export const metadata: Metadata = { title: '全顧客' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' });

export default async function AdminCustomersPage({ searchParams }: PageProps<'/admin/customers'>) {
  await requireRole(['admin']);
  const sp = await searchParams;
  const q = sanitizeSearch(typeof sp.q === 'string' ? sp.q : '');
  const supabase = await createClient();
  let query = supabase
    .from('customers')
    .select('id, full_name, full_name_kana, created_at, customer_assignments(count)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) query = query.or(`full_name.ilike.%${q}%,full_name_kana.ilike.%${q}%`);
  const { data: customers } = await query;

  return (
    <div className="space-y-6">
      <PageTitle lead="顧客を削除すると、写真・同意の記録・担当割当もすべて削除されます。元に戻せません。">全顧客</PageTitle>
      {sp.deleted ? (
        <Notice tone="success" live>
          顧客を削除しました。
        </Notice>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form role="search" action="/admin/customers" className="flex flex-1 gap-2">
          <label className="flex-1">
            <span className="block font-medium">検索（氏名・ふりがな）</span>
            <input name="q" type="search" defaultValue={q} className="mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3" />
          </label>
        </form>
        <LinkButton href="/staff/customers/new">顧客を登録する</LinkButton>
      </div>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {(customers ?? []).map((c) => {
          const assigned = c.customer_assignments?.[0]?.count ?? 0;
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/staff/customers/${c.id}`} className="font-medium text-sage-strong underline-offset-4 hover:underline">
                  {c.full_name}
                </Link>
                <p className="text-sm text-ink-muted">
                  {c.full_name_kana} ・ 登録 {dateFormat.format(new Date(c.created_at))} ・ 担当{' '}
                  {assigned > 0 ? `${assigned}名` : <span className="text-warning">未割当</span>}
                </p>
              </div>
              <form action={deleteCustomer}>
                <input type="hidden" name="customerId" value={c.id} />
                <ConfirmSubmit
                  confirmMessage={`${c.full_name} 様のデータ（写真・同意の記録を含む）をすべて削除します。元に戻せません。よろしいですか？`}
                >
                  削除
                </ConfirmSubmit>
              </form>
            </li>
          );
        })}
        {customers?.length === 0 ? <li className="px-4 py-6 text-center text-ink-muted">該当する顧客がいません。</li> : null}
      </ul>
    </div>
  );
}
