import type { AnalyzerPhoto, ItemResult } from './types';

/** 確信度がこれ未満の項目は「確信度が低い」とみなす */
export const LOW_CONFIDENCE = 0.4;

export type GateResult = { ok: true } | { ok: false; reason: string };

/** 分析の前に、撮影品質で判定できるかを確認する */
export function checkPhotos(photos: AnalyzerPhoto[]): GateResult {
  const front = photos.find((p) => p.angle === 'front');
  if (!front) return { ok: false, reason: '正面の写真がありません。正面から撮影してください。' };
  if (!front.quality.passed) {
    return {
      ok: false,
      reason:
        '正面の写真が撮影条件（明るさ・ブレ・顔の向き・距離）を満たしていないため、判定できません。明るい場所で撮り直してください。',
    };
  }
  return { ok: true };
}

/** 分析の後に、判定できなかった項目・確信度の低い項目が多すぎないかを確認する */
export function checkResults(items: ItemResult[]): GateResult {
  if (items.length === 0) return { ok: false, reason: '判定できる項目がありませんでした。' };
  const weak = items.filter((i) => !i.determinable || i.confidence < LOW_CONFIDENCE).length;
  if (weak / items.length >= 0.5) {
    return {
      ok: false,
      reason: '判定できない、または確信度の低い項目が半分以上ありました。撮影条件を整えて撮り直してください。',
    };
  }
  return { ok: true };
}
