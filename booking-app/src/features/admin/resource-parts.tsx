import Link from 'next/link';
import { ActionForm, FormSubmit } from '@/components/ui/action-form';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { addWeeklyRange, deleteWeeklyRange } from './settings-actions';
import { shortTime, WEEKDAY_LABELS } from '@/lib/time';
import type { FormState } from '@/lib/form-state';
import type { RoomRow } from '@/lib/supabase/database.types';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** 施術スペース・施術者の名前・表示順・利用可否のフォーム */
export function ResourceForm({ action, row, nameLabel, activeLabel, activeHint, submitLabel, resetOnSuccess }: {
  action: Action;
  row?: RoomRow;
  nameLabel: string;
  activeLabel: string;
  activeHint?: string;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  return (
    <ActionForm action={action} resetOnSuccess={resetOnSuccess} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <TextField label={nameLabel} name="name" required maxLength={40} defaultValue={row?.name} />
        <TextField label="表示順" name="sortOrder" type="number" inputMode="numeric" defaultValue={row?.sort_order ?? 0} />
      </div>
      <CheckboxField label={activeLabel} name="isActive" defaultChecked={row?.is_active ?? true} hint={activeHint} />
      <FormSubmit size="sm">{submitLabel}</FormSubmit>
    </ActionForm>
  );
}

/** 曜日ごとの時間帯の一覧と追加フォーム */
export function WeeklyRanges({ kind, ownerId, ranges, emptyText }: {
  kind: 'room' | 'practitioner';
  ownerId: string;
  ranges: { id: string; weekday: number; start_time: string; end_time: string }[];
  emptyText: string;
}) {
  const sorted = [...ranges].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span>
                {WEEKDAY_LABELS[r.weekday]}曜日　{shortTime(r.start_time)}〜{shortTime(r.end_time)}
              </span>
              <ActionForm action={deleteWeeklyRange} className="">
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={r.id} />
                <FormSubmit variant="secondary" size="sm">削除</FormSubmit>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={addWeeklyRange} className="grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="ownerId" value={ownerId} />
        <SelectField label="曜日" name="weekday" required defaultValue="1">
          {WEEKDAY_LABELS.map((w, i) => (
            <option key={i} value={i}>{w}曜日</option>
          ))}
        </SelectField>
        <TextField label="開始" name="startTime" type="time" step={300} required defaultValue="09:00" />
        <TextField label="終了" name="endTime" type="time" step={300} required defaultValue="18:00" />
        <FormSubmit size="sm">追加</FormSubmit>
      </ActionForm>
    </div>
  );
}

export function ResourceList({ rows, base, emptyText }: { rows: RoomRow[]; base: string; emptyText: string }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`${base}/${r.id}`} className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-surface-muted">
            <span className="font-medium">{r.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${r.is_active ? 'bg-primary-soft text-primary-strong' : 'bg-surface-muted text-ink-muted'}`}>
              {r.is_active ? '利用可能' : '利用停止'}
            </span>
          </Link>
        </li>
      ))}
      {rows.length === 0 ? <li className="px-4 py-6 text-center text-ink-muted">{emptyText}</li> : null}
    </ul>
  );
}
