import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { isAdminClientConfigured } from '@/lib/supabase/admin';

export const metadata: Metadata = { title: '管理トップ' };

const PERIOD_DAYS = 30;
const dayFormat = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', timeZone: 'UTC' });

export default async function AdminHome() {
  await requireRole(['admin']);
  const supabase = await createClient();
  const [{ data: daily }, { data: byStaff }] = await Promise.all([
    supabase.rpc('admin_usage_daily', { p_days: PERIOD_DAYS }),
    supabase.rpc('admin_usage_by_staff', { p_days: PERIOD_DAYS }),
  ]);
  const days = daily ?? [];
  const sum = (key: 'analyses' | 'ai_calls' | 'ai_failed' | 'visits') => days.reduce((a, d) => a + Number(d[key]), 0);
  const usage = [
    { label: '来店', value: sum('visits') },
    { label: '分析', value: sum('analyses') },
    { label: 'AI の利用', value: sum('ai_calls') },
    { label: 'AI の失敗', value: sum('ai_failed') },
  ];
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
      <p className="text-sm text-ink-muted">一般ユーザーのセルフ撮影の件数は、本人以外が見られないため表示していません。</p>

      <section aria-labelledby="usage-title" className="space-y-4">
        <h2 id="usage-title" className="font-serif text-xl font-semibold">
          利用状況（直近{PERIOD_DAYS}日）
        </h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {usage.map((s) => (
            <Card key={s.label}>
              <dt className="text-sm text-ink-muted">{s.label}</dt>
              <dd className="mt-1 font-serif text-3xl font-semibold">{s.value}</dd>
            </Card>
          ))}
        </dl>
        <p className="text-sm text-ink-muted">
          分析は一般ユーザーのセルフ分析を含む件数です（誰の分析かは表示しません）。AI の利用は、Claude API に送った回数です。
        </p>

        <Card>
          <h3 className="font-serif text-lg font-semibold">スタッフ別</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <caption className="sr-only">スタッフ別の来店・分析・AI の利用の件数（直近{PERIOD_DAYS}日）</caption>
              <thead className="text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">名前</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">来店</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">分析</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">AI の利用</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(byStaff ?? []).map((r) => (
                  <tr key={r.staff_id} className={r.is_active ? '' : 'text-ink-muted'}>
                    <td className="py-2 pr-3">
                      {r.display_name || '（名前なし）'}
                      <span className="ml-2 text-xs text-ink-muted">
                        {r.role === 'admin' ? '管理者' : 'スタッフ'}
                        {r.is_active ? '' : '・停止中'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.visits}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.analyses}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.ai_calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-medium">日別の件数を見る</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-sm">
              <caption className="sr-only">日別の来店・分析・AI の利用の件数</caption>
              <thead className="text-ink-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">日付</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">来店</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">分析</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">AI の利用</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">AI の失敗</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td className="py-2 pr-3">{dayFormat.format(new Date(`${d.day}T00:00:00Z`))}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{d.visits}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{d.analyses}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{d.ai_calls}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{d.ai_failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
