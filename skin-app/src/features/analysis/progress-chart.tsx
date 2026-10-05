'use client';

import { useId, useState } from 'react';
import { METRICS, type Metric } from '@/lib/analysis/types';
import { metricLabels } from '@/lib/analysis/labels';

// 経過グラフ（項目ごとの小さな折れ線グラフを並べる）
// - 1項目1本の線なので凡例は置かず、見出しで項目を示す
// - 線の色は検証済みの1色（--color-chart）。文字は文字用の色
// - 値は触れる（ホバー・フォーカス）と表示し、表でも確認できる

export type ProgressSeriesPoint = { id: string; date: string; value: number | null };

const W = 320;
const H = 150;
const PAD = { top: 12, right: 40, bottom: 26, left: 28 };
const dateShort = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' });
const dateLong = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeZone: 'Asia/Tokyo' });

function x(i: number, n: number) {
  const inner = W - PAD.left - PAD.right;
  return PAD.left + (n <= 1 ? inner / 2 : (inner * i) / (n - 1));
}
function y(v: number) {
  const inner = H - PAD.top - PAD.bottom;
  return PAD.top + inner * ((5 - v) / 4);
}

function MiniChart({ metric, points }: { metric: Metric; points: ProgressSeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const n = points.length;
  const valued = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as (ProgressSeriesPoint & {
    i: number;
    value: number;
  })[];
  // 判定できなかった回は線を途切れさせる
  const segments: (typeof valued)[] = [];
  let current: typeof valued = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push({ ...p, i, value: p.value });
  });
  if (current.length) segments.push(current);
  const last = valued[valued.length - 1];
  const activePoint = active !== null ? points[active] : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i, n) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4">
      <figcaption id={titleId} className="font-medium">
        {metricLabels[metric]}
      </figcaption>
      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-labelledby={titleId}
          tabIndex={0}
          onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n - 1) - 1));
            if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? 0) + 1));
          }}
        >
          {[1, 2, 3, 4, 5].map((g) => (
            <g key={g}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="var(--color-border)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(g) + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
                {g}
              </text>
            </g>
          ))}
          {n > 0 ? (
            <>
              <text x={x(0, n)} y={H - 6} textAnchor="start" fontSize="10" fill="var(--color-text-muted)">
                {dateShort.format(new Date(points[0].date))}
              </text>
              {n > 1 ? (
                <text x={x(n - 1, n)} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
                  {dateShort.format(new Date(points[n - 1].date))}
                </text>
              ) : null}
            </>
          ) : null}
          {active !== null ? (
            <line x1={x(active, n)} x2={x(active, n)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--color-text-muted)" strokeWidth="1" />
          ) : null}
          {segments.map((seg, k) =>
            seg.length > 1 ? (
              <polyline
                key={k}
                points={seg.map((p) => `${x(p.i, n)},${y(p.value)}`).join(' ')}
                fill="none"
                stroke="var(--color-chart)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null,
          )}
          {valued.map((p) => (
            <circle
              key={p.id}
              cx={x(p.i, n)}
              cy={y(p.value)}
              r={active === p.i ? 5.5 : 4}
              fill="var(--color-chart)"
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          ))}
          {last ? (
            <text x={x(last.i, n) + 9} y={y(last.value) + 4} fontSize="11" fontWeight="700" fill="var(--color-text)">
              {last.value.toFixed(1)}
            </text>
          ) : null}
        </svg>
        {activePoint ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow"
            style={{ left: `${Math.min(70, Math.max(0, (x(active!, n) / W) * 100 - 15))}%` }}
          >
            <p className="font-bold">{activePoint.value === null ? '判定できず' : activePoint.value.toFixed(1)}</p>
            <p className="text-ink-muted">{dateLong.format(new Date(activePoint.date))}</p>
          </div>
        ) : null}
      </div>
    </figure>
  );
}

export function ProgressCharts({
  points,
}: {
  points: { id: string; date: string; averages: Record<string, number | null> }[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {METRICS.map((m) => (
          <MiniChart key={m} metric={m} points={points.map((p) => ({ id: p.id, date: p.date, value: p.averages[m] ?? null }))} />
        ))}
      </div>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer font-medium">表で見る</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">分析ごとの項目別の平均評価</caption>
            <thead className="text-ink-muted">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">分析日</th>
                {METRICS.map((m) => (
                  <th key={m} scope="col" className="py-2 pr-3 font-medium">
                    {metricLabels[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {points.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">{dateLong.format(new Date(p.date))}</td>
                  {METRICS.map((m) => (
                    <td key={m} className="py-2 pr-3">
                      {p.averages[m]?.toFixed(1) ?? '－'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
