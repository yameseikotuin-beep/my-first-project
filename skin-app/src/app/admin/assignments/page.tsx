import type { Metadata } from 'next';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AssignmentForm } from '@/features/admin/assignment-form';
import { revokeAssignment } from '@/features/admin/actions';

export const metadata: Metadata = { title: '担当の割当' };

export default async function AssignmentsPage() {
  await requireRole(['admin']);
  const supabase = await createClient();
  const [{ data: staff }, { data: customers }, { data: assignments }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('role', 'staff').eq('is_active', true).order('display_name'),
    supabase.from('customers').select('id, full_name, full_name_kana').order('full_name_kana').limit(500),
    supabase
      .from('customer_assignments')
      .select('staff_id, customer_id, granted_at, profiles!customer_assignments_staff_id_fkey(display_name), customers(full_name)')
      .order('granted_at', { ascending: false })
      .limit(500),
  ]);

  return (
    <div className="space-y-6">
      <PageTitle lead="スタッフは、ここで割り当てられた顧客（と自分で登録した顧客）だけを閲覧・編集できます。">
        担当の割当
      </PageTitle>
      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold">担当を追加する</h2>
        <AssignmentForm
          staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name || '（表示名なし）' }))}
          customers={(customers ?? []).map((c) => ({
            id: c.id,
            name: c.full_name_kana ? `${c.full_name}（${c.full_name_kana}）` : c.full_name,
          }))}
        />
      </Card>
      <Card>
        <h2 className="font-serif text-lg font-semibold">現在の担当</h2>
        {assignments?.length ? (
          <ul className="mt-3 divide-y divide-line">
            {assignments.map((a) => (
              <li key={`${a.staff_id}-${a.customer_id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span>
                  {a.profiles?.display_name || '（表示名なし）'} → {a.customers?.full_name ?? '（削除された顧客）'}
                </span>
                <form action={revokeAssignment}>
                  <input type="hidden" name="staffId" value={a.staff_id} />
                  <input type="hidden" name="customerId" value={a.customer_id} />
                  <ConfirmSubmit variant="secondary" confirmMessage="この担当の割当を外します。よろしいですか？">
                    外す
                  </ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-muted">担当の割当はまだありません。</p>
        )}
      </Card>
    </div>
  );
}
