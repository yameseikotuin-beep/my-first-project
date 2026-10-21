import type { Metadata } from 'next';
import Link from 'next/link';
import { OfferPrice } from '@/components/OfferPrice';
import { OfferViewTracker } from '@/components/OfferViewTracker';
import { ReserveButton } from '@/components/ReserveButton';
import { StoreInfo } from '@/components/StoreInfo';
import { lpConfig } from '@/config/lp.config';

export const metadata: Metadata = {
  title: 'ご予約',
  description: `${lpConfig.service.name}のご予約はこちらから。`,
};

export default function ReservePage() {
  return (
    <div className="space-y-8 py-8">
      <div>
        <h1 className="text-2xl font-bold">{lpConfig.service.name}のご予約</h1>
        <p className="mt-3">下のボタンから予約ページへ進み、ご希望の日時をお選びください。</p>
      </div>
      <OfferViewTracker>
        <OfferPrice />
      </OfferViewTracker>
      <ReserveButton placement="reserve_page" />
      <p className="text-sm text-navy-700">※予約ページ（外部サイト）へ移動します。</p>
      <section aria-labelledby="reserve-store" className="space-y-4">
        <h2 id="reserve-store" className="text-lg font-bold">
          店舗情報
        </h2>
        <StoreInfo />
      </section>
      <p className="text-center">
        <Link href="/pelvis/article/#offer" className="font-bold text-navy-700 underline underline-offset-4">
          施術の内容・流れを見る
        </Link>
      </p>
    </div>
  );
}
