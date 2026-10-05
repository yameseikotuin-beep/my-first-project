import { filterText } from '@/lib/ai/safety';
import { metricLabels } from '@/lib/analysis/labels';
import type { Metric } from '@/lib/analysis/types';

// 施術案内文の下書き（AI を使わないテンプレート）
// - 管理者が登録したメニューの名前・説明・料金・注意事項だけを使う
// - 効果の約束や医療的な判断はしない。禁止表現を含む文は取り除く
// - スタッフが確認・編集してから承認する

export type ProposalMenu = {
  name: string;
  description: string;
  cautions: string;
  price_yen: number;
  duration_min: number | null;
};

export type ProposalInput = {
  customerName: string;
  menus: ProposalMenu[];
  concerns: string[];
  /** 最新の分析の項目別平均（モックの間は使わない） */
  averages?: Partial<Record<Metric, number | null>> | null;
  analysisValidated?: boolean;
  underTreatment: boolean;
};

const yen = new Intl.NumberFormat('ja-JP');

export function buildProposalDraft(input: ProposalInput): { text: string; removed: number } {
  let removed = 0;
  // 説明文など、効果の断定が紛れ込みうる文だけを検査する（注意事項・定型の案内は検査しない）
  const checked = (value: string) => {
    const r = filterText(value);
    removed += r.removed;
    return r.text;
  };

  const lines: string[] = [];
  lines.push(`${input.customerName} 様`);
  lines.push('');
  lines.push('本日はご来店ありがとうございます。カウンセリングの内容をもとに、次のメニューをご案内します。');

  if (input.concerns.length > 0) {
    lines.push('');
    lines.push(`お伺いしたお悩み：${input.concerns.join('、')}`);
  }

  if (input.analysisValidated && input.averages) {
    const notable = (Object.entries(input.averages) as [Metric, number | null][])
      .filter(([, v]) => v !== null && v >= 3.5)
      .map(([m]) => metricLabels[m]);
    if (notable.length > 0) {
      lines.push(`写真の見た目の推定では、「${notable.join('」「')}」の項目が高めでした（診断ではありません）。`);
    }
  }

  if (input.menus.length === 0) {
    lines.push('');
    lines.push('（メニューを選んでください）');
  }
  for (const m of input.menus) {
    lines.push('');
    const meta = [`${yen.format(m.price_yen)}円（税込）`, m.duration_min ? `約${m.duration_min}分` : null].filter(Boolean);
    lines.push(`■ ${m.name}　${meta.join('・')}`);
    const description = checked(m.description);
    if (description) lines.push(description);
    if (m.cautions) lines.push(`ご注意：${m.cautions}`);
  }

  lines.push('');
  lines.push('仕上がりの感じ方には個人差があります。施術中に違和感があれば、すぐにお知らせください。');
  if (input.underTreatment) {
    lines.push('通院中とのことですので、施術を受けてよいか、事前にかかりつけの医師にご確認ください。');
  }
  return { text: lines.join('\n'), removed };
}
