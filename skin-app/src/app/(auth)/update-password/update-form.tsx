'use client';

import { useActionState } from 'react';
import { updatePassword } from '../actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      <TextField
        label="新しいパスワード"
        name="password"
        type="password"
        autoComplete="new-password"
        hint="10文字以上"
        required
        error={state.fieldErrors?.password}
      />
      <TextField
        label="新しいパスワード（確認）"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <SubmitButton className="w-full" pendingLabel="保存中…">
        パスワードを設定する
      </SubmitButton>
    </form>
  );
}
