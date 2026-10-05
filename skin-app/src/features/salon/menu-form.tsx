'use client';

import { useActionState } from 'react';
import type { TreatmentMenuRow } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function MenuForm({
  action,
  menu,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  menu?: TreatmentMenuRow;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: string, fallback: string | number | null | undefined) => state.values?.[key] ?? fallback ?? '';
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="メニュー名" name="name" required maxLength={100} defaultValue={v('name', menu?.name)} error={state.fieldErrors?.name} />
        <TextField
          label="分類"
          name="category"
          maxLength={50}
          placeholder="例：フェイシャル"
          defaultValue={v('category', menu?.category)}
          error={state.fieldErrors?.category}
        />
        <TextField
          label="料金（円・税込）"
          name="priceYen"
          required
          inputMode="numeric"
          placeholder="例：8800"
          defaultValue={v('priceYen', menu?.price_yen)}
          error={state.fieldErrors?.priceYen}
        />
        <TextField
          label="所要時間（分）"
          name="durationMin"
          inputMode="numeric"
          placeholder="例：60"
          defaultValue={v('durationMin', menu?.duration_min)}
          error={state.fieldErrors?.durationMin}
        />
      </div>
      <TextAreaField
        label="説明"
        name="description"
        maxLength={2000}
        hint="施術案内にそのまま使われます。「必ず」「治る」など、効果の約束や医療的な表現は使えません。"
        defaultValue={v('description', menu?.description)}
        error={state.fieldErrors?.description}
      />
      <TextAreaField
        label="注意事項"
        name="cautions"
        maxLength={2000}
        hint="受けられない方・施術後の注意・必要な資格など"
        defaultValue={v('cautions', menu?.cautions)}
        error={state.fieldErrors?.cautions}
      />
      <SelectField label="状態" name="isActive" required defaultValue={v('isActive', menu ? String(menu.is_active) : 'true')}>
        <option value="true">提供中（スタッフに表示する）</option>
        <option value="false">休止中（スタッフに表示しない）</option>
      </SelectField>
      <SubmitButton pendingLabel="保存中…">{submitLabel}</SubmitButton>
    </form>
  );
}
