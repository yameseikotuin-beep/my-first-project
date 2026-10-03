import type { AppRole } from '@/lib/supabase/database.types';

export type { AppRole };

export const roleLabels: Record<AppRole, string> = {
  user: '一般ユーザー',
  staff: 'サロンスタッフ',
  admin: '管理者',
};

/** ログイン後に最初に表示する画面 */
export function homePathForRole(role: AppRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'staff':
      return '/staff';
    default:
      return '/me';
  }
}

/** URL を開くのに必要な役割。null はログイン不要。 */
export function requiredRolesForPath(pathname: string): readonly AppRole[] | 'any' | null {
  if (pathname === '/me' || pathname.startsWith('/me/')) return ['user'];
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return ['staff', 'admin'];
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return ['admin'];
  if (pathname === '/consent' || pathname === '/home' || pathname === '/update-password') return 'any';
  return null;
}

/** ログイン後の移動先として安全な相対パスか（外部サイトへの転送を防ぐ） */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  return requiredRolesForPath(next.split('?')[0]) === null ? null : next;
}
