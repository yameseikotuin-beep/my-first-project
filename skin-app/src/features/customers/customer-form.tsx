'use client';

import { useActionState } from 'react';
import type { CustomerRow } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { TextAreaField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  customer?: CustomerRow;
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
        <TextField
          label="氏名"
          name="fullName"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={v('fullName', customer?.full_name)}
          error={state.fieldErrors?.fullName}
        />
        <TextField
          label="ふりがな"
          name="fullNameKana"
          maxLength={100}
          autoComplete="off"
          defaultValue={v('fullNameKana', customer?.full_name_kana)}
          error={state.fieldErrors?.fullNameKana}
        />
        <TextField
          label="電話番号"
          name="phone"
          type="tel"
          inputMode="tel"
          maxLength={30}
          autoComplete="off"
          defaultValue={v('phone', customer?.phone)}
          error={state.fieldErrors?.phone}
        />
        <TextField
          label="メールアドレス"
          name="email"
          type="email"
          inputMode="email"
          maxLength={254}
          autoComplete="off"
          defaultValue={v('email', customer?.email)}
          error={state.fieldErrors?.email}
        />
        <TextField
          label="生まれ年（西暦）"
          name="birthYear"
          inputMode="numeric"
          maxLength={4}
          placeholder="例：1990"
          hint="生年月日は保存しません"
          defaultValue={v('birthYear', customer?.birth_year)}
          error={state.fieldErrors?.birthYear}
        />
      </div>
      <TextAreaField
        label="メモ"
        name="notes"
        maxLength={2000}
        hint="病歴などの詳しい健康情報は書かないでください"
        defaultValue={v('notes', customer?.notes)}
        error={state.fieldErrors?.notes}
      />
      <SubmitButton pendingLabel="保存中…">{submitLabel}</SubmitButton>
    </form>
  );
}
