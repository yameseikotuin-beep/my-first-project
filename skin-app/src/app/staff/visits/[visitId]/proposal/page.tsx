import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listMenus, loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { VisitHeader } from '@/features/salon/visit-header';
import { ProposalForm } from '@/features/salon/proposal-form';
import { DoctorNotice } from '@/features/salon/doctor-notice';
import { draftProposal, saveProposal } from '@/features/salon/actions';

export const metadata: Metadata = { title: '施術案内' };

const yen = new Intl.NumberFormat('ja-JP');

export default async function ProposalPage({ params, searchParams }: PageProps<'/staff/visits/[visitId]/proposal'>) {
  const user = await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  const { drafted } = await searchParams;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const supabase = await createClient();
  const [visit, menus] = await Promise.all([loadVisit(supabase, visitId), listMenus(supabase, { activeOnly: true })]);
  if (!visit) notFound();
  const proposal = visit.proposal;
  const approved = proposal?.status === 'approved';

  return (
    <div className="space-y-6">
      <VisitHeader visit={visit} current="proposal" />
      <PageTitle lead="登録済みのメニューから案内文の下書きを作り、スタッフが確認・編集してから承認します。">施術案内</PageTitle>
      {visit.intake?.skin_condition_under_treatment ? <DoctorNotice /> : null}
      {drafted ? (
        <Notice tone="success" live>
          下書きを作りました。内容を確認してください。
        </Notice>
      ) : null}

      {!approved ? (
        <Card>
          <h2 className="font-serif text-lg font-semibold">1. ご案内するメニューを選ぶ</h2>
          <p className="mt-1 text-sm text-ink-muted">
            AI は使っていません。選んだメニューの説明・料金・注意事項と、問診の内容から、決まった文の形で下書きを作ります。
          </p>
          {menus.length === 0 ? (
            <Notice tone="warning" title="メニューがありません">
              {user.profile.role === 'admin' ? (
                <Link href="/admin/menus/new" className="underline">
                  メニューを登録する
                </Link>
              ) : (
                '管理者にメニューの登録を依頼してください。'
              )}
            </Notice>
          ) : (
            <form action={draftProposal.bind(null, visitId)} className="mt-4 space-y-4">
              <fieldset>
                <legend className="sr-only">メニュー</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {menus.map((m) => (
                    <label
                      key={m.id}
                      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 transition-colors active:bg-sage-soft has-[:checked]:border-sage has-[:checked]:bg-sage-soft"
                    >
                      <input
                        type="checkbox"
                        name="menuIds"
                        value={m.id}
                        defaultChecked={proposal?.menu_ids.includes(m.id)}
                        className="h-5 w-5 shrink-0 accent-[var(--color-sage-strong)]"
                      />
                      <span className="min-w-0">
                        <span className="block">{m.name}</span>
                        <span className="text-sm text-ink-muted">
                          {yen.format(m.price_yen)}円{m.duration_min ? `・約${m.duration_min}分` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {proposal ? (
                <ConfirmSubmit variant="secondary" confirmMessage="いまの案内文は、新しい下書きに置き換わります。よろしいですか？">
                  下書きを作り直す
                </ConfirmSubmit>
              ) : (
                <SubmitButton pendingLabel="作成中…">下書きを作る</SubmitButton>
              )}
            </form>
          )}
        </Card>
      ) : null}

      <Card>
        <h2 className="font-serif text-lg font-semibold">{approved ? '案内文' : '2. 確認して承認する'}</h2>
        <div className="mt-4">
          {!proposal ? <p className="mb-4 text-sm text-ink-muted">下書きを作るか、ここに直接入力することもできます。</p> : null}
          <ProposalForm action={saveProposal.bind(null, visitId)} proposal={proposal} />
        </div>
      </Card>
    </div>
  );
}
