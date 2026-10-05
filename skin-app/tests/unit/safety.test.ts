import { describe, expect, it } from 'vitest';
import { filterList, filterText } from '@/lib/ai/safety';

describe('filterText', () => {
  it('病名・診断・効果の断定・写真から断定しない数値を含む文を取り除く', () => {
    const r = filterText(
      '頬に赤みがあるように見えます。これは皮膚炎です。肌年齢は30歳です。毛穴はあまり目立たないように見えます。このケアで必ず治ります。',
    );
    expect(r.text).toBe('頬に赤みがあるように見えます。毛穴はあまり目立たないように見えます。');
    expect(r.removed).toBe(3);
  });

  it('問題のない文はそのまま残す', () => {
    const text = '全体的に明るい印象に見えます。\n照明の影響で右側に影があります。';
    expect(filterText(text)).toEqual({ text, removed: 0 });
  });

  it('箇条書きの各項目も検査する', () => {
    const r = filterList(['保湿を心がけましょう。', '水分量を上げる化粧水を使いましょう。']);
    expect(r).toEqual({ items: ['保湿を心がけましょう。'], removed: 1 });
  });
});
