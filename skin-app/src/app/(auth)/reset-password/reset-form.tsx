'use client';

import { useActionState } from 'react';
import { requestPasswordReset } from '../actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function ResetForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  if (state.ok) {
    return (
      <Notice tone="success" live>
        {state.message}
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      <TextField
        label="登録したメールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton className="w-full" pendingLabel="送信中…">
        再設定メールを送る
      </SubmitButton>
    </form>
  );
}
