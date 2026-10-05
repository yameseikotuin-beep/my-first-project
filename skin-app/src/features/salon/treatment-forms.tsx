'use client';

import { useActionState } from 'react';
import type { TreatmentMenuRow } from '@/lib/supabase/database.types';
import { initialFormState, type FormState } from '@/lib/form-state';
import { SelectField, TextAreaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

export type SessionOption = { id: string; label: string };

const yen = new Intl.NumberFormat('ja-JP');

export function SessionSelect({
  label,
  name,
  sessions,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  sessions: SessionOption[];
  defaultValue?: string | null;
  hint?: string;
}) {
  return (
    <SelectField label={label} name={name} defaultValue={defaultValue ?? ''} hint={hint}>
      <option value="">選ばない</option>
      {sessions.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </SelectField>
  );
}

export function TreatmentForm({
  action,
  menus,
  sessions,
  defaultBefore,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  menus: TreatmentMenuRow[];
  sessions: SessionOption[];
  defaultBefore?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <SelectField label="メニュー" name="menuId" required defaultValue="" error={state.fieldErrors?.menuId}>
        <option value="" disabled>
          選んでください
        </option>
        {menus.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}（{yen.format(m.price_yen)}円）
          </option>
        ))}
      </SelectField>
      <div className="grid gap-5 sm:grid-cols-2">
        <SessionSelect label="施術前の撮影" name="beforeSessionId" sessions={sessions} defaultValue={defaultBefore} />
        <SessionSelect label="施術後の撮影" name="afterSessionId" sessions={sessions} hint="施術後に撮影してから選べます" />
      </div>
      <TextAreaField
        label="メモ"
        name="notes"
        maxLength={2000}
        placeholder="使った化粧品、お客さまの様子など"
        defaultValue={state.values?.notes}
        error={state.fieldErrors?.notes}
      />
      <SubmitButton pendingLabel="記録中…">施術を記録する</SubmitButton>
    </form>
  );
}

export function NextVisitForm({
  action,
  memo,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  memo: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {state.message}
        </Notice>
      ) : null}
      <TextAreaField
        label="次回来店メモ"
        name="nextVisitMemo"
        maxLength={1000}
        placeholder="例：次回は保湿中心のメニューを相談。3週間後を目安に。"
        hint="ダッシュボードと顧客の画面に表示されます"
        defaultValue={state.values?.nextVisitMemo ?? memo}
        error={state.fieldErrors?.nextVisitMemo}
      />
      <SubmitButton variant="secondary" pendingLabel="保存中…">
        メモを保存する
      </SubmitButton>
    </form>
  );
}
