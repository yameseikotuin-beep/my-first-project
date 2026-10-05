import { METRICS, REGIONS, type AnalyzerPhoto, type ItemResult, type Region, type SkinFeatureAnalyzer } from './types';

// モックの特徴抽出。
// 画像は解析しておらず、写真の ID から決まった仮の値を返す（同じ写真なら毎回同じ値）。
// 精度は一切検証されていないため、validated は false。画面にも必ず「モック」と表示する。

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 部位を判定するのに使える写真（左右の頬は横からの写真があるほうが判定しやすい） */
function photosFor(region: Region, photos: AnalyzerPhoto[]): AnalyzerPhoto[] {
  const byAngle = (a: AnalyzerPhoto['angle']) => photos.filter((p) => p.angle === a);
  if (region === 'cheek_left') return [...byAngle('left'), ...byAngle('front')];
  if (region === 'cheek_right') return [...byAngle('right'), ...byAngle('front')];
  return byAngle('front');
}

export const mockAnalyzer: SkinFeatureAnalyzer = {
  info: { name: 'mock-deterministic', version: '0.1.0', validated: false },

  async analyze(photos) {
    const results: ItemResult[] = [];
    for (const region of REGIONS) {
      const usable = photosFor(region, photos);
      const best = usable[0];
      for (const metric of METRICS) {
        if (!best) {
          results.push({
            metric,
            region,
            determinable: false,
            grade: null,
            confidence: 0,
            reason: 'この部位が写った写真がありません',
          });
          continue;
        }
        const h = hash(`${best.id}:${metric}:${region}`);
        // 撮影条件を満たさない写真は確信度を下げる
        const qualityFactor = best.quality.passed ? 1 : 0.5;
        // 横顔の写真で頬を見た場合は確信度を上げる
        const angleFactor = region.startsWith('cheek') && best.angle !== 'front' ? 1 : 0.85;
        const confidence = Math.round(((h % 50) / 100 + 0.4) * qualityFactor * angleFactor * 1000) / 1000;
        if (confidence < 0.25) {
          results.push({ metric, region, determinable: false, grade: null, confidence, reason: '写りが不十分なため判定できません' });
        } else {
          results.push({ metric, region, determinable: true, grade: ((h >>> 8) % 5 + 1) as 1 | 2 | 3 | 4 | 5, confidence });
        }
      }
    }
    return results;
  },
};
