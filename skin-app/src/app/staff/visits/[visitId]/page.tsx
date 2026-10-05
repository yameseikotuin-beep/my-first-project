import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';
import { readIntakeAnswers } from '@/features/salon/schema';
import { VisitHeader, stepHref } from '@/features/salon/visit-header';
import { DoctorNotice } from '@/features/salon/doctor-notice';
import { deleteVisit, setVisitStatus } from '@/features/salon/actions';

export const metadata: Metadata = { title: '来店の記録' };

const timeFormat = new Intl.DateTimeFormat('ja-JP', { timeStyle: 'short', timeZone: 'Asia/Tokyo' });
const yen = new Intl.NumberFormat('ja-JP');

const savedMessages: Record<string, string> = {
  intake: '問診を保存しました。',
  counseling: 'カウンセリングシートを保存しました。',
};

function StepCard({
  title,
  done,
  href,
  actionLabel,
  children,
}: {
  title: string;
  done: boolean;
  href: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-semibold">
          {title}
          <span className={`ml-3 rounded-full px-3 py-1 align-middle font-sans text-xs ${done ? 'bg-sage-soft text-sage-strong' : 'bg-surface-muted text-ink-muted'}`}>
            {done ? '記入済み' : '未記入'}
          </span>
        </h2>
        <LinkButton href={href} variant={done ? 'secondary' : 'primary'} className="min-h-11 px-5 text-sm">
          {actionLabel}
        </LinkButton>
      </div>
      <div className="mt-3 text-[0.95rem]">{children}</div>
    </Card>
  );
}

