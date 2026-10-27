'use client';

import { Button, LinkButton } from '@/components/ui/button';

// 想定外のエラー。技術的な詳細は表示しない
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-xl font-bold">問題が発生しました</h1>
      <p className="mt-3 text-ink-muted">
        情報を読み込めませんでした。時間をおいてもう一度お試しください。予約の操作中だった場合、予約は確定していません。
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => reset()}>もう一度試す</Button>
        <LinkButton href="/" variant="secondary">
          はじめに戻る
        </LinkButton>
      </div>
    </main>
  );
}
