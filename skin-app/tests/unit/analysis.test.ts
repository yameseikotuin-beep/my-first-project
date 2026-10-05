import { describe, expect, it } from 'vitest';
import { mockAnalyzer } from '@/lib/analysis/mock-analyzer';
import { checkPhotos, checkResults } from '@/lib/analysis/quality-gate';
import { METRICS, REGIONS, type AnalyzerPhoto } from '@/lib/analysis/types';

const front: AnalyzerPhoto = { id: 'f0000000-0000-0000-0000-000000000001', angle: 'front', quality: { passed: true, issues: [] } };
const left: AnalyzerPhoto = { id: 'f0000000-0000-0000-0000-000000000002', angle: 'left', quality: { passed: true, issues: [] } };

describe('mockAnalyzer', () => {
  it('検証されていないモックとして名乗る', () => {
    expect(mockAnalyzer.info.validated).toBe(false);
  });

  it('全項目×全部位の結果を返し、同じ写真なら毎回同じ値', async () => {
    const a = await mockAnalyzer.analyze([front, left]);
    const b = await mockAnalyzer.analyze([front, left]);
    expect(a).toHaveLength(METRICS.length * REGIONS.length);
    expect(a).toEqual(b);
  });

  it('評価は1〜5、確信度は0〜1。判定できない項目には評価を付けない', async () => {
    for (const item of await mockAnalyzer.analyze([front])) {
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
      if (item.determinable) expect(item.grade).toBeGreaterThanOrEqual(1);
      else expect(item.grade).toBeNull();
    }
  });

  it('写っていない部位は判定できない', async () => {
    const items = await mockAnalyzer.analyze([left]);
    expect(items.filter((i) => i.region === 'forehead').every((i) => !i.determinable)).toBe(true);
    expect(items.some((i) => i.region === 'cheek_left' && i.determinable)).toBe(true);
  });
});

describe('quality gate', () => {
  it('正面の写真がない・条件を満たさない場合は撮り直し', () => {
    expect(checkPhotos([left]).ok).toBe(false);
    expect(checkPhotos([{ ...front, quality: { passed: false, issues: ['too_dark'] } }]).ok).toBe(false);
    expect(checkPhotos([front]).ok).toBe(true);
  });

  it('判定できない・確信度の低い項目が半分以上なら撮り直し', () => {
    const weak = { metric: 'pores' as const, region: 'nose' as const, determinable: false, grade: null, confidence: 0 };
    const strong = { metric: 'pores' as const, region: 'chin' as const, determinable: true, grade: 3 as const, confidence: 0.8 };
    expect(checkResults([weak, strong]).ok).toBe(false);
    expect(checkResults([weak, strong, strong]).ok).toBe(true);
    expect(checkResults([]).ok).toBe(false);
  });
});
