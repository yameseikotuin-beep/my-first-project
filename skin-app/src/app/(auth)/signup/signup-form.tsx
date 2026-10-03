'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signup } from '../actions';
import { initialFormState } from '@/lib/form-state';
import { TextField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { Notice } from '@/components/ui/notice';

function Checkbox({ name, children, error }: { name: string; children: React.ReactNode; error?: string[] }) {
  return (
    <div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={name}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-sage-strong)]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${name}-error`} className="text-sm text-danger">
          {error.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signup, initialFormState);
  if (state.ok) {
    return (
      <Notice tone="success" title="確認メールを送信しました" live>
        {state.message}
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message ? (
        <Notice tone="danger" live>
          {state.message}
        </Notice>
      ) : null}
      <TextField
        label="表示名（ニックネーム可）"
        name="displayName"
        autoComplete="nickname"
        required
        maxLength={50}
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
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
        autoComplete="new-password"
        hint="10文字以上"
        required
        error={state.fieldErrors?.password}
      />
      <TextField
        label="パスワード（確認）"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.passwordConfirm}
      />
      <Checkbox name="adult" error={state.fieldErrors?.adult}>
        18歳以上です
      </Checkbox>
      <Checkbox name="agreeTerms" error={state.fieldErrors?.agreeTerms}>
        <Link href="/legal/terms" target="_blank" className="text-sage-strong underline">
          利用規約
        </Link>
        と
        <Link href="/legal/privacy" target="_blank" className="text-sage-strong underline">
          プライバシーポリシー
        </Link>
        に同意します
      </Checkbox>
      <SubmitButton className="w-full" pendingLabel="登録中…">
        登録する
      </SubmitButton>
    </form>
  );
}
