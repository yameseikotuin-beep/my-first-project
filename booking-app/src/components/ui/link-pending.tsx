'use client';

import { useLinkStatus } from 'next/link';

/** リンクを押してから次の画面が表示されるまでの間、小さな回転の印を表示する */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
    />
  );
}
