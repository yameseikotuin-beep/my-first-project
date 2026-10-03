import type { Metadata } from 'next';
import { PageTitle } from '@/components/ui/card';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { roleLabels, type AppRole } from '@/lib/auth/roles';

export const metadata: Metadata = { title: '監査ログ' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Tokyo' });

const actionLabels: Record<string, string> = {
  'photo.upload': '写真のアップロード',
  'photo.view': '写真の表示',
  'photo.delete': '写真の削除',
  'photo_session.delete': '撮影の削除',
  'customer.create': '顧客の登録',
  'customer.update': '顧客の更新',
  'customer.delete': '顧客の削除',
  'assignment.grant': '担当の割当',
  'assignment.revoke': '担当の解除',
  'consent.create': '同意の取得',
  'consent.update': '同意の撤回',
  'profile.update': '役割・状態の変更',
  'member.invite': 'スタッフの招待',
};

export default async function AuditLogsPage({ searchParams }: PageProps<'/admin/audit-logs'>) {
  await requireRole(['admin']);
  const sp = await searchParams;
  const action = typeof sp.action === 'string' && sp.action in actionLabels ? sp.action : '';
  const supabase = await createClient();
  let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
  if (action) query = query.eq('action', action);
  const { data: logs } = await query;

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter((v): v is string => Boolean(v)))];
  const { data: actors } = actorIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', actorIds)
    : { data: [] };
  const names = new Map((actors ?? []).map((a) => [a.id, a.display_name || '（表示名なし）']));

  return (
    <div className="space-y-6">
      <PageTitle lead="監査ログは追記のみで、管理者を含め誰も変更・削除できません。最新200件を表示します。">監査ログ</PageTitle>
      <form action="/admin/audit-logs" className="flex flex-wrap items-end gap-2">
        <label>
          <span className="block font-medium">操作の種類</span>
          <select name="action" defaultValue={action} className="mt-1 block min-h-12 rounded-xl border border-line bg-surface px-4">
            <option value="">すべて</option>
            {Object.entries(actionLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-12 rounded-full border border-line bg-surface px-6">
          絞り込む
        </button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">監査ログ</caption>
          <thead className="border-b border-line bg-surface-muted text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">日時</th>
              <th scope="col" className="px-4 py-3 font-medium">操作した人</th>
              <th scope="col" className="px-4 py-3 font-medium">操作</th>
              <th scope="col" className="px-4 py-3 font-medium">対象</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(logs ?? []).map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-2">{dateFormat.format(new Date(log.created_at))}</td>
                <td className="px-4 py-2">
                  {log.actor_id ? (names.get(log.actor_id) ?? '（退会済み）') : 'システム'}
                  {log.actor_role ? <span className="text-ink-muted">（{roleLabels[log.actor_role as AppRole]}）</span> : null}
                </td>
                <td className="px-4 py-2">{actionLabels[log.action] ?? log.action}</td>
                <td className="px-4 py-2 font-mono text-xs text-ink-muted">
                  {log.target_type ? `${log.target_type}:${log.target_id?.slice(0, 8) ?? ''}` : '－'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
