import { formatDate, formatPrice, formatTimeRange, jstDate } from '@/lib/time';
import type { PublicServiceRow } from '@/lib/supabase/database.types';

const STEPS = ['メニュー', '日時', 'お客様情報', '確認', '完了'] as const;

/** 予約手順の進み具合（現在の手順を色と文字で示す） */
export function StepBar({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <nav aria-label="予約の手順" className="mb-4">
      <p className="sr-only">
        手順 {current} / {STEPS.length}：{STEPS[current - 1]}
      </p>
      <ol aria-hidden className="grid grid-cols-5 gap-1 text-center text-[0.7rem] sm:text-xs">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < current ? 'done' : n === current ? 'current' : 'todo';
          return (
            <li key={label}>
              <span
                className={`block h-1.5 rounded-full ${state === 'todo' ? 'bg-line' : 'bg-primary'}`}
              />
              <span className={`mt-1 block ${state === 'current' ? 'font-bold text-primary' : 'text-ink-muted'}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** 現在の選択内容 */
export function Selection({
  service,
  date,
  slot,
}: {
  service: PublicServiceRow;
  date?: string;
  slot?: { start_at: string; end_at: string };
}) {
  const day = slot ? jstDate(slot.start_at) : date;
  return (
    <dl className="mb-4 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
      <dt className="text-ink-muted">メニュー</dt>
      <dd className="font-medium">
        {service.name}（{service.duration_minutes}分・{formatPrice(service.price)}）
      </dd>
      {day ? (
        <>
          <dt className="text-ink-muted">日付</dt>
          <dd className="font-medium">{formatDate(day, true)}</dd>
        </>
      ) : null}
      {slot ? (
        <>
          <dt className="text-ink-muted">時間</dt>
          <dd className="font-medium">{formatTimeRange(slot.start_at, slot.end_at)}</dd>
        </>
      ) : null}
    </dl>
  );
}
