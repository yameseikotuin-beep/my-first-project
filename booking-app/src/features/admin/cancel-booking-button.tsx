'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { cancelBooking } from './booking-actions';

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          if (!window.confirm('この予約をキャンセルしますか？（キャンセルした枠は空きに戻ります）')) return;
          startTransition(async () => {
            const result = await cancelBooking(bookingId);
            setMessage(result.ok ? null : (result.message ?? null));
          });
        }}
      >
        {pending ? '処理中…' : '予約をキャンセルする'}
      </Button>
      {message ? (
        <Notice tone="danger" live>
          {message}
        </Notice>
      ) : null}
    </div>
  );
}
