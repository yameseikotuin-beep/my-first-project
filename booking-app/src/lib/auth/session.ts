import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export type AdminUser = { id: string; email: string | null };

/**
 * ログイン中の管理者を取得する（1リクエストにつき1回）。
 * ログインしていない、または管理者として登録されていない場合は null。
 * 管理者かどうかはデータベース（public.admins）で確認する。
 */
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) return null;
  return { id: auth.user.id, email: auth.user.email ?? null };
});

/** 管理画面・管理用の処理の最初で必ず呼ぶ */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
