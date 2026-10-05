import { describe, expect, it } from 'vitest';
import { changeLabel, lightingDiffers, metricAverages } from '@/lib/analysis/summary';
import { careLogSchema, todayInTokyo } from '@/features/care/schema';

describe('metricAverages', () => {
  it('判定できた部位だけで平均し、なければ null', () => {
    const avg = metricAverages([
      { metric: 'pores', determinable: true, grade: 2 },
      { metric: 'pores', determinable: true, grade: 3 },
      { metric: 'pores', determinable: false, grade: null },
      { metric: 'redness', determinable: false, grade: null },
    ]);
    expect(avg.pores).toBe(2.5);
    expect(avg.redness).toBeNull();
    expect(avg.texture).toBeNull();
  });
});

describe('changeLabel', () => {
  it('小さな差は「大きな変化なし」、方向を言葉で示す', () => {
    expect(changeLabel(3, 3.2)).toBe('大きな変化なし');
    expect(changeLabel(3, 2)).toBe('目立ちにくい方向（-1.0）');
    expect(changeLabel(2, 3.5)).toBe('目立つ方向（+1.5）');
    expect(changeLabel(null, 3)).toBe('比較できません');
  });
});

describe('lightingDiffers', () => {
  it('明るさの差が大きいときだけ true', () => {
    expect(lightingDiffers(0.5, 0.55)).toBe(false);
    expect(lightingDiffers(0.3, 0.6)).toBe(true);
    expect(lightingDiffers(undefined, 0.6)).toBe(false);
  });
});

describe('careLogSchema', () => {
  it('正しい入力は通り、睡眠時間は数値になる', () => {
    const r = careLogSchema.parse({ logDate: '2026-10-06', careItems: ['洗顔', '日焼け止め'], sleepHours: '6.5' });
    expect(r).toMatchObject({ logDate: '2026-10-06', careItems: ['洗顔', '日焼け止め'], sleepHours: 6.5, note: '' });
  });

  it('不正な日付・ケア項目・睡眠時間を拒否する', () => {
    expect(careLogSchema.safeParse({ logDate: '2026/10/06' }).success).toBe(false);
    expect(careLogSchema.safeParse({ logDate: '2026-10-06', careItems: ['ハッキング'] }).success).toBe(false);
    expect(careLogSchema.safeParse({ logDate: '2026-10-06', sleepHours: '30' }).success).toBe(false);
    expect(careLogSchema.safeParse({ logDate: '2026-10-06', sleepHours: 'たくさん' }).success).toBe(false);
  });
});

describe('todayInTokyo', () => {
  it('日本時間の日付を返す', () => {
    expect(todayInTokyo(new Date('2026-10-05T16:00:00Z'))).toBe('2026-10-06');
    expect(todayInTokyo(new Date('2026-10-05T14:00:00Z'))).toBe('2026-10-05');
  });
});
