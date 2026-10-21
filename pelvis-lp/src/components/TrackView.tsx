'use client';

import { useEffect } from 'react';
import { trackOnce, type LpEventName } from '@/lib/analytics';

/** 表示されたときに表示系イベントを 1 回だけ送る */
export function TrackView({ event }: { event: Exclude<LpEventName, 'reserve_click' | 'reserve_complete'> }) {
  useEffect(() => {
    trackOnce(event);
  }, [event]);
  return null;
}
