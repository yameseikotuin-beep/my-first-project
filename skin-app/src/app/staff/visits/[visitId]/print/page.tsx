import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { PrintButton } from '@/components/ui/print-button';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { loadVisit } from '@/lib/salon';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: 'カウンセリングシート（印刷用）' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeZone: 'Asia/Tokyo' });
const yen = new Intl.NumberFormat('ja-JP');

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t border-line pt-4">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <div className="mt-2 whitespace-pre-wrap leading-relaxed">{children}</div>
    </section>
  );
}

/** お客さまにお渡しする控え。スタッフのメモと問診の詳細は載せない */
export default async function VisitPrintPage({ params }: PageProps<'/staff/visits/[visitId]/print'>) {
  await requireRole(['staff', 'admin']);
  const { visitId } = await params;
  if (!uuidSchema.safeParse(visitId).success) notFound();
  const visit = await loadVisit(await createClient(), visitId);
  if (!visit) notFound();
  const c = visit.counseling;
  const approved = visit.proposal?.status === 'approved' ? visit.proposal : null;
  const total = visit.treatments.reduce((a, t) => a + t.price_yen_snapshot, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-3 print:hidden">
        <PrintButton />
        <LinkButton href={`/staff/visits/${visitId}`} variant="ghost">
          来店の記録に戻る
        </LinkButton>
      </div>
      <p className="text-sm text-ink-muted print:hidden">
        お客さまにお渡しする控えです。スタッフのメモと問診の詳しい内容は表示していません。
        {visit.proposal && !approved ? '施術案内は、承認するとここに表示されます。' : ''}
      </p>

      <article className="space-y-5 rounded-[var(--radius-card)] border border-line bg-surface p-6 print:border-0 print:p-0">
        <header>
          <p className="text-sm text-ink-muted">{dateFormat.format(new Date(visit.visited_at))}</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold">{visit.customer.full_name} 様　カウンセリングシート</h1>
        </header>

        {c ? (
          <>
            {c.concerns ? <Block title="お悩み">{c.concerns}</Block> : null}
            {c.analysis_summary ? (
              <Block title="肌の見た目の分析（写真からの推定）">
                {c.analysis_summary}
                <p className="mt-2 text-sm text-ink-muted">写真の見た目からの推定で、診断や測定ではありません。</p>
              </Block>
            ) : null}
            {c.customer_wishes ? <Block title="ご希望">{c.customer_wishes}</Block> : null}
            {c.proposal ? <Block title="ご提案">{c.proposal}</Block> : null}
          </>
        ) : (
          <Notice tone="warning" title="カウンセリングシートがまだありません" />
        )}

        {approved ? <Block title="施術のご案内">{approved.final_text}</Block> : null}

        {visit.treatments.length ? (
          <section className="break-inside-avoid border-t border-line pt-4">
            <h2 className="font-serif text-lg font-semibold">本日の施術</h2>
            <table className="mt-2 w-full text-left">
              <tbody className="divide-y divide-line">
                {visit.treatments.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2">{t.menu_name_snapshot}</td>
                    <td className="py-2 text-right tabular-nums">{yen.format(t.price_yen_snapshot)}円</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2">合計（税込）</td>
                  <td className="py-2 text-right tabular-nums">{yen.format(total)}円</td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        {visit.next_visit_memo ? <Block title="次回に向けて">{visit.next_visit_memo}</Block> : null}

        <footer className="border-t border-line pt-4 text-sm text-ink-muted">
          この内容は美容目的のご案内です。医療的な診断や効果を約束するものではありません。肌に気になる症状がある場合は、医師にご相談ください。
        </footer>
      </article>
    </div>
  );
}
