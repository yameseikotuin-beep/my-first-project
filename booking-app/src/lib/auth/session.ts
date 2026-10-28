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
  // getClaims() はログインの証明書（JWT）の署名を確認する。Supabase の新しい署名鍵では手元で確認でき、
  // 認証サーバーへの問い合わせが不要なため getUser() より速い（古い鍵の場合は自動で問い合わせる）
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;
  const { data: isAdmin, error } = await supabase.rpc('is_admin');
  if (error || isAdmin !== true) return null;
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
});

/** 管理画面・管理用の処理の最初で必ず呼ぶ */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}
