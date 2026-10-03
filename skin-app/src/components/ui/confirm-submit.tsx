'use client';

import { useFormStatus } from 'react-dom';
import { buttonClass } from './button';

/** 押すと確認を求め、OK のときだけフォームを送信するボタン（削除などの取り消せない操作用） */
export function ConfirmSubmit({
  children,
  confirmMessage,
  variant = 'danger',
  className = '',
}: {
  children: React.ReactNode;
  confirmMessage: string;
  variant?: 'danger' | 'secondary';
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant, `min-h-11 px-4 text-sm ${className}`)}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {pending ? '処理中…' : children}
    </button>
  );
}
