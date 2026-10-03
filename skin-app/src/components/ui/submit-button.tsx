'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './button';
import type { ComponentProps } from 'react';

/** 送信中は押せなくなり「処理中…」と表示するボタン */
export function SubmitButton({
  children,
  pendingLabel = '処理中…',
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
