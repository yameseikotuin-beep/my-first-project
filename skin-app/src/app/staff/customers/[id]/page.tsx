import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canCapture, getActiveConsents } from '@/lib/consent';
import { loadSessionsWithPhotos } from '@/lib/photos';
import { uuidSchema } from '@/lib/validation/schemas';
import { CustomerForm } from '@/features/customers/customer-form';
import { updateCustomer } from '@/features/customers/actions';
import { ConsentStatus } from '@/features/consent/consent-status';
import { SessionGallery } from '@/features/photos/session-gallery';
import { AnalysisList } from '@/features/analysis/analysis-list';
import { listAnalyses } from '@/lib/analyses';
import { listVisits, type VisitSummary } from '@/lib/salon';
import { MeasurementsTab, VisitsTab } from '@/features/salon/customer-tabs';
import { startVisit } from '@/features/salon/actions';
import { SubmitButton } from '@/components/ui/submit-button';

export const metadata: Metadata = { title: '顧客の詳細' };

const visitDate = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' });

function LatestVisit({ customerId, visit }: { customerId: string; visit?: VisitSummary }) {
  return (
    <Card>
      <h2 className="font-serif text-lg font-semibold">最近の来店</h2>
      {visit ? (
        <div className="mt-2 space-y-1">
          <p>
            <Link href={`/staff/visits/${visit.id}`} className="underline-offset-4 hover:underline active:opacity-75">
              {visitDate.format(new Date(visit.visited_at))}
            </Link>
            <span className="ml-2 text-ink-muted">{visit.menuNames.join('、') || '施術の記録なし'}</span>
          </p>
          {visit.next_visit_memo ? <p className="whitespace-pre-wrap">次回来店メモ：{visit.next_visit_memo}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-ink-muted">まだ来店の記録がありません。</p>
      )}
      <LinkButton href={`/staff/customers/${customerId}?tab=visits`} variant="ghost" className="mt-2 px-0">
        来店・施術の一覧へ
      </LinkButton>
    </Card>
  );
}

const tabs = [
  { key: 'overview', label: '概要' },
  { key: 'visits', label: '来店・施術' },
  { key: 'photos', label: '写真' },
  { key: 'analyses', label: '分析' },
  { key: 'measurements', label: '実測値' },
  { key: 'consents', label: '同意' },
] as const;
type TabKey = (typeof tabs)[number]['key'];

export default async function CustomerDetailPage({ params, searchParams }: PageProps<'/staff/customers/[id]'>) {
  const user = await requireRole(['staff', 'admin']);
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const tab: TabKey = tabs.some((t) => t.key === sp.tab) ? (sp.tab as TabKey) : 'overview';

  const supabase = await createClient();
  // RLS により、担当でない顧客は見つからない（存在するかどうかも分からない）
  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (!customer) notFound();

  const active = await getActiveConsents(supabase, { customerId: id });
  const ready = canCapture(active);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle lead={customer.full_name_kana || undefined}>{customer.full_name} 様</PageTitle>
        <div className="flex flex-wrap gap-2">
          <form action={startVisit.bind(null, id)}>
            <SubmitButton pendingLabel="準備中…">来店を記録する</SubmitButton>
          </form>
          {ready ? (
            <LinkButton href={`/staff/customers/${id}/capture`} variant="secondary">
              撮影する
            </LinkButton>
          ) : (
            <LinkButton href={`/staff/customers/${id}/consent`} variant="secondary">
              同意を取得する
            </LinkButton>
          )}
        </div>
      </div>

      {sp.saved === 'created' ? (
        <Notice tone="success" live>
          顧客を登録しました。撮影の前に、お客さまから同意を取得してください。
        </Notice>
      ) : null}
      {sp.saved === 'consent' ? (
        <Notice tone="success" live>
          同意を記録しました。
        </Notice>
      ) : null}

      <nav aria-label="顧客情報の切り替え" className="overflow-x-auto border-b border-line">
        <ul className="flex gap-1">
          {tabs.map((t) => (
            <li key={t.key} className="shrink-0">
              <Link
                href={`/staff/customers/${id}${t.key === 'overview' ? '' : `?tab=${t.key}`}`}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`flex min-h-11 items-center border-b-2 px-4 transition-colors active:bg-sage-soft ${
                  tab === t.key ? 'border-sage-strong font-bold text-sage-strong' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === 'overview' ? <LatestVisit customerId={id} visit={(await listVisits(supabase, id, 1))[0]} /> : null}

      {tab === 'overview' ? (
        <Card>
          <h2 className="mb-4 font-serif text-lg font-semibold">基本情報</h2>
          <CustomerForm action={updateCustomer.bind(null, id)} customer={customer} submitLabel="保存する" />
        </Card>
      ) : null}

      {tab === 'photos' ? (
        <SessionGallery
          sessions={await loadSessionsWithPhotos(supabase, { customerId: id }, 30)}
          customerId={id}
          canDeleteSession={user.profile.role === 'admin'}
          analyzeHrefBase={`/staff/customers/${id}/analyses/new?session=`}
        />
      ) : null}

      {tab === 'analyses' ? (
        <AnalysisList
          analyses={await listAnalyses(supabase, { customerId: id })}
          hrefFor={(aid) => `/staff/customers/${id}/analyses/${aid}`}
        />
      ) : null}

      {tab === 'consents' ? (
        <Card>
          <h2 className="font-serif text-lg font-semibold">同意の状況</h2>
          <ConsentStatus active={active} customerId={id} />
          <LinkButton href={`/staff/customers/${id}/consent`} variant="secondary" className="mt-4">
            同意を取得する
          </LinkButton>
        </Card>
      ) : null}

      {tab === 'visits' ? (
        <VisitsTab customerId={id} visits={await listVisits(supabase, id)} error={sp.error === 'visit'} />
      ) : null}

      {tab === 'measurements' ? (
        <MeasurementsTab
          customerId={id}
          measurements={
            (
              await supabase
                .from('device_measurements')
                .select('*')
                .eq('customer_id', id)
                .order('measured_at', { ascending: false })
                .limit(200)
            ).data ?? []
          }
          visits={await listVisits(supabase, id, 10)}
          myId={user.id}
          isAdmin={user.profile.role === 'admin'}
        />
      ) : null}
    </div>
  );
}
