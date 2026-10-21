import { lpConfig } from '@/config/lp.config';
import { formatYen } from '@/lib/format';
import { DevNotice } from './DevNotice';

/** 店舗情報。設定済みの項目だけを表示する */
export function StoreInfo() {
  const { store, service } = lpConfig;
  const rows: { label: string; value: string; key: string }[] = [
    { label: '店舗名', value: store.name, key: 'store.name' },
    { label: 'メニュー', value: service.name, key: 'service.name' },
    { label: '初回料金', value: `${formatYen(service.firstPriceYen)}（税込）`, key: 'service.firstPriceYen' },
    { label: '施術時間', value: service.duration, key: 'service.duration' },
    { label: '住所', value: store.address, key: 'store.address' },
    { label: '営業時間', value: store.hours, key: 'store.hours' },
  ];
  const shown = rows.filter((r) => r.value);
  const missing = rows.filter((r) => !r.value);

  return (
    <div>
      <dl className="divide-y divide-beige-200 overflow-hidden rounded-xl border border-beige-200 bg-white">
        {shown.map((r) => (
          <div key={r.key} className="grid grid-cols-[6.5rem_1fr] gap-2 px-4 py-3">
            <dt className="text-sm font-bold text-navy-700">{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {store.mapUrl && (
        <p className="mt-3">
          <a href={store.mapUrl} rel="noopener" className="font-bold text-navy-700 underline underline-offset-4">
            地図・アクセスを見る
          </a>
        </p>
      )}
      {missing.length > 0 && <DevNotice>店舗情報の未設定項目：{missing.map((m) => `${m.label}（${m.key}）`).join('、')}</DevNotice>}
    </div>
  );
}
