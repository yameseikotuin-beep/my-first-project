import { METRICS, type Metric } from './types';

type GradedItem = { metric: string; determinable: boolean; grade: number | null };

/** 項目ごとの評価の平均（判定できた部位だけ）。判定できた部位がなければ null */
export function metricAverages(items: GradedItem[]): Record<Metric, number | null> {
  const result = {} as Record<Metric, number | null>;
  for (const metric of METRICS) {
    const grades = items
      .filter((i) => i.metric === metric && i.determinable && i.grade !== null)
      .map((i) => i.grade as number);
    result[metric] = grades.length ? Math.round((grades.reduce((a, b) => a + b, 0) / grades.length) * 10) / 10 : null;
  }
  return result;
}

/** 前回との差の言葉（評価は「目立つ」ほど大きいので、差が負なら目立ちにくくなった） */
export function changeLabel(previous: number | null, current: number | null): string {
  if (previous === null || current === null) return '比較できません';
  const d = Math.round((current - previous) * 10) / 10;
  if (Math.abs(d) < 0.3) return '大きな変化なし';
  return d < 0 ? `目立ちにくい方向（${d.toFixed(1)}）` : `目立つ方向（+${d.toFixed(1)}）`;
}

/** 撮影の明るさの差が大きいと、比較の精度が下がる */
export function lightingDiffers(a?: number | null, b?: number | null): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) > 0.15;
}
