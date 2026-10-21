import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <Link href="/pelvis/" className="mt-6 inline-block font-bold underline underline-offset-4">
        トップへ戻る
      </Link>
    </main>
  );
}
