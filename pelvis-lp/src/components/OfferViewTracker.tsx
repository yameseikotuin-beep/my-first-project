'use client';

import { useEffect, useRef } from 'react';
import { trackOnce } from '@/lib/analytics';

/** オファー（初回料金）が画面に入ったときに「オファー表示」を 1 回だけ送る */
export function OfferViewTracker({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      trackOnce('offer_view');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackOnce('offer_view');
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
