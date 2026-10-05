'use client';

import { useActionState } from 'react';
import { initialFormState, type FormState } from '@/lib/form-state';
import { TextAreaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';
import { INTAKE_CONCERNS, SKIN_FEELS, YES_NO, type IntakeAnswers } from './schema';

const tile =
  'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-3 transition-colors active:bg-sage-soft has-[:checked]:border-sage has-[:checked]:bg-sage-soft';

function Choices({
  legend,
  name,
  options,
  defaultValue,
  error,
  hint,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  defaultValue?: string;
  error?: string[];
  hint?: string;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="font-medium">
        {legend}
        <span className="ml-2 text-sm text-danger">必須</span>
      </legend>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <label key={o} className={tile}>
            <input type="radio" name={name} value={o} defaultChecked={defaultValue === o} className="h-5 w-5 accent-[var(--color-sage-strong)]" />
            <span className="text-[0.95rem]">{o}</span>
          </label>
        ))}
      </div>
      {error?.length ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-danger">
          {error.join(' ')}
        </p>
      ) : null}
    </fieldset>
  );
}

export function IntakeForm({
  action,
  answers,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  answers: IntakeAnswers | null;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const pick = (key: keyof IntakeAnswers) => state.values?.[key] ?? (answers?.[key] as string | undefined);
  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <Notice>病名・治療の内容・薬の名前は記録しません。施術の前に確認が必要なことだけをお伺いします。</Notice>

      <fieldset>
        <legend className="font-medium">
          気になること<span className="ml-2 text-sm text-ink-muted">任意・複数選択</span>
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INTAKE_CONCERNS.map((c) => (
            <label key={c} className={tile}>
              <input
                type="checkbox"
                name="concerns"
                value={c}
                defaultChecked={answers?.concerns.includes(c)}
                className="h-5 w-5 accent-[var(--color-sage-strong)]"
              />
              <span className="text-[0.95rem]">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Choices legend="ふだんの肌の感じ方" name="skinFeel" options={SKIN_FEELS} defaultValue={pick('skinFeel')} error={state.fieldErrors?.skinFeel} />
      <Choices
        legend="化粧品などで、肌に合わなかったことがありますか"
        name="productTrouble"
        options={YES_NO}
        defaultValue={pick('productTrouble')}
        error={state.fieldErrors?.productTrouble}
      />
      <Choices
        legend="この2週間に、強い日焼け・ピーリング・脱毛などをしましたか"
        name="recentProcedures"
        options={YES_NO}
        defaultValue={pick('recentProcedures')}
        error={state.fieldErrors?.recentProcedures}
      />
      <Choices
        legend="皮膚のことで、いま通院・治療中ですか"
        name="underTreatment"
        options={['はい', 'いいえ']}
        hint="「はい」の場合は、施術の前にかかりつけの医師に確認していただくようご案内します。"
        defaultValue={pick('underTreatment')}
        error={state.fieldErrors?.underTreatment}
      />

      <TextAreaField
        label="ご希望"
        name="wishes"
        maxLength={500}
        placeholder="例：乾燥が気になるので、しっとりした仕上がりにしたい"
        defaultValue={pick('wishes')}
        error={state.fieldErrors?.wishes}
      />
      <TextAreaField
        label="施術で気をつけてほしいこと"
        name="notes"
        maxLength={500}
        placeholder="例：香りが強いものは苦手"
        hint="病名や治療の内容は書かないでください"
        defaultValue={pick('notes')}
        error={state.fieldErrors?.notes}
      />
      <SubmitButton pendingLabel="保存中…">保存して来店の記録に戻る</SubmitButton>
    </form>
  );
}
