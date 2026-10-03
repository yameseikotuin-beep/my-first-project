'use client';

import { useActionState } from 'react';
import type { ConsentDocumentRow, ConsentKind } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

const labels: Record<ConsentKind, { title: string; required: boolean; note: string }> = {
  photo_capture: { title: '顔写真の撮影', required: true, note: '撮影機能を使うために必要です' },
  photo_storage: { title: '顔写真の保存', required: true, note: '撮影機能を使うために必要です' },
  ai_processing: {
    title: 'AIサービスへの写真の送信',
    required: false,
    note: '任意です。AIによる説明文の機能（今後追加予定）で使います',
  },
};

type Props = {
  documents: Partial<Record<ConsentKind, ConsentDocumentRow>>;
  alreadyGranted: Partial<Record<ConsentKind, boolean>>;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  mode: 'self' | 'salon';
  returnTo?: string;
};

export function ConsentForm({ documents, alreadyGranted, action, mode, returnTo }: Props) {
  const [state, formAction] = useActionState(action, initialFormState);
  const kinds = (Object.keys(labels) as ConsentKind[]).filter((k) => documents[k]);

  return (
    <form action={formAction} className="space-y-6">
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      {returnTo ? <input type="hidden" name="return" value={returnTo} /> : null}
      {kinds.map((kind) => {
        const doc = documents[kind]!;
        const granted = alreadyGranted[kind];
        return (
          <fieldset key={kind} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            <legend className="px-1 font-serif text-lg font-semibold">{labels[kind].title}</legend>
            <p className="text-sm text-ink-muted">
              {labels[kind].note}（文面の版：{doc.version}）
            </p>
            <div
              className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface-muted p-4 text-[0.95rem]"
              tabIndex={0}
              aria-label={`${labels[kind].title}の説明`}
            >
              {doc.body}
            </div>
            <input type="hidden" name={`doc_${kind}`} value={doc.id} />
            {granted ? (
              <p className="mt-3 font-medium text-sage-strong">✓ 同意済みです</p>
            ) : (
              <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name={`consent_${kind}`}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-sage-strong)]"
                />
                <span>
                  {mode === 'salon' ? 'お客さまが内容を確認し、同意しました' : '内容を確認し、同意します'}
                </span>
              </label>
            )}
          </fieldset>
        );
      })}
      {mode === 'salon' ? (
        <div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 font-medium">
            <input
              type="checkbox"
              name="confirmedByCustomer"
              className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-sage-strong)]"
              aria-describedby={state.fieldErrors?.confirmedByCustomer ? 'confirmedByCustomer-error' : undefined}
            />
            <span>お客さまご本人がこの画面で内容を読み、同意の操作をしました</span>
          </label>
          {state.fieldErrors?.confirmedByCustomer ? (
            <p id="confirmedByCustomer-error" className="text-sm text-danger">
              {state.fieldErrors.confirmedByCustomer.join(' ')}
            </p>
          ) : null}
        </div>
      ) : null}
      <SubmitButton className="w-full sm:w-auto" pendingLabel="保存中…">
        同意内容を保存する
      </SubmitButton>
    </form>
  );
}
