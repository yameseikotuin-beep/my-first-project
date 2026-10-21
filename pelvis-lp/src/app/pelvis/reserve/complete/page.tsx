import type { Metadata } from 'next';
import Link from 'next/link';
import { ReserveCompleteTracker } from '@/components/ReserveCompleteTracker';
import { lpConfig } from '@/config/lp.config';

// 予約システムから「予約完了後に戻すページ」として設定できる場合だけ使う。
// lpConfig.reservationCompleteTracking が false の間は「予約完了」イベントを送らない。
export const metadata: Metadata = {
  title: 'ご予約ありがとうございます',
  robots: { index: false },
};

export default function ReserveCompletePage() {
  return (
    <div className="py-12 text-center">
      {lpConfig.reservationCompleteTracking && <ReserveCompleteTracker />}
      <h1 className="text-2xl font-bold">ご予約ありがとうございます</h1>
      <p className="mt-4">ご予約の内容は、予約ページからのご案内をご確認ください。</p>
      <Link href="/pelvis/article/" className="mt-8 inline-block font-bold text-navy-700 underline underline-offset-4">
        記事に戻る
      </Link>
    </div>
  );
}
