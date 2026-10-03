'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { PHOTO_BUCKET } from '@/lib/photos';
import { uuidSchema } from '@/lib/validation/schemas';

// 削除は「ファイル → データベースの行」の順に行う。途中で失敗しても行が残っていれば再実行できる。

function revalidateFor(formData: FormData) {
  const customerId = uuidSchema.safeParse(formData.get('customerId'));
  if (customerId.success) revalidatePath(`/staff/customers/${customerId.data}`);
  else revalidatePath('/me', 'layout');
}

export async function deletePhoto(formData: FormData): Promise<void> {
  await requireRole(['user', 'staff', 'admin']);
  const id = uuidSchema.safeParse(formData.get('photoId'));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: photo } = await supabase.from('photos').select('id, storage_path').eq('id', id.data).maybeSingle();
  if (!photo) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
  if (error) throw new Error('photo_delete_failed');
  await supabase.from('photos').delete().eq('id', photo.id);
  revalidateFor(formData);
}

export async function deleteSession(formData: FormData): Promise<void> {
  await requireRole(['user', 'admin']);
  const id = uuidSchema.safeParse(formData.get('sessionId'));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: photos } = await supabase.from('photos').select('storage_path').eq('session_id', id.data);
  if (photos && photos.length > 0) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
    if (error) throw new Error('photo_delete_failed');
  }
  // RLS：本人のセルフ撮影、または管理者のみ削除できる
  await supabase.from('photo_sessions').delete().eq('id', id.data);
  revalidateFor(formData);
}
