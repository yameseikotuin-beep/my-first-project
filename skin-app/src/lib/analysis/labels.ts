import type { Metric, Region } from './types';

export const metricLabels: Record<Metric, string> = {
  pores: '毛穴の目立ち',
  redness: '赤み',
  pigmentation_like: '色素斑のように見える部分',
  texture: 'キメ・質感',
  surface: '肌表面の特徴（くすみ・てかりの見え方）',
};

export const regionLabels: Record<Region, string> = {
  forehead: '額',
  under_eye: '目の下',
  cheek_left: '左の頬',
  cheek_right: '右の頬',
  nose: '鼻',
  chin: 'あご',
};

/** 5段階の見え方の言葉（良い・悪いの評価ではなく、見え方の程度） */
export const gradeLabels: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'ほとんど目立たない',
  2: 'あまり目立たない',
  3: 'やや目立つ',
  4: '目立つ',
  5: 'かなり目立つ',
};

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return '高';
  if (confidence >= 0.4) return '中';
  return '低';
}

export const angleLabels = { front: '正面', left: '左側', right: '右側' } as const;
