'use client';

import { useActionState } from 'react';
import { login } from '../actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      <input type="hidden" name="next" value={state.values?.next ?? next ?? ''} />
      <TextField
        label="メールアドレス"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <TextField
        label="パスワード"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton className="w-full" pendingLabel="ログイン中…">
        ログイン
      </SubmitButton>
    </form>
  );
}
