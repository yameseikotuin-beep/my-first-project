'use client';

import { useActionState } from 'react';
import { inviteMember } from './actions';
import { initialFormState } from '@/lib/form-state';
import { SelectField, TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function InviteForm() {
  const [state, action] = useActionState(inviteMember, initialFormState);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <TextField
          label="メールアドレス"
          name="email"
          type="email"
          required
          autoComplete="off"
          defaultValue={state.ok ? '' : state.values?.email}
          error={state.fieldErrors?.email}
        />
        <TextField
          label="表示名"
          name="displayName"
          required
          maxLength={50}
          autoComplete="off"
          defaultValue={state.ok ? '' : state.values?.displayName}
          error={state.fieldErrors?.displayName}
        />
        <SelectField
          label="役割"
          name="role"
          required
          defaultValue={state.values?.role ?? 'staff'}
          error={state.fieldErrors?.role}
        >
          <option value="staff">サロンスタッフ</option>
          <option value="admin">管理者</option>
        </SelectField>
      </div>
      <SubmitButton pendingLabel="送信中…">招待メールを送る</SubmitButton>
    </form>
  );
}
