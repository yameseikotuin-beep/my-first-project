'use client';

import { useActionState } from 'react';
import { updateDisplayName } from './actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateDisplayName, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <TextField
        label="表示名"
        name="displayName"
        required
        maxLength={50}
        defaultValue={current}
        error={state.fieldErrors?.displayName}
      />
      <SubmitButton variant="secondary">保存する</SubmitButton>
    </form>
  );
}
