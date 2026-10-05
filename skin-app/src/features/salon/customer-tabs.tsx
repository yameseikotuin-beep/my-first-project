import Link from 'next/link';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSubmit } from '@/components/ui/confirm-submit';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import type { DeviceMeasurementRow } from '@/lib/supabase/database.types';
import type { VisitSummary } from '@/lib/salon';
import { addMeasurement, deleteMeasurement, startVisit } from './actions';
import { MeasurementForm } from './measurement-form';
import { nowTokyoLocal } from './schema';

const dateTime = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

/** 顧客の画面「来店・施術」タブ */
export function VisitsTab({ customerId, visits, error }: { customerId: string; visits: VisitSummary[]; error?: boolean }) {
  const open = visits.find((v) => v.status === 'in_progress');
  return (
    <div className="space-y-4">
      {error ? (
        <Notice tone="danger" live>
          来店を記録できませんでした。もう一度お試しください。
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <form action={startVisit.bind(null, customerId)}>
          <SubmitButton pendingLabel="準備中…">来店を記録する</SubmitButton>
        </form>
        {open ? (
          <LinkButton href={`/staff/visits/${open.id}`} variant="secondary">
            記入中の来店を開く
          </LinkButton>
        ) : null}
        <LinkButton href={`/staff/customers/${customerId}/compare`} variant="secondary">
          施術前後を比べる
        </LinkButton>
      </div>
      {visits.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">
          まだ来店の記録がありません。「来店を記録する」から、問診・撮影・カウンセリング・施術の順に記録できます。
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/staff/visits/${v.id}`} className="block px-4 py-3 hover:bg-surface-muted active:bg-sage-soft">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{dateTime.format(new Date(v.visited_at))}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm ${
                      v.status === 'completed' ? 'bg-sage-soft text-sage-strong' : 'bg-warning-soft text-warning'
                    }`}
                  >
                    {v.status === 'completed' ? '完了' : '記入中'}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-ink-muted">
                  {v.menuNames.length ? v.menuNames.join('、') : '施術の記録なし'}
                  {v.staffName ? `　担当：${v.staffName}` : ''}
                </span>
                {v.next_visit_memo ? <span className="mt-1 block text-sm">次回：{v.next_visit_memo}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 顧客の画面「実測値」タブ（測定機器で測った値。AI の推定とは別） */
export function MeasurementsTab({
  customerId,
  measurements,
  visits,
  myId,
  isAdmin,
}: {
  customerId: string;
  measurements: DeviceMeasurementRow[];
  visits: VisitSummary[];
  myId: string;
  isAdmin: boolean;
}) {
  const metrics = [...new Set(measurements.map((m) => m.metric))];
  return (
    <div className="space-y-4">
      <Notice title="測定機器で測った値です">
        ここには、サロンの測定機器で実際に測った値だけを記録します。写真からの AI の推定（分析）とは別のもので、同じ表には並べません。
      </Notice>
      {metrics.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-muted">まだ実測値の記録がありません。</p>
      ) : (
        metrics.map((metric) => (
          <Card key={metric}>
            <h2 className="font-serif text-lg font-semibold">{metric}</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-[0.95rem]">
                <caption className="sr-only">{metric}の実測値（新しい順）</caption>
                <thead className="text-sm text-ink-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">測定日時</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">値</th>
                    <th scope="col" className="py-2 pr-3 font-medium">機器</th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {measurements
                    .filter((m) => m.metric === metric)
                    .map((m) => (
                      <tr key={m.id}>
                        <td className="py-2 pr-3">{dateTime.format(new Date(m.measured_at))}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {Number(m.value)}
                          {m.unit ? <span className="ml-1 text-ink-muted">{m.unit}</span> : null}
                        </td>
                        <td className="py-2 pr-3">{m.device_name}</td>
                        <td className="py-2 text-right">
                          {isAdmin || m.recorded_by === myId ? (
                            <form action={deleteMeasurement.bind(null, customerId)}>
                              <input type="hidden" name="id" value={m.id} />
                              <ConfirmSubmit confirmMessage="この実測値を削除します。よろしいですか？">削除</ConfirmSubmit>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))
      )}
      <Card>
        <h2 className="mb-4 font-serif text-lg font-semibold">実測値を記録する</h2>
        <MeasurementForm
          action={addMeasurement.bind(null, customerId)}
          now={nowTokyoLocal()}
          visits={visits.slice(0, 10).map((v) => ({ id: v.id, label: `${dateTime.format(new Date(v.visited_at))} の来店` }))}
        />
      </Card>
    </div>
  );
}
