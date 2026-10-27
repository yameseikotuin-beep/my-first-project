'use client';

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import type { FormState } from '@/lib/form-state';
import { Notice } from './notice';
import { Button } from './button';

const PendingContext = createContext(false);

/**
 * 管理画面のフォーム。サーバー処理の結果（エラー・完了）をフォームの上に表示する。
 * 入力欄は送信後も消えない（エラーのときに入力し直さなくてよいように）。
 */
export function ActionForm({
  action,
  children,
  className = 'space-y-4',
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  const messages = [
    ...(state.message ? [state.message] : []),
    ...Object.values(state.fieldErrors ?? {}).flatMap((m) => m ?? []),
  ];
  return (
    <form
      ref={ref}
      className={className}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await action(state, formData);
          setState(result ?? {});
          if (result?.ok && resetOnSuccess) ref.current?.reset();
        });
      }}
    >
      {messages.length ? (
        <Notice tone={state.ok ? 'success' : 'danger'} live>
          {messages.length === 1 ? (
            messages[0]
          ) : (
            <ul className="list-disc pl-5">
              {messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </Notice>
      ) : null}
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}

/** ActionForm の送信ボタン（送信中は押せない） */
export function FormSubmit({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'md' | 'sm';
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-busy={pending} className={className}>
      {pending ? '処理中…' : children}
    </Button>
  );
}
