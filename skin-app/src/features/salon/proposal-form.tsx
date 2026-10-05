'use client';

import { useActionState } from 'react';
import type { CareProposalRow } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { TextAreaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

/** 案内文の確認・編集・承認 */
export function ProposalForm({
  action,
  proposal,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  proposal: CareProposalRow | null;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const approved = proposal?.status === 'approved';
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      {proposal?.menu_ids.map((id) => <input key={id} type="hidden" name="menuIds" value={id} />)}
      {approved ? (
        <>
          <Notice tone="success" title="承認済み">
            {proposal.approved_at ? `${dateFormat.format(new Date(proposal.approved_at))} に承認しました。` : null}
            お客さまにお見せできます。直す場合は承認を取り消してください。
          </Notice>
          <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface-muted p-4 leading-relaxed">{proposal.final_text}</div>
          <SubmitButton name="intent" value="reopen" variant="secondary" pendingLabel="処理中…">
            承認を取り消して編集する
          </SubmitButton>
        </>
      ) : (
        <>
          <TextAreaField
            label="案内文"
            name="finalText"
            maxLength={4000}
            rows={14}
            hint="内容を確認し、必要に応じて直してから承認してください。効果の約束や医療的な表現（例：「必ず」「治る」）は使えません。"
            defaultValue={state.values?.finalText ?? proposal?.final_text ?? ''}
            error={state.fieldErrors?.finalText}
          />
          <div className="flex flex-wrap gap-3">
            <SubmitButton name="intent" value="approve" pendingLabel="保存中…">
              確認して承認する
            </SubmitButton>
            <SubmitButton name="intent" value="save" variant="secondary" pendingLabel="保存中…">
              下書きとして保存
            </SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
