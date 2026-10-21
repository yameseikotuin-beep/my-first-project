import { lpConfig } from '@/config/lp.config';

export type ReservationTarget =
  | { status: 'ok'; url: string }
  | { status: 'unset' }
  | { status: 'invalid'; raw: string };

/** 予約URLを確認する。https:// 以外や形式が正しくない URL へは遷移させない */
export function getReservationTarget(raw: string = lpConfig.reservationUrl): ReservationTarget {
  const value = raw.trim();
  if (!value) return { status: 'unset' };
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return { status: 'invalid', raw: value };
    return { status: 'ok', url: url.toString() };
  } catch {
    return { status: 'invalid', raw: value };
  }
}

export const isDevelopment = process.env.NODE_ENV !== 'production';
