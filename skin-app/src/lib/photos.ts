import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PhotoRow, PhotoSessionRow } from '@/lib/supabase/database.types';
import { writeAudit } from '@/lib/audit';

export const PHOTO_BUCKET = 'face-photos';
/** 写真を表示する署名付き URL の有効期限（秒） */
export const SIGNED_URL_TTL = 60;

export type SessionWithPhotos = PhotoSessionRow & {
  photos: (PhotoRow & { url: string | null })[];
};

const angleOrder = { front: 0, left: 1, right: 2 } as const;

/**
 * 撮影セッションと写真を取得し、表示用の短い署名付き URL を付ける。
 * 写真を表示したことを監査ログに残す。
 */
export async function loadSessionsWithPhotos(
  supabase: SupabaseClient<Database>,
  filter: { userId: string } | { customerId: string } | { sessionId: string },
  limit = 20,
): Promise<SessionWithPhotos[]> {
  let query = supabase
    .from('photo_sessions')
    .select('*, photos(*)')
    .order('created_at', { ascending: false })
    .limit(limit);
  query =
    'userId' in filter
      ? query.eq('user_id', filter.userId)
      : 'customerId' in filter
        ? query.eq('customer_id', filter.customerId)
        : query.eq('id', filter.sessionId);
  const { data } = await query;
  const sessions: (PhotoSessionRow & { photos: PhotoRow[] })[] = data ?? [];

  const paths = sessions.flatMap((s) => s.photos.map((p) => p.storage_path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    await writeAudit(supabase, 'photo.view', undefined, {
      photo_ids: sessions.flatMap((s) => s.photos.map((p) => p.id)),
    });
  }

  return sessions.map((s) => ({
    ...s,
    photos: [...s.photos]
      .sort((a, b) => angleOrder[a.angle] - angleOrder[b.angle])
      .map((p) => ({ ...p, url: urls.get(p.storage_path) ?? null })),
  }));
}
