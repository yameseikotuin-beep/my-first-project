'use client';

import { useActionState } from 'react';
import { grantAssignment } from './actions';
import { initialFormState } from '@/lib/form-state';
import { SelectField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function AssignmentForm({
  staff,
  customers,
}: {
  staff: { id: string; name: string }[];
  customers: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(grantAssignment, initialFormState);
  return (
    <form action={action} className="space-y-4">
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField label="スタッフ" name="staffId" required defaultValue="" error={state.fieldErrors?.staffId}>
          <option value="" disabled>
            選んでください
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="顧客" name="customerId" required defaultValue="" error={state.fieldErrors?.customerId}>
          <option value="" disabled>
            選んでください
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
      <SubmitButton pendingLabel="割り当て中…">担当に割り当てる</SubmitButton>
    </form>
  );
}
