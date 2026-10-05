'use client';

import { useActionState } from 'react';
import { initialFormState, type FormState } from '@/lib/form-state';
import { SelectField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function MeasurementForm({
  action,
  now,
  visits,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** 日本時間の現在時刻（datetime-local の形式） */
  now: string;
  visits: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: string, fallback = '') => state.values?.[key] ?? fallback;
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="測定機器"
          name="deviceName"
          required
          maxLength={100}
          placeholder="例：肌水分計 ○○"
          defaultValue={v('deviceName')}
          error={state.fieldErrors?.deviceName}
        />
        <TextField
          label="測定日時"
          name="measuredAt"
          type="datetime-local"
          required
          max={now}
          defaultValue={v('measuredAt', now)}
          error={state.fieldErrors?.measuredAt}
        />
        <TextField
          label="項目"
          name="metric"
          required
          maxLength={50}
          placeholder="例：水分（ほお）"
          defaultValue={v('metric')}
          error={state.fieldErrors?.metric}
        />
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <TextField
            label="値"
            name="value"
            required
            inputMode="decimal"
            placeholder="例：42.5"
            defaultValue={v('value')}
            error={state.fieldErrors?.value}
          />
          <TextField label="単位" name="unit" maxLength={20} placeholder="例：%" defaultValue={v('unit')} error={state.fieldErrors?.unit} />
        </div>
      </div>
      {visits.length ? (
        <SelectField label="来店" name="visitId" defaultValue={v('visitId')} hint="来店時に測った場合は選んでください">
          <option value="">選ばない</option>
          {visits.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </SelectField>
      ) : null}
      <SubmitButton pendingLabel="記録中…">実測値を記録する</SubmitButton>
    </form>
  );
}
