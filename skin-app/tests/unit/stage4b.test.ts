import { describe, expect, it } from 'vitest';
import {
  counselingSchema,
  findBannedTerm,
  intakeSchema,
  measurementSchema,
  menuSchema,
  nowTokyoLocal,
  proposalSchema,
  readIntakeAnswers,
  tokyoLocalToIso,
  treatmentSchema,
} from '@/features/salon/schema';
import { buildProposalDraft } from '@/features/salon/proposal-template';

const menu = { name: 'フェイシャル', description: '肌を整えるお手入れです。', cautions: '', price_yen: 8800, duration_min: 60 };

describe('施術メニューの入力', () => {
  it('料金・所要時間を数値にする', () => {
    const r = menuSchema.parse({ name: 'ピーリング', priceYen: '6000', durationMin: '45', isActive: 'false' });
    expect(r).toMatchObject({ priceYen: 6000, durationMin: 45, isActive: false, description: '' });
  });
  it('所要時間は空でもよい', () => {
    expect(menuSchema.parse({ name: 'a', priceYen: '0' }).durationMin).toBeNull();
  });
  it('マイナスや小数の料金は受け付けない', () => {
    expect(menuSchema.safeParse({ name: 'a', priceYen: '-1' }).success).toBe(false);
    expect(menuSchema.safeParse({ name: 'a', priceYen: '10.5' }).success).toBe(false);
  });
  it('説明に効果の断定や医療的な表現は使えない', () => {
    expect(menuSchema.safeParse({ name: 'a', priceYen: '1', description: '必ず毛穴が消えます' }).success).toBe(false);
    expect(menuSchema.safeParse({ name: 'a', priceYen: '1', description: 'ニキビを治療します' }).success).toBe(false);
  });
  it('注意事項には「治療中の方は」などを書ける', () => {
    expect(menuSchema.safeParse({ name: 'a', priceYen: '1', cautions: '皮膚科で治療中の方はご相談ください' }).success).toBe(true);
  });
});

describe('問診', () => {
  const base = { skinFeel: '乾燥しやすい', productTrouble: 'いいえ', recentProcedures: 'わからない', underTreatment: 'いいえ' };
  it('選択肢から選んだ回答を受け付ける', () => {
    const r = intakeSchema.parse({ ...base, concerns: ['毛穴', '乾燥感'] });
    expect(r.concerns).toEqual(['毛穴', '乾燥感']);
    expect(r.wishes).toBe('');
  });
  it('選択肢にない値は受け付けない', () => {
    expect(intakeSchema.safeParse({ ...base, concerns: ['病名'] }).success).toBe(false);
    expect(intakeSchema.safeParse({ ...base, underTreatment: 'たぶん' }).success).toBe(false);
  });
  it('必須の質問が抜けていればエラー', () => {
    expect(intakeSchema.safeParse({ concerns: [] }).success).toBe(false);
  });
  it('保存された回答の形が違えば null', () => {
    expect(readIntakeAnswers({ foo: 1 })).toBeNull();
    expect(readIntakeAnswers(null)).toBeNull();
    expect(readIntakeAnswers({ ...base, concerns: [] })?.skinFeel).toBe('乾燥しやすい');
  });
});

describe('カウンセリング・施術案内', () => {
  it('ご提案に効果の断定は書けない', () => {
    expect(counselingSchema.safeParse({ proposal: '確実に若返ります' }).success).toBe(false);
    expect(counselingSchema.safeParse({ proposal: '保湿中心のメニューをご提案' }).success).toBe(true);
  });
  it('案内文に禁止表現があれば承認できない', () => {
    expect(proposalSchema.safeParse({ finalText: 'シミが治ります', intent: 'approve' }).success).toBe(false);
    expect(findBannedTerm('ご案内です')).toBeNull();
    expect(findBannedTerm('肌年齢が下がる')).toBe('肌年齢');
  });
  it('メニューの ID は UUID だけ', () => {
    expect(proposalSchema.safeParse({ menuIds: ['x'], finalText: '', intent: 'save' }).success).toBe(false);
  });
});

describe('施術案内の下書き（テンプレート）', () => {
  it('メニューの名前・料金・時間・注意事項を入れる', () => {
    const { text } = buildProposalDraft({
      customerName: '山田 花子',
      menus: [{ ...menu, cautions: '施術後は日焼けにご注意ください' }],
      concerns: ['毛穴'],
      underTreatment: false,
    });
    expect(text).toContain('山田 花子 様');
    expect(text).toContain('■ フェイシャル　8,800円（税込）・約60分');
    expect(text).toContain('ご注意：施術後は日焼けにご注意ください');
    expect(text).toContain('お伺いしたお悩み：毛穴');
    expect(text).not.toContain('医師');
  });
  it('説明に紛れた効果の断定は取り除く', () => {
    const r = buildProposalDraft({
      customerName: 'A',
      menus: [{ ...menu, description: 'やさしいお手入れです。必ず毛穴が消えます。' }],
      concerns: [],
      underTreatment: false,
    });
    expect(r.text).toContain('やさしいお手入れです。');
    expect(r.text).not.toContain('必ず');
    expect(r.removed).toBe(1);
  });
  it('通院中なら医師への確認を案内する（注意事項は検査で消さない）', () => {
    const { text } = buildProposalDraft({
      customerName: 'A',
      menus: [{ ...menu, cautions: '治療中の方はご相談ください' }],
      concerns: [],
      underTreatment: true,
    });
    expect(text).toContain('かかりつけの医師にご確認ください');
    expect(text).toContain('治療中の方はご相談ください');
  });
  it('分析がモックの間は、分析の傾向を書かない', () => {
    const input = { customerName: 'A', menus: [menu], concerns: [], underTreatment: false, averages: { pores: 4.2 } };
    expect(buildProposalDraft({ ...input, analysisValidated: false }).text).not.toContain('写真の見た目');
    expect(buildProposalDraft({ ...input, analysisValidated: true }).text).toContain('「毛穴の目立ち」の項目が高めでした');
  });
});

describe('施術の記録', () => {
  it('前後の撮影は空でもよい', () => {
    const r = treatmentSchema.parse({ menuId: '6f1c1f9e-8f3a-4b8e-9a43-2f1f9b1c3d4e', beforeSessionId: '', afterSessionId: '' });
    expect(r.beforeSessionId).toBeNull();
  });
  it('メニューは必須', () => {
    expect(treatmentSchema.safeParse({ menuId: '' }).success).toBe(false);
  });
});

describe('機器の実測値', () => {
  const ok = { deviceName: '測定器', metric: '水分', value: '42.5', unit: '%', measuredAt: '2026-10-07T10:30', visitId: '' };
  it('数値と日本時間の日時を受け付ける', () => {
    const r = measurementSchema.parse(ok);
    expect(r.value).toBe(42.5);
    expect(r.visitId).toBeNull();
    expect(tokyoLocalToIso(r.measuredAt)).toBe('2026-10-07T01:30:00.000Z');
  });
  it('数値でない値は受け付けない', () => {
    expect(measurementSchema.safeParse({ ...ok, value: 'たかい' }).success).toBe(false);
    expect(measurementSchema.safeParse({ ...ok, value: '1.2345' }).success).toBe(false);
  });
  it('現在時刻を日本時間で返す', () => {
    expect(nowTokyoLocal(new Date('2026-10-06T16:05:00Z'))).toBe('2026-10-07T01:05');
  });
});
