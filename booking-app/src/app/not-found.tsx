import { LinkButton } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="mt-3 text-ink-muted">URL が正しいかご確認ください。メニューの受付が終了した可能性もあります。</p>
      <div className="mt-6">
        <LinkButton href="/">予約画面のはじめへ</LinkButton>
      </div>
    </main>
  );
}
