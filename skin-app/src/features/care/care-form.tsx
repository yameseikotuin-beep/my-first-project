'use client';

import { useActionState } from 'react';
import { saveCareLog } from './actions';
import { CARE_ITEMS } from './schema';
import { initialFormState } from '@/lib/form-state';
import { TextAreaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function CareForm({ today }: { today: string }) {
  const [state, action] = useActionState(saveCareLog, initialFormState);
  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <TextField
        label="日付"
        name="logDate"
        type="date"
        required
        max={today}
        defaultValue={state.values?.logDate ?? today}
        hint="同じ日付の記録がある場合は上書きされます"
        error={state.fieldErrors?.logDate}
      />
      <fieldset>
        <legend className="font-medium">
          行ったケア<span className="ml-2 text-sm text-ink-muted">任意・複数選択</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARE_ITEMS.map((item) => (
            <label key={item} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <input type="checkbox" name="careItems" value={item} className="h-5 w-5 accent-[var(--color-sage-strong)]" />
              <span className="text-[0.95rem]">{item}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        label="使ったもの"
        name="products"
        maxLength={500}
        placeholder="例：いつもの化粧水、新しい日焼け止め"
        defaultValue={state.values?.products}
        error={state.fieldErrors?.products}
      />
      <TextField
        label="睡眠時間（時間）"
        name="sleepHours"
        inputMode="decimal"
        placeholder="例：6.5"
        defaultValue={state.values?.sleepHours}
        error={state.fieldErrors?.sleepHours}
      />
      <TextAreaField
        label="メモ"
        name="note"
        maxLength={1000}
        placeholder="気づいたこと、体調など"
        defaultValue={state.values?.note}
        error={state.fieldErrors?.note}
      />
      <SubmitButton pendingLabel="保存中…">記録する</SubmitButton>
    </form>
  );
}
