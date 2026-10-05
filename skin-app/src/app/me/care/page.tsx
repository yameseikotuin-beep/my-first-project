import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CareForm } from '@/features/care/care-form';
import { deleteCareLog } from '@/features/care/actions';
import { todayInTokyo } from '@/features/care/schema';

export const metadata: Metadata = { title: 'セルフケアの記録' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' });

export default async function CarePage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from('self_care_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('log_date', { ascending: false })
    .limit(60);

  return (
    <div className="space-y-6">
      <PageTitle lead="毎日のケアや体調を記録しておくと、分析結果と見比べるときの参考になります。">セルフケアの記録</PageTitle>
      <Card>
        <CareForm today={todayInTokyo()} />
      </Card>
      <section>
        <h2 className="mb-3 font-serif text-lg font-semibold">これまでの記録</h2>
        {logs && logs.length > 0 ? (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{dateFormat.format(new Date(`${log.log_date}T00:00:00Z`))}</p>
                    {log.care_items.length > 0 ? (
                      <ul className="flex flex-wrap gap-2">
                        {log.care_items.map((c) => (
                          <li key={c} className="rounded-full bg-sage-soft px-3 py-0.5 text-sm text-sage-strong">
                            {c}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {log.products ? <p className="text-sm">使ったもの：{log.products}</p> : null}
                    {log.sleep_hours !== null ? <p className="text-sm">睡眠：{Number(log.sleep_hours)}時間</p> : null}
                    {log.note ? <p className="whitespace-pre-wrap text-sm text-ink-muted">{log.note}</p> : null}
                  </div>
                  <form action={deleteCareLog}>
                    <input type="hidden" name="id" value={log.id} />
                    <ConfirmSubmit variant="secondary" confirmMessage="この日の記録を削除します。よろしいですか？">
                      削除
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">まだ記録がありません。</p>
        )}
      </section>
    </div>
  );
}
