import { Brand } from '@/components/brand';
import { LinkButton } from '@/components/ui/button';
import { PageTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <div className="mb-8">
        <Brand />
      </div>
      <PageTitle lead="ページが存在しないか、表示する権限がありません。">ページが見つかりません</PageTitle>
      <LinkButton href="/home">ホームへ戻る</LinkButton>
    </main>
  );
}
