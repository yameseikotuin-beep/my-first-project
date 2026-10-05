import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listCustomerSessions, listMenus, loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { VisitHeader } from '@/features/salon/visit-header';
import { DoctorNotice } from '@/features/salon/doctor-notice';
import { NextVisitForm, SessionSelect, TreatmentForm } from '@/features/salon/treatment-forms';
import { addTreatment, deleteTreatment, saveNextVisitMemo, updateTreatmentSessions } from '@/features/salon/actions';

export const metadata: Metadata = { title: '施術の記録' };

const yen = new Intl.NumberFormat('ja-JP');
const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export default async function TreatmentPage({ params }: PageProps<'/staff/visits/[visitId]/treatment'>) {
  await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const supabase = await createClient();
  const visit = await loadVisit(supabase, visitId);
  if (!visit) notFound();
  const [menus, sessions] = await Promise.all([
    listMenus(supabase, { activeOnly: true }),
    listCustomerSessions(supabase, visit.customer.id),
  ]);
  const sessionOptions = sessions.map((s) => ({
    id: s.id,
    label: `${dateFormat.format(new Date(s.created_at))}${s.visit_id === visitId ? '（この来店）' : ''}`,
  }));
  const total = visit.treatments.reduce((a, t) => a + t.price_yen_snapshot, 0);

  return (
    <div className="space-y-6">
      <VisitHeader visit={visit} current="treatment" />
      <PageTitle>施術・次回メモ</PageTitle>
      {visit.intake?.skin_condition_under_treatment ? <DoctorNotice /> : null}

      {visit.treatments.length ? (
        <Card>
          <h2 className="font-serif text-lg font-semibold">この来店の施術</h2>
          <ul className="mt-3 divide-y divide-line">
            {visit.treatments.map((t) => (
              <li key={t.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{t.menu_name_snapshot}</span>
                  <span className="tabular-nums">{yen.format(t.price_yen_snapshot)}円</span>
                </div>
                {t.notes ? <p className="whitespace-pre-wrap text-ink-muted">{t.notes}</p> : null}
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-medium">施術前後の撮影を選ぶ</summary>
                  <form action={updateTreatmentSessions.bind(null, visitId)} className="mt-3 space-y-4">
                    <input type="hidden" name="treatmentId" value={t.id} />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SessionSelect label="施術前" name="beforeSessionId" sessions={sessionOptions} defaultValue={t.before_session_id} />
                      <SessionSelect label="施術後" name="afterSessionId" sessions={sessionOptions} defaultValue={t.after_session_id} />
                    </div>
                    <SubmitButton variant="secondary" className="min-h-11 px-5 text-sm" pendingLabel="保存中…">
                      保存する
                    </SubmitButton>
                  </form>
                </details>
                <div className="flex flex-wrap gap-2">
                  {t.before_session_id && t.after_session_id ? (
                    <Link
                      href={`/staff/customers/${visit.customer.id}/compare?before=${t.before_session_id}&after=${t.after_session_id}`}
                      className="inline-flex min-h-11 items-center rounded-full bg-sage-soft px-4 text-sm text-sage-strong active:opacity-75"
                    >
                      施術前後を比べる
                    </Link>
                  ) : null}
                  <form action={deleteTreatment.bind(null, visitId)}>
                    <input type="hidden" name="treatmentId" value={t.id} />
                    <ConfirmSubmit confirmMessage={`「${t.menu_name_snapshot}」の記録を削除します。よろしいですか？`}>
                      記録を削除
                    </ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 flex justify-between border-t border-line pt-3 font-medium">
            <span>合計（施術時点の料金）</span>
            <span className="tabular-nums">{yen.format(total)}円</span>
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold">施術を記録する</h2>
        {menus.length ? (
          <TreatmentForm
            action={addTreatment.bind(null, visitId)}
            menus={menus}
            sessions={sessionOptions}
            defaultBefore={visit.sessions.at(-1)?.id}
          />
        ) : (
          <Notice tone="warning">提供中のメニューがありません。管理者にメニューの登録を依頼してください。</Notice>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold">次回への引き継ぎ</h2>
        <NextVisitForm action={saveNextVisitMemo.bind(null, visitId)} memo={visit.next_visit_memo} />
      </Card>
    </div>
  );
}
