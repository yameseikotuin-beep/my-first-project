import Link from 'next/link';
import { getPublicInfo, getPublicServices } from '@/lib/public-data';
import { StepBar } from '@/features/booking/steps';
import { Notice } from '@/components/ui/notice';
import { formatPrice } from '@/lib/time';

// 手順1：メニュー選択
export default async function MenuPage() {
  const info = await getPublicInfo();
  if (!info) {
    return (
      <Notice tone="warning" title="準備中です">
        WEB予約はまだご利用いただけません。お手数ですが店舗へ直接ご連絡ください。
      </Notice>
    );
  }
  const services = await getPublicServices();
  return (
    <>
      <StepBar current={1} />
      <h1 className="mb-3 text-xl font-bold">メニューを選んでください</h1>
      {services.length === 0 ? (
        <Notice>現在、WEBで予約できるメニューはありません。</Notice>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/book/${s.id}`}
                className="block rounded-xl border border-line bg-surface p-4 hover:border-primary active:bg-primary-soft"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-bold">{s.name}</span>
                  <span className="shrink-0 font-bold text-primary">{formatPrice(s.price)}</span>
                </span>
                <span className="mt-0.5 block text-sm text-ink-muted">施術時間 {s.duration_minutes}分</span>
                {s.description ? <span className="mt-2 block text-[0.95rem]">{s.description}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
