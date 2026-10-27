import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { listServices } from '@/lib/admin-data';
import { ResourceForm, WeeklyRanges } from '@/features/admin/resource-parts';
import { addDayOff, deleteDayOff, deletePractitioner, savePractitioner, savePractitionerServices } from '@/features/admin/settings-actions';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { CheckboxField, TextField } from '@/components/ui/field';
import { PageTitle, SectionTitle } from '@/components/ui/card';
import { formatDate, todayJst } from '@/lib/time';
import { uuidSchema } from '@/lib/validation/schemas';

export const metadata: Metadata = { title: '施術者の編集' };

export default async function EditPractitionerPage({ params }: PageProps<'/admin/practitioners/[id]'>) {
  await requireAdmin();
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: links }, { data: shifts }, { data: daysOff }, services] = await Promise.all([
    supabase.from('practitioners').select('*').eq('id', id).maybeSingle(),
    supabase.from('practitioner_services').select('*').eq('practitioner_id', id),
    supabase.from('practitioner_shifts').select('*').eq('practitioner_id', id),
    supabase.from('practitioner_days_off').select('*').eq('practitioner_id', id).gte('off_date', todayJst()).order('off_date'),
    listServices(),
  ]);
  if (!p) notFound();
  const linked = new Set((links ?? []).map((l) => l.service_id));
  return (
    <>
      <PageTitle>施術者の編集</PageTitle>
      <ResourceForm
        action={savePractitioner}
        row={p}
        nameLabel="施術者名"
        activeLabel="利用可能"
        activeHint="オフにすると、この施術者には新しい予約が割り当てられません。"
        submitLabel="保存する"
      />

      <section className="mt-8">
        <SectionTitle>対応できるメニュー</SectionTitle>
        <ActionForm action={savePractitionerServices} className="space-y-3 rounded-xl border border-line bg-surface p-4">
          <input type="hidden" name="id" value={p.id} />
          <p className="text-sm text-ink-muted">何も選ばない場合は、すべてのメニューに対応できるものとして扱います。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <CheckboxField key={s.id} label={s.name} name="serviceIds" value={s.id} defaultChecked={linked.has(s.id)} />
            ))}
          </div>
          <FormSubmit size="sm">保存する</FormSubmit>
        </ActionForm>
      </section>

      <section className="mt-8">
        <SectionTitle>出勤時間</SectionTitle>
        <WeeklyRanges kind="practitioner" ownerId={p.id} ranges={shifts ?? []} emptyText="設定がないため、営業時間中はいつでも対応できます。設定すると、その曜日・時間帯だけ予約を割り当てます。" />
      </section>

      <section className="mt-8">
        <SectionTitle>休み</SectionTitle>
        {(daysOff ?? []).length ? (
          <ul className="mb-3 divide-y divide-line rounded-xl border border-line bg-surface">
            {(daysOff ?? []).map((d) => (
              <li key={d.off_date} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {formatDate(d.off_date, true)}
                  {d.note ? <span className="ml-2 text-sm text-ink-muted">{d.note}</span> : null}
                </span>
                <ActionForm action={deleteDayOff} className="">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="offDate" value={d.off_date} />
                  <FormSubmit variant="secondary" size="sm">削除</FormSubmit>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-ink-muted">今後の休みは登録されていません。</p>
        )}
        <ActionForm action={addDayOff} resetOnSuccess className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="id" value={p.id} />
          <TextField label="日付" name="offDate" type="date" required min={todayJst()} />
          <TextField label="メモ" name="note" maxLength={100} />
          <FormSubmit size="sm">休みを追加</FormSubmit>
        </ActionForm>
      </section>

      <section className="mt-8">
        <SectionTitle>施術者の削除</SectionTitle>
        <p className="mb-3 text-sm text-ink-muted">予約を担当した施術者は削除できません。「利用可能」をオフにしてください。</p>
        <ActionForm action={deletePractitioner} confirmMessage={`「${p.name}」を削除しますか？`}>
          <input type="hidden" name="id" value={p.id} />
          <FormSubmit variant="danger" size="sm">削除する</FormSubmit>
        </ActionForm>
      </section>
    </>
  );
}
