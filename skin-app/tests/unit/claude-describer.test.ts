import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    beta = { messages: { parse } };
  },
}));

const { claudeDescriber, DescriberRefusedError } = await import('@/lib/ai/claude-describer');

const photos = [
  { id: 'p1', angle: 'front' as const, quality: { passed: true, issues: [] }, jpeg: new Uint8Array([0xff, 0xd8, 0xff]) },
];
const items = [{ metric: 'pores' as const, region: 'nose' as const, determinable: true, grade: 3 as const, confidence: 0.6 }];

describe('claudeDescriber（API は呼ばずに、送る内容と結果の処理を確認）', () => {
  it('写真・指示・フォールバックを付けて送り、禁止表現を取り除いて返す', async () => {
    parse.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      model: 'claude-opus-5-5',
      parsed_output: {
        summary: '全体的に明るい印象に見えます。これは湿疹です。',
        observations: [
          { metric: 'pores', note: '鼻のまわりの毛穴がやや目立つように見えます。' },
          { metric: 'redness', note: '肌年齢は若く見えます。' },
        ],
        photo_condition_notes: '右側に影があります。',
        self_care_tips: ['保湿を心がけましょう。', '必ず効く美容液を使いましょう。'],
        suggest_medical_consult: false,
        medical_consult_reason: '',
      },
    });
    const d = await claudeDescriber.describe({ photos, items });

    const req = parse.mock.calls[0][0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.fallbacks).toBe('default');
    expect(req.betas).toContain('server-side-fallback-2026-07-01');
    expect(req.system).toContain('病名');
    const content = req.messages[0].content;
    expect(content.some((c: { type: string }) => c.type === 'image')).toBe(true);
    expect(JSON.stringify(content)).not.toMatch(/氏名|電話|メール/);

    expect(d.provider).toBe('anthropic');
    expect(d.summary).toBe('全体的に明るい印象に見えます。');
    expect(d.itemNotes).toEqual([{ metric: 'pores', note: '毛穴の目立ち：鼻のまわりの毛穴がやや目立つように見えます。' }]);
    expect(d.selfCareInfo).toBe('・保湿を心がけましょう。');
    expect(d.filteredCount).toBe(3);
  });

  it('断られた場合はエラーにする（呼び出し側で AI なしの説明文に切り替える）', async () => {
    parse.mockResolvedValueOnce({ stop_reason: 'refusal', parsed_output: null, model: 'claude-opus-5-5' });
    await expect(claudeDescriber.describe({ photos, items })).rejects.toBeInstanceOf(DescriberRefusedError);
  });
});
