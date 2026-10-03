import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsentDocumentRow, ConsentKind, ConsentRow, Database } from '@/lib/supabase/database.types';

export const consentKinds: readonly ConsentKind[] = ['photo_capture', 'photo_storage', 'ai_processing'];

/** 撮影に必要な同意 */
export const requiredForCapture: readonly ConsentKind[] = ['photo_capture', 'photo_storage'];

export const consentLabels: Record<ConsentKind, string> = {
  photo_capture: '顔写真の撮影',
  photo_storage: '顔写真の保存',
  ai_processing: 'AIサービスへの写真の送信',
};

/** 種類ごとの最新版の同意文 */
export async function getLatestConsentDocuments(
  supabase: SupabaseClient<Database>,
): Promise<Record<ConsentKind, ConsentDocumentRow | undefined>> {
  const { data } = await supabase.from('consent_documents').select('*').order('published_at', { ascending: false });
  const latest = {} as Record<ConsentKind, ConsentDocumentRow | undefined>;
  for (const doc of data ?? []) {
    latest[doc.kind] ??= doc;
  }
  return latest;
}

export type Subject = { userId: string } | { customerId: string };

/** 撤回されていない同意（種類ごと） */
export async function getActiveConsents(
  supabase: SupabaseClient<Database>,
  subject: Subject,
): Promise<Partial<Record<ConsentKind, ConsentRow>>> {
  let query = supabase.from('consents').select('*').is('revoked_at', null).order('granted_at', { ascending: false });
  query = 'userId' in subject ? query.eq('user_id', subject.userId) : query.eq('customer_id', subject.customerId);
  const { data } = await query;
  const active: Partial<Record<ConsentKind, ConsentRow>> = {};
  for (const row of data ?? []) {
    active[row.kind] ??= row;
  }
  return active;
}

export function canCapture(active: Partial<Record<ConsentKind, ConsentRow>>): boolean {
  return requiredForCapture.every((k) => active[k]);
}
