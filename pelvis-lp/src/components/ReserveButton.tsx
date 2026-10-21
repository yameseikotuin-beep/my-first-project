'use client';

import { lpConfig } from '@/config/lp.config';
import { trackReserveClick, type ReservePlacement } from '@/lib/analytics';
import { formatYen } from '@/lib/format';
import { getReservationTarget, isDevelopment } from '@/lib/reservation';

type Props = {
  placement: ReservePlacement;
  label?: string;
  className?: string;
};

const defaultLabel = `初回${formatYen(lpConfig.service.firstPriceYen)}（税込）で予約する`;

/**
 * 既存の予約ページへのボタン。予約URLが未設定・不正なときはどこにも遷移させない。
 * クリックは「予約ボタンクリック」として送り、「予約完了」としては扱わない。
 */
export function ReserveButton({ placement, label = defaultLabel, className = '' }: Props) {
  const target = getReservationTarget();
  const base =
    'flex min-h-14 w-full items-center justify-center rounded-full px-6 py-3 text-center text-base font-bold shadow-md transition sm:text-lg';

  if (target.status === 'ok') {
    return (
      <a
        href={target.url}
        rel="noopener"
        data-placement={placement}
        onClick={() => trackReserveClick(placement)}
        className={`${base} bg-cta-600 text-white hover:bg-cta-700 active:scale-[0.98] ${className}`}
      >
        {label}
        <span aria-hidden="true" className="ml-2">
          ›
        </span>
      </a>
    );
  }

  return (
    <div className={className}>
      <span
        role="link"
        aria-disabled="true"
        data-placement={placement}
        data-testid="reserve-unavailable"
        className={`${base} cursor-not-allowed bg-gray-300 text-gray-600 shadow-none`}
      >
        オンライン予約は準備中です
      </span>
      {isDevelopment && (
        <p data-testid="dev-notice" className="mt-2 rounded-md border-2 border-dashed border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          【開発環境のみ表示】
          {target.status === 'unset'
            ? '予約URLが未設定です。'
            : `予約URL「${target.raw}」は https:// で始まる正しい URL ではないため、使用していません。`}
          NEXT_PUBLIC_RESERVATION_URL または src/config/lp.config.ts の reservationUrl を設定してください。
        </p>
      )}
    </div>
  );
}
