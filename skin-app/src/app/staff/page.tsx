import type { Metadata } from 'next';
import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'ダッシュボード' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export default async function StaffDashboard() {
  const user = await requireRole(['staff', 'admin']);
  const supabase = await createClient();
  // RLS により、スタッフには担当の顧客だけが返る
  const [{ count }, { data: recent }, { data: sessions }] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact', head: true }),
    supabase.from('customers').select('id, full_name, updated_at').order('updated_at', { ascending: false }).limit(5),
    supabase
      .from('photo_sessions')
      .select('id, created_at, customer_id, customers(full_name)')
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle lead={user.profile.role === 'admin' ? '管理者はすべての顧客を扱えます。' : '担当のお客さまだけが表示されます。'}>
        ダッシュボード
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-ink-muted">{user.profile.role === 'admin' ? '顧客数' : '担当の顧客数'}</p>
          <p className="mt-1 font-serif text-3xl font-semibold">{count ?? 0}</p>
        </Card>
        <Card className="md:col-span-2">
          <p className="text-sm text-ink-muted">本日の来店・次回来店メモ</p>
          <p className="mt-2 text-ink-muted">来店記録の機能は今後のアップデートで追加されます。</p>
        </Card>
      </div>
      <div className="flex flex-wrap gap-3">
        <LinkButton href="/staff/customers/new">顧客を登録する</LinkButton>
        <LinkButton href="/staff/customers" variant="secondary">
          顧客を探す
        </LinkButton>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-serif text-lg font-semibold">最近更新した顧客</h2>
          {recent?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href={`/staff/customers/${c.id}`} className="flex min-h-11 items-center justify-between py-2 hover:underline">
                    <span>{c.full_name}</span>
                    <span className="text-sm text-ink-muted">{dateFormat.format(new Date(c.updated_at))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-muted">まだ顧客がいません。</p>
          )}
        </Card>
        <Card>
          <h2 className="font-serif text-lg font-semibold">最近の撮影</h2>
          {sessions?.length ? (
            <ul className="mt-3 divide-y divide-line">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/staff/customers/${s.customer_id}?tab=photos`}
                    className="flex min-h-11 items-center justify-between py-2 hover:underline"
                  >
                    <span>{s.customers?.full_name ?? '顧客'}</span>
                    <span className="text-sm text-ink-muted">{dateFormat.format(new Date(s.created_at))}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-ink-muted">まだ撮影の記録がありません。</p>
          )}
        </Card>
      </div>
    </div>
  );
}
