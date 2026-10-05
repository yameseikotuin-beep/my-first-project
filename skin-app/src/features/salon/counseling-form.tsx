'use client';

import { useActionState } from 'react';
import type { CounselingSheetRow } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { TextAreaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export function CounselingForm({
  action,
  sheet,
  defaults,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  sheet: CounselingSheetRow | null;
  /** まだシートがないときに入れておく値（問診・分析から） */
  defaults: { concerns: string; analysisSummary: string; customerWishes: string };
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const v = (key: string, saved: string | undefined, fallback = '') => state.values?.[key] ?? saved ?? fallback;
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      {!sheet ? <Notice>問診と分析の内容を入れてあります。お話を伺いながら書き直してください。</Notice> : null}
      <TextAreaField
        label="お悩み"
        name="concerns"
        maxLength={2000}
        defaultValue={v('concerns', sheet?.concerns, defaults.concerns)}
        error={state.fieldErrors?.concerns}
      />
      <TextAreaField
        label="分析のまとめ"
        name="analysisSummary"
        maxLength={2000}
        hint="写真の見た目の推定です。診断ではありません。"
        defaultValue={v('analysisSummary', sheet?.analysis_summary, defaults.analysisSummary)}
        error={state.fieldErrors?.analysisSummary}
      />
      <TextAreaField
        label="ご提案"
        name="proposal"
        maxLength={2000}
        hint="効果の約束や医療的な表現（例：「必ず」「治る」）は使えません。"
        defaultValue={v('proposal', sheet?.proposal)}
        error={state.fieldErrors?.proposal}
      />
      <TextAreaField
        label="お客さまのご希望"
        name="customerWishes"
        maxLength={2000}
        defaultValue={v('customerWishes', sheet?.customer_wishes, defaults.customerWishes)}
        error={state.fieldErrors?.customerWishes}
      />
      <TextAreaField
        label="スタッフのメモ"
        name="staffNotes"
        maxLength={2000}
        hint="お客さまにお渡しする印刷物には載りません。病名などの健康情報は書かないでください。"
        defaultValue={v('staffNotes', sheet?.staff_notes)}
        error={state.fieldErrors?.staffNotes}
      />
      <SubmitButton pendingLabel="保存中…">保存して来店の記録に戻る</SubmitButton>
    </form>
  );
}
