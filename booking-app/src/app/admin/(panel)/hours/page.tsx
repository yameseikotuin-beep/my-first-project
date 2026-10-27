import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { AdminDataError } from '@/lib/admin-data';
import {
  addBreak,
  deleteBreak,
  deleteDateOverride,
  saveBusinessHours,
  saveDateOverride,
} from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { formatDate, shortTime, todayJst, WEEKDAY_LABELS } from '@/lib/time';

export const metadata: Metadata = { title: '営業時間・休業日' };

const timeInput = 'block w-full rounded-lg border border-line bg-surface px-2 py-2 text-base';

export default async function HoursPage() {
  await requireAdmin();
  const supabase = await createClient();
  const today = todayJst();
  const [hours, breaks, overrides] = await Promise.all([
    supabase.from('business_hours').select('*').order('weekday'),
    supabase.from('breaks').select('*').order('weekday').order('break_date').order('start_time'),
    supabase.from('business_date_overrides').select('*').gte('business_date', today).order('business_date'),
  ]);
  if (hours.error || breaks.error || overrides.error) throw new AdminDataError('hours failed');
  const byDay = new Map((hours.data ?? []).map((h) => [h.weekday, h]));
  const weeklyBreaks = (breaks.data ?? []).filter((b) => b.weekday !== null);
  const dateBreaks = (breaks.data ?? []).filter((b) => b.break_date !== null && b.break_date >= today);

  return (
    <>
      <PageTitle lead="休業日・受付停止時間には予約が入りません。変更はすぐに予約画面へ反映されます。">営業時間・休業日</PageTitle>

      <section className="mb-10">
        <SectionTitle>曜日ごとの営業時間</SectionTitle>
        <ActionForm action={saveBusinessHours} className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">曜日</th>
                  <th scope="col" className="px-3 py-2">休業</th>
                  <th scope="col" className="px-3 py-2">開始</th>
                  <th scope="col" className="px-3 py-2">終了</th>
                  <th scope="col" className="px-3 py-2">最終受付</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[1, 2, 3, 4, 5, 6, 0].map((w) => {
                  const h = byDay.get(w);
                  return (
                    <tr key={w}>
                      <th scope="row" className="px-3 py-2 text-left">{WEEKDAY_LABELS[w]}曜日</th>
                      <td className="px-3 py-2">
                        <input type="checkbox" name={`closed_${w}`} defaultChecked={h?.is_closed ?? false} aria-label={`${WEEKDAY_LABELS[w]}曜日を休業日にする`} className="h-5 w-5 accent-[var(--color-primary)]" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="time" step={300} name={`open_${w}`} defaultValue={shortTime(h?.open_time)} aria-label={`${WEEKDAY_LABELS[w]}曜日の開始時刻`} className={timeInput} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="time" step={300} name={`close_${w}`} defaultValue={shortTime(h?.close_time)} aria-label={`${WEEKDAY_LABELS[w]}曜日の終了時刻`} className={timeInput} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="time" step={300} name={`last_${w}`} defaultValue={shortTime(h?.last_start_time)} aria-label={`${WEEKDAY_LABELS[w]}曜日の最終受付時刻`} className={timeInput} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-ink-muted">最終受付：この時刻までに始まる予約だけを受け付けます。空欄の場合は、施術が終了時刻までに終わる予約を受け付けます。</p>
          <FormSubmit>営業時間を保存する</FormSubmit>
        </ActionForm>
      </section>

      <section className="mb-10">
        <SectionTitle>受付停止時間（昼休みなど）</SectionTitle>
        <BreakList title="毎週" items={weeklyBreaks.map((b) => ({ ...b, when: `${WEEKDAY_LABELS[b.weekday!]}曜日` }))} />
        <BreakList title="特定の日" items={dateBreaks.map((b) => ({ ...b, when: formatDate(b.break_date!, true) }))} />
        <ActionForm action={addBreak} resetOnSuccess className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-3">
          <SelectField label="繰り返し" name="kind" required defaultValue="weekly">
            <option value="weekly">毎週（曜日を指定）</option>
            <option value="date">特定の日だけ（日付を指定）</option>
          </SelectField>
          <SelectField label="曜日（毎週の場合）" name="weekday" defaultValue="1">
            {WEEKDAY_LABELS.map((w, i) => (
              <option key={i} value={i}>{w}曜日</option>
            ))}
          </SelectField>
          <TextField label="日付（特定の日の場合）" name="breakDate" type="date" min={today} />
          <TextField label="開始" name="startTime" type="time" step={300} required defaultValue="12:00" />
          <TextField label="終了" name="endTime" type="time" step={300} required defaultValue="13:00" />
          <TextField label="名前" name="label" maxLength={40} placeholder="例：昼休み" />
          <div className="sm:col-span-3">
            <FormSubmit size="sm">受付停止時間を追加</FormSubmit>
          </div>
        </ActionForm>
      </section>

      <section>
        <SectionTitle>祝日・臨時休業・特定日の営業時間</SectionTitle>
        <p className="mb-3 text-sm text-ink-muted">ここで設定した日は、曜日ごとの営業時間より優先されます（毎週の受付停止時間は引き続き適用されます）。</p>
        {(overrides.data ?? []).length ? (
          <ul className="mb-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {(overrides.data ?? []).map((o) => (
              <li key={o.business_date} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <span>
                  <strong>{formatDate(o.business_date, true)}</strong>
                  <span className="ml-2">
                    {o.is_closed
                      ? '休業'
                      : `${shortTime(o.open_time)}〜${shortTime(o.close_time)}${o.last_start_time ? `（最終受付 ${shortTime(o.last_start_time)}）` : ''}`}
                  </span>
                  {o.note ? <span className="ml-2 text-sm text-ink-muted">{o.note}</span> : null}
                </span>
                <ActionForm action={deleteDateOverride} className="">
                  <input type="hidden" name="businessDate" value={o.business_date} />
                  <FormSubmit variant="secondary" size="sm">削除</FormSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">今後の特定日の設定はありません。</p>
        )}
        <ActionForm action={saveDateOverride} resetOnSuccess className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
          <TextField label="日付" name="businessDate" type="date" required min={today} />
          <TextField label="メモ" name="note" maxLength={100} placeholder="例：祝日、研修のため" />
          <div className="sm:col-span-2">
            <CheckboxField label="この日は休業する" name="isClosed" defaultChecked />
          </div>
          <TextField label="開始（営業する場合）" name="openTime" type="time" step={300} />
          <TextField label="終了（営業する場合）" name="closeTime" type="time" step={300} />
          <TextField label="最終受付（任意）" name="lastStartTime" type="time" step={300} />
          <div className="sm:col-span-2">
            <FormSubmit size="sm">特定日の設定を保存</FormSubmit>
          </div>
        </ActionForm>
      </section>
    </>
  );
}

function BreakList({ title, items }: { title: string; items: { id: string; when: string; start_time: string; end_time: string; label: string }[] }) {
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-sm font-medium text-ink-muted">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">設定はありません。</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {items.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                {b.when}　{shortTime(b.start_time)}〜{shortTime(b.end_time)}
                {b.label ? <span className="ml-2 text-sm text-ink-muted">{b.label}</span> : null}
              </span>
              <ActionForm action={deleteBreak} className="">
                <input type="hidden" name="id" value={b.id} />
                <FormSubmit variant="secondary" size="sm">削除</FormSubmit>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
