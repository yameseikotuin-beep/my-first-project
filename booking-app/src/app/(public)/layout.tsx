import Link from 'next/link';
import { getPublicInfo } from '@/lib/public-data';

export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  const info = await getPublicInfo();
  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-bold">
            {info?.shop_name ?? 'WEB予約'}
          </Link>
          <span className="text-sm text-ink-muted">WEB予約</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-xl px-4 py-4 text-sm text-ink-muted">
          {info?.shop_phone ? (
            <p>
              予約の変更・キャンセルはお電話でご連絡ください：
              <a href={`tel:${info.shop_phone.replace(/[^0-9]/g, '')}`} className="font-medium text-primary underline">
                {info.shop_phone}
              </a>
            </p>
          ) : (
            <p>予約の変更・キャンセルは店舗までご連絡ください。</p>
          )}
        </div>
      </footer>
    </>
  );
}
