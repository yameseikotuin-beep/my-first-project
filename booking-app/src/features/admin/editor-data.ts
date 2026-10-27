import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getSettings, listPractitioners, listRooms, listServices } from '@/lib/admin-data';
import { isDateString } from '@/lib/time';
import { uuidSchema } from '@/lib/validation/schemas';
import type { SlotRow } from '@/lib/supabase/database.types';

/** 予約の登録・変更フォームに必要なデータ（選択肢と、指定があればその日の空き時間） */
export async function loadEditorData(serviceId: string | undefined, date: string | undefined, excludeBookingId?: string) {
  const [settings, services, rooms, practitioners] = await Promise.all([
    getSettings(),
    listServices(),
    listRooms(),
    listPractitioners(),
  ]);
  let slots: SlotRow[] | null = null;
  if (serviceId && uuidSchema.safeParse(serviceId).success && date && isDateString(date)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('admin_available_slots', {
      p_service_id: serviceId,
      p_date: date,
      p_exclude_booking: excludeBookingId ?? null,
    });
    slots = error ? null : (data ?? []);
  }
  return { settings, services, rooms, practitioners, slots };
}
