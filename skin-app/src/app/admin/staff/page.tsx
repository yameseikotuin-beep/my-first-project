import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageTitle } from '@/components/ui/card';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { roleLabels, type AppRole } from '@/lib/auth/roles';
import { InviteForm } from '@/features/admin/invite-form';
import { updateMember } from '@/features/admin/actions';

export const metadata: Metadata = { title: 'スタッフ・権限' };

const filters: { key: 'staff' | 'all'; label: string }[] = [
  { key: 'staff', label: 'スタッフ・管理者' },
  { key: 'all', label: '一般ユーザーを含む全員' },
];

export default async function AdminStaffPage({ searchParams }: PageProps<'/admin/staff'>) {
  const me = await requireRole(['admin']);
  const sp = await searchParams;
  const filter = sp.filter === 'all' ? 'all' : 'staff';
  const supabase = await createClient();
  let query = supabase.from('profiles').select('*').order('role').order('created_at', { ascending: false }).limit(200);
  if (filter === 'staff') query = query.in('role', ['staff', 'admin']);
  const { data: members } = await query;

  return (
    <div className="space-y-6">
      <PageTitle lead="スタッフは招待メールから本人がパスワードを設定します。停止したアカウントはすぐにすべての画面・データにアクセスできなくなります。">
        スタッフ・権限
      </PageTitle>

      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold">スタッフを招待する</h2>
        <InviteForm />
      </Card>

      <nav aria-label="表示の切り替え" className="flex gap-2">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'staff' ? '/admin/staff' : '/admin/staff?filter=all'}
            aria-current={filter === f.key ? 'page' : undefined}
            className={`rounded-full px-4 py-2 transition-colors active:bg-sage-soft ${filter === f.key ? 'bg-sage-soft font-bold text-sage-strong' : 'text-ink-muted hover:bg-surface-muted'}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">利用者の一覧</caption>
          <thead className="border-b border-line bg-surface-muted text-sm text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                表示名
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                現在の役割
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                状態
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                変更
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(members ?? []).map((m) => {
              const self = m.id === me.id;
              return (
                <tr key={m.id}>
                  <td className="px-4 py-3">
                    {m.display_name || '（表示名なし）'}
                    {self ? <span className="ml-2 text-sm text-ink-muted">（あなた）</span> : null}
                  </td>
                  <td className="px-4 py-3">{roleLabels[m.role as AppRole]}</td>
                  <td className={`px-4 py-3 ${m.is_active ? 'text-sage-strong' : 'text-danger'}`}>
                    {m.is_active ? '有効' : '停止中'}
                  </td>
                  <td className="px-4 py-3">
                    {self ? (
                      <span className="text-sm text-ink-muted">自分の権限は変更できません</span>
                    ) : (
                      <form action={updateMember} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="target" value={m.id} />
                        <label className="sr-only" htmlFor={`role-${m.id}`}>
                          役割
                        </label>
                        <select
                          id={`role-${m.id}`}
                          name="role"
                          defaultValue={m.role}
                          className="min-h-11 rounded-xl border border-line bg-surface px-3"
                        >
                          <option value="user">一般ユーザー</option>
                          <option value="staff">サロンスタッフ</option>
                          <option value="admin">管理者</option>
                        </select>
                        <label className="sr-only" htmlFor={`active-${m.id}`}>
                          状態
                        </label>
                        <select
                          id={`active-${m.id}`}
                          name="isActive"
                          defaultValue={String(m.is_active)}
                          className="min-h-11 rounded-xl border border-line bg-surface px-3"
                        >
                          <option value="true">有効</option>
                          <option value="false">停止</option>
                        </select>
                        <SubmitButton variant="secondary" className="min-h-11 px-4 text-sm" pendingLabel="変更中…">
                          変更
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-ink-muted">役割を「一般ユーザー」に戻すと、そのアカウントの担当割当はすべて外れます。</p>
    </div>
  );
}
