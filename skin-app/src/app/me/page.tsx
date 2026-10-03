import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { Card, PageTitle } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { requireRole } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { canCapture, getActiveConsents } from '@/lib/consent';

export const metadata: Metadata = { title: 'ホーム' };

const dateFormat = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Tokyo' });

export default async function MeHomePage() {
  const user = await requireRole(['user']);
  const supabase = await createClient();
  const [active, latest] = await Promise.all([
    getActiveConsents(supabase, { userId: user.id }),
    supabase
      .from('photo_sessions')
      .select('id, created_at, photos(count)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const ready = canCapture(active);
  const last = latest.data;

  return (
    <div className="space-y-6">
      <PageTitle>{user.profile.display_name ? `${user.profile.display_name}さん、こんにちは` : 'こんにちは'}</PageTitle>

      {!ready ? (
        <Notice tone="warning" title="撮影の前に同意が必要です">
          <p>顔写真の撮影と保存について、内容をご確認のうえ同意してください。</p>
          <LinkButton href="/consent" className="mt-3">
            同意の内容を確認する
          </LinkButton>
        </Notice>
      ) : null}

      <Card>
        <h2 className="font-serif text-lg font-semibold">肌の記録</h2>
        <p className="mt-2 text-ink-muted">
          {last ? `前回の撮影：${dateFormat.format(new Date(last.created_at))}` : 'まだ撮影の記録がありません。'}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/me/capture" className="w-full sm:w-auto">
            撮影をはじめる
          </LinkButton>
          <LinkButton href="/me/photos" variant="secondary" className="w-full sm:w-auto">
            保存した写真を見る
          </LinkButton>
        </div>
      </Card>

      <Card>
        <h2 className="font-serif text-lg font-semibold">準備中の機能</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-muted">
          <li>肌の見た目の分析レポート（今後のアップデートで追加）</li>
          <li>セルフケアの記録と経過グラフ（今後のアップデートで追加）</li>
        </ul>
      </Card>
    </div>
  );
}
