'use client';

import { useActionState } from 'react';
import { deleteAccount } from './actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      <TextField
        label="パスワード（本人確認のため）"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <TextField
        label="確認のため「退会する」と入力してください"
        name="confirmText"
        required
        autoComplete="off"
        error={state.fieldErrors?.confirmText}
      />
      <SubmitButton variant="danger" pendingLabel="削除しています…">
        退会して、すべてのデータを削除する
      </SubmitButton>
    </form>
  );
}
