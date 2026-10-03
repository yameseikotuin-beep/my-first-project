import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton, buttonClass } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { sanitizeSearch } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: '顧客台帳' };

const PAGE_SIZE = 20;
const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' });

export default async function CustomersPage({ searchParams }: PageProps<'/staff/customers'>) {
  await requireRole(['staff', 'admin']);
  const params = await searchParams;
  const q = sanitizeSearch(typeof params.q === 'string' ? params.q : '');
  const sort = params.sort === 'kana' ? 'kana' : 'updated';
  const page = Math.max(1, Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1);

  const supabase = await createClient();
  let query = supabase.from('customers').select('id, full_name, full_name_kana, phone, updated_at', { count: 'exact' });
  if (q) query = query.or(`full_name.ilike.%${q}%,full_name_kana.ilike.%${q}%,phone.ilike.%${q}%`);
  query =
    sort === 'kana'
      ? query.order('full_name_kana', { ascending: true }).order('full_name', { ascending: true })
      : query.order('updated_at', { ascending: false });
  const { data: customers, count, error } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (sort !== 'updated') sp.set('sort', sort);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return `/staff/customers${s ? `?${s}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle>顧客台帳</PageTitle>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <form role="search" className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end" action="/staff/customers">
          <label className="flex-1">
            <span className="block font-medium">検索（氏名・ふりがな・電話番号）</span>
            <input
              name="q"
              type="search"
              defaultValue={q}
              className="mt-1 block w-full rounded-xl border border-line bg-surface px-4 py-3"
            />
          </label>
          <label>
            <span className="block font-medium">並び順</span>
            <select name="sort" defaultValue={sort} className="mt-1 block rounded-xl border border-line bg-surface px-4 py-3">
              <option value="updated">更新が新しい順</option>
              <option value="kana">ふりがな順</option>
            </select>
          </label>
          <button type="submit" className={buttonClass('secondary')}>
            検索
          </button>
        </form>
        <LinkButton href="/staff/customers/new">顧客を登録する</LinkButton>
      </div>

      {error ? (
        <p className="text-danger">顧客を読み込めませんでした。再読み込みしてください。</p>
      ) : customers && customers.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[32rem] text-left">
            <caption className="sr-only">顧客の一覧（{count}件）</caption>
            <thead className="border-b border-line bg-surface-muted text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  氏名
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  ふりがな
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  電話番号
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  更新日
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <Link href={`/staff/customers/${c.id}`} className="font-medium text-sage-strong underline-offset-4 hover:underline">
                      {c.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{c.full_name_kana}</td>
                  <td className="px-4 py-3 text-ink-muted">{c.phone}</td>
                  <td className="px-4 py-3 text-ink-muted">{dateFormat.format(new Date(c.updated_at))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">
          {q ? '該当する顧客がいません。' : 'まだ顧客がいません。「顧客を登録する」から登録してください。'}
        </p>
      )}

      {totalPages > 1 ? (
        <nav aria-label="ページ" className="flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClass('secondary')}>
              前へ
            </Link>
          ) : null}
          <span className="text-ink-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={buttonClass('secondary')}>
              次へ
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
