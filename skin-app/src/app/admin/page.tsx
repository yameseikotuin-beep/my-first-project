import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isAdminClientConfigured } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: '管理トップ' };

export default async function AdminHome() {
  await requireRole(['admin']);
  const supabase = await createClient();
  const count = async (role: 'user' | 'staff' | 'admin') =>
    (await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', role)).count ?? 0;
  const [users, staff, admins, customers, salonSessions] = await Promise.all([
    count('user'),
    count('staff'),
    count('admin'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).then((r) => r.count ?? 0),
    supabase
      .from('photo_sessions')
      .select('id', { count: 'exact', head: true })
      .not('customer_id', 'is', null)
      .then((r) => r.count ?? 0),
  ]);
  const stats = [
    { label: '一般ユーザー', value: users },
    { label: 'スタッフ', value: staff },
    { label: '管理者', value: admins },
    { label: '顧客', value: customers },
    { label: 'サロンでの撮影', value: salonSessions },
  ];

  return (
    <div className="space-y-6">
      <PageTitle>管理トップ</PageTitle>
      {!isAdminClientConfigured() ? (
        <Notice tone="warning" title="スタッフの招待が使えません">
          サーバーの環境変数 SUPABASE_SERVICE_ROLE_KEY が設定されていません。
        </Notice>
      ) : null}
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <dt className="text-sm text-ink-muted">{s.label}</dt>
            <dd className="mt-1 font-serif text-3xl font-semibold">{s.value}</dd>
          </Card>
        ))}
      </dl>
      <p className="text-sm text-ink-muted">
        一般ユーザーのセルフ撮影の件数は、本人以外が見られないため表示していません。分析件数・利用状況のレポートは今後のアップデートで追加されます。
      </p>
    </div>
  );
}