export default async function VisitPage({ params, searchParams }: PageProps<'/staff/visits/[visitId]'>) {
  const user = await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  const { saved } = await searchParams;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const supabase = await createClient();
  const visit = await loadVisit(supabase, visitId);
  if (!visit) notFound();

  const answers = readIntakeAnswers(visit.intake?.answers);
  const sessionIds = visit.sessions.map((s) => s.id);
  const { data: analyses } = sessionIds.length
    ? await supabase
        .from('analyses')
        .select('id, created_at, status, session_id')
        .in('session_id', sessionIds)
        .order('created_at')
    : { data: [] };
  const total = visit.treatments.reduce((a, t) => a + t.price_yen_snapshot, 0);

  return (
    <div className="space-y-6">
      <VisitHeader visit={visit} />
      <PageTitle lead={visit.staffName ? `担当：${visit.staffName}` : undefined}>来店の記録</PageTitle>

      {typeof saved === 'string' && savedMessages[saved] ? (
        <Notice tone="success" live>
          {savedMessages[saved]}
        </Notice>
      ) : null}
      {visit.intake?.skin_condition_under_treatment ? <DoctorNotice /> : null}

      <StepCard title="1. 問診" done={!!visit.intake} href={stepHref(visit, 'intake')} actionLabel={visit.intake ? '見直す' : '問診をする'}>
        {answers ? (
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-muted">気になること</dt>
            <dd>{answers.concerns.length ? answers.concerns.join('、') : '特になし'}</dd>
            <dt className="text-ink-muted">肌の感じ方</dt>
            <dd>{answers.skinFeel}</dd>
            <dt className="text-ink-muted">ご希望</dt>
            <dd className="whitespace-pre-wrap">{answers.wishes || '－'}</dd>
          </dl>
        ) : (
          <p className="text-ink-muted">施術の前に、肌の状態やご希望をお伺いします。</p>
        )}
      </StepCard>

      <StepCard
        title="2. 撮影・分析"
        done={visit.sessions.length > 0}
        href={stepHref(visit, 'capture')}
        actionLabel={visit.sessions.length ? 'もう一度撮影する' : '撮影する'}
      >
        {visit.sessions.length ? (
          <ul className="space-y-2">
            {visit.sessions.map((s) => {
              const a = (analyses ?? []).filter((x) => x.session_id === s.id);
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3">
                  <span>{timeFormat.format(new Date(s.created_at))} の撮影</span>
                  {a.length ? (
                    a.map((x) => (
                      <Link
                        key={x.id}
                        href={`/staff/customers/${visit.customer.id}/analyses/${x.id}`}
                        className="rounded-full bg-sage-soft px-3 py-1 text-sm text-sage-strong active:opacity-75"
                      >
                        {x.status === 'completed' ? '分析結果を見る' : '撮り直しが必要'}
                      </Link>
                    ))
                  ) : (
                    <Link
                      href={`/staff/customers/${visit.customer.id}/analyses/new?session=${s.id}`}
                      className="rounded-full border border-line px-3 py-1 text-sm active:bg-sage-soft"
                    >
                      この撮影で分析する
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-ink-muted">撮影の同意がない場合は、先に同意を取得してください。</p>
        )}
      </StepCard>

      <StepCard
        title="3. カウンセリング"
        done={!!visit.counseling}
        href={stepHref(visit, 'counseling')}
        actionLabel={visit.counseling ? '見直す' : '記入する'}
      >
        {visit.counseling ? (
          <p className="line-clamp-3 whitespace-pre-wrap">{visit.counseling.concerns || visit.counseling.customer_wishes || '（記入あり）'}</p>
        ) : (
          <p className="text-ink-muted">お悩み・分析のまとめ・ご提案・ご希望を記録します。</p>
        )}
      </StepCard>

      <StepCard
        title="4. 施術案内"
        done={visit.proposal?.status === 'approved'}
        href={stepHref(visit, 'proposal')}
        actionLabel={visit.proposal ? '開く' : '案内文を作る'}
      >
        {visit.proposal ? (
          <p>{visit.proposal.status === 'approved' ? '承認済みの案内文があります。' : '下書きがあります（まだ承認していません）。'}</p>
        ) : (
          <p className="text-ink-muted">登録済みのメニューから案内文の下書きを作り、確認してから承認します。</p>
        )}
      </StepCard>

      <StepCard
        title="5. 施術・次回メモ"
        done={visit.treatments.length > 0}
        href={stepHref(visit, 'treatment')}
        actionLabel={visit.treatments.length ? '開く' : '施術を記録する'}
      >
        {visit.treatments.length ? (
          <ul className="space-y-1">
            {visit.treatments.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.menu_name_snapshot}</span>
                <span className="tabular-nums">{yen.format(t.price_yen_snapshot)}円</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line pt-1 font-medium">
              <span>合計</span>
              <span className="tabular-nums">{yen.format(total)}円</span>
            </li>
          </ul>
        ) : null}
        {visit.next_visit_memo ? <p className="mt-2 whitespace-pre-wrap">次回：{visit.next_visit_memo}</p> : null}
        {!visit.treatments.length && !visit.next_visit_memo ? <p className="text-ink-muted">行った施術と、次回への引き継ぎを記録します。</p> : null}
      </StepCard>

      <Card>
        <div className="flex flex-wrap gap-3">
          {visit.status === 'in_progress' ? (
            <form action={setVisitStatus.bind(null, visitId, 'completed')}>
              <SubmitButton pendingLabel="保存中…">来店を完了にする</SubmitButton>
            </form>
          ) : (
            <form action={setVisitStatus.bind(null, visitId, 'in_progress')}>
              <SubmitButton variant="secondary" pendingLabel="保存中…">
                記入を再開する
              </SubmitButton>
            </form>
          )}
          <LinkButton href={`/staff/visits/${visitId}/print`} variant="secondary">
            印刷用の画面
          </LinkButton>
          <LinkButton href={`/staff/customers/${visit.customer.id}/compare`} variant="secondary">
            施術前後を比べる
          </LinkButton>
        </div>
        {user.profile.role === 'admin' ? (
          <form action={deleteVisit.bind(null, visitId)} className="mt-6 border-t border-line pt-4">
            <p className="mb-3 text-sm text-ink-muted">
              来店を削除すると、問診・カウンセリング・施術案内・施術の記録も削除されます（撮影した写真は残ります）。
            </p>
            <ConfirmSubmit confirmMessage="この来店の記録を削除します。元に戻せません。よろしいですか？">来店を削除する</ConfirmSubmit>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
