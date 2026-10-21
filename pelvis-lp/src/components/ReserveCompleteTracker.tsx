'use client';

import { useEffect } from 'react';
import { trackReserveComplete } from '@/lib/analytics';

export function ReserveCompleteTracker() {
  useEffect(() => {
    trackReserveComplete();
  }, []);
  return null;
}
