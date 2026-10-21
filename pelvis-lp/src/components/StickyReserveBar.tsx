'use client';

import { getReservationTarget } from '@/lib/reservation';
import { ReserveButton } from './ReserveButton';

/** 画面下に固定する予約ボタン。予約URLが使えないときは表示しない */
export function StickyReserveBar() {
  if (getReservationTarget().status !== 'ok') return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-beige-200 bg-white/95 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto max-w-3xl">
        <ReserveButton placement="sticky" className="min-h-12 text-base" />
      </div>
    </div>
  );
}
