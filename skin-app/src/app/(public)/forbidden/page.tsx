import type { Metadata } from 'next';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'この画面は表示できません' };

export default function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle lead="この画面を表示する権限がありません。アカウントの役割が違うか、利用が停止されている可能性があります。">
        この画面は表示できません
      </PageTitle>
      <LinkButton href="/home">ホームへ戻る</LinkButton>
    </div>
  );
}
