import type { AppRole } from '@/lib/supabase/database.types';

/** 1日（日本時間）あたりの AI 利用回数の上限 */
export function aiDailyLimit(role: AppRole): number {
  const raw = role === 'user' ? process.env.AI_DAILY_LIMIT_USER : process.env.AI_DAILY_LIMIT_STAFF;
  const n = Number.parseInt(raw ?? '', 10);
  if (Number.isFinite(n) && n >= 0) return n;
  return role === 'user' ? 10 : 100;
}
