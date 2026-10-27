import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';
import type { PublicInfoRow, PublicServiceRow, SlotRow } from '@/lib/supabase/database.types';

// 予約画面で使うデータ。すべて公開用の関数（必要な情報だけを返す）から取得する。
// 取得に失敗した場合は例外を投げ、エラー画面（内部情報を出さない）を表示する。

export class PublicDataError extends Error {}

export const getPublicInfo = cache(async (): Promise<PublicInfoRow | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_info');
  if (error) throw new PublicDataError('get_public_info failed');
  return data?.[0] ?? null;
});

export const getPublicServices = cache(async (): Promise<PublicServiceRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_services');
  if (error) throw new PublicDataError('get_public_services failed');
  return data ?? [];
});

export async function getPublicService(id: string): Promise<PublicServiceRow | null> {
  return (await getPublicServices()).find((s) => s.id === id) ?? null;
}

export async function getOpenDays(from: string, to: string): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_public_open_days', { p_from: from, p_to: to });
  if (error) throw new PublicDataError('get_public_open_days failed');
  return new Map((data ?? []).map((d) => [d.day, d.is_open]));
}

export async function getAvailableSlots(serviceId: string, date: string): Promise<SlotRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_available_slots', { p_service_id: serviceId, p_date: date });
  if (error) throw new PublicDataError('get_available_slots failed');
  return data ?? [];
}
