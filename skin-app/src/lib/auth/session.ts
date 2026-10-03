import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/lib/supabase/database.types';
import type { AppRole } from './roles';

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: ProfileRow;
};

/**
 * ログイン中の利用者と profiles を取得する（1リクエストにつき1回）。
 * 未ログイン・停止中・profiles がない場合は null。
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { id: auth.user.id, email: auth.user.email ?? null, profile };
});

/** 画面・サーバー処理の最初で呼ぶ。役割が合わなければログイン画面か 403 へ移動する。 */
export async function requireRole(roles: readonly AppRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!roles.includes(user.profile.role)) redirect('/forbidden');
  return user;
}
