// 画像解析モジュールの型（docs/03-architecture.md §4）
// 特徴抽出（SkinFeatureAnalyzer）と説明文（VisualDescriber）を分け、
// 将来、検証済みの専用モデルに差し替えられるようにする。

export type Angle = 'front' | 'left' | 'right';
export type Metric = 'pores' | 'redness' | 'pigmentation_like' | 'texture' | 'surface';
export type Region = 'forehead' | 'cheek_left' | 'cheek_right' | 'nose' | 'chin' | 'under_eye';

export const METRICS: readonly Metric[] = ['pores', 'redness', 'pigmentation_like', 'texture', 'surface'];
export const REGIONS: readonly Region[] = ['forehead', 'under_eye', 'cheek_left', 'cheek_right', 'nose', 'chin'];

export type AnalyzerInfo = {
  name: string;
  version: string;
  /** 精度が検証済みか。false の間は画面に「モック（未検証）」と表示する */
  validated: boolean;
};

/** 撮影時に端末で測った品質（photos.quality に保存したもの） */
export type PhotoQuality = {
  passed: boolean;
  issues: string[];
  brightness?: number;
  sharpness?: number;
  faceCheckAvailable?: boolean;
};

export type AnalyzerPhoto = {
  id: string;
  angle: Angle;
  quality: PhotoQuality;
};

export type ItemResult = {
  metric: Metric;
  region: Region;
  determinable: boolean;
  /** 見え方の5段階（1=目立たない … 5=目立つ）。判定できない場合は null */
  grade: 1 | 2 | 3 | 4 | 5 | null;
  /** 確信度 0〜1 */
  confidence: number;
  reason?: string;
};

export interface SkinFeatureAnalyzer {
  readonly info: AnalyzerInfo;
  analyze(photos: AnalyzerPhoto[]): Promise<ItemResult[]>;
}
