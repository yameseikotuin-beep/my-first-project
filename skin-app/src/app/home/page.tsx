import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { homePathForRole } from '@/lib/auth/roles';
import { createClient } from '@/lib/supabase/server';

// ログイン後の振り分け：役割ごとのホームへ。一般ユーザーで同意の回答がまだなら同意画面へ。
export default async function HomeRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.profile.role === 'user') {
    const supabase = await createClient();
    const { count } = await supabase
      .from('consents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if (!count) redirect('/consent');
  }
  redirect(homePathForRole(user.profile.role));
}
