import { lpConfig } from '@/config/lp.config';
import { formatYen } from '@/lib/format';

/** 初回料金の表示。通常価格・割引率は確認できるまで載せない */
export function OfferPrice() {
  const { service } = lpConfig;
  return (
    <div className="rounded-2xl border-2 border-cta-600 bg-white p-6 text-center shadow-sm">
      <p className="font-bold text-navy-800">{service.name}</p>
      <p className="mt-1 text-sm text-navy-700">初回料金</p>
      <p data-testid="offer-price" className="mt-1 text-4xl font-bold text-cta-700">
        {formatYen(service.firstPriceYen)}
        <span className="ml-1 text-base text-navy-800">（税込）</span>
      </p>
      {service.duration && <p className="mt-2 text-sm text-navy-700">施術時間：{service.duration}</p>}
    </div>
  );
}
