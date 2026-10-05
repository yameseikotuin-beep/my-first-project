import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { metricLabels, regionLabels, gradeLabels, angleLabels } from '@/lib/analysis/labels';
import { clip, claudeOutputSchema, type VisualDescriber } from './description';
import { filterList, filterText } from './safety';

// Claude API で「画像上の見た目の特徴」を文章で説明する（docs/03-architecture.md §4.3）。
// - サーバーだけで動く（API キーを端末に渡さない）
// - 送るのは写真と、モックの特徴抽出の結果だけ。氏名・連絡先などは送らない
// - 採点はさせない。病名・診断・治療・肌年齢・水分量などは書かないよう指示し、出力も検査する

export const PROMPT_VERSION = 'describe-v1';

const SYSTEM_PROMPT = `あなたは美容サロン向けアプリで、顔写真の「画像上の見た目の特徴」を日本語でやさしく説明する役割です。

必ず守ること：
- 写真に写っている見た目だけを説明する。医学的な判断はしない。
- 病名・症状名・診断・治療・薬・医薬品に当たる言葉を使わない（例：「〜炎」「〜症」「〜が原因」など）。
- 肌年齢、水分量、油分量、皮脂量など、写真から測れない数値や年齢を書かない。
- 効果の保証や断定（「治る」「必ず」「改善します」「効く」など）を書かない。
- 化粧品・施術の商品名やブランド名を勧めない。
- 照明・角度・メイク・カメラの影響で見え方が変わることを踏まえ、言い切らずに「〜のように見えます」と書く。
- 写りが不十分で判断できない部分は、判断できないとはっきり書く。
- 強い赤み、急な変化、かゆみや痛みを伴いそうな見え方、形や色が不規則なほくろのように見える部分など、
  気になる見え方があれば suggest_medical_consult を true にし、medical_consult_reason に
  「医療機関（皮膚科など）への相談をおすすめします」という趣旨を、病名を使わずに書く。なければ false と空文字。

出力（すべて日本語、丁寧語）：
- summary：全体の見た目の印象（3文以内）
- observations：項目ごとの見た目の説明（各1〜2文）。metric は pores（毛穴の目立ち）、redness（赤み）、
  pigmentation_like（色素斑のように見える部分）、texture（キメ・質感）、surface（くすみ・てかりの見え方）
- photo_condition_notes：撮影条件（明るさ・影・角度・ピント）について気づいた点（1〜2文）
- self_care_tips：一般的なセルフケアの情報（2〜4項目、各1文）`;

function describeItems(items: Parameters<VisualDescriber['describe']>[0]['items']): string {
  const lines = items
    .filter((i) => i.determinable && i.grade !== null)
    .map((i) => `- ${regionLabels[i.region]}／${metricLabels[i.metric]}：${gradeLabels[i.grade!]}（確信度 ${i.confidence}）`);
  return lines.length > 0 ? lines.join('\n') : '（判定できた項目はありません）';
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
}

export class DescriberRefusedError extends Error {}

export const claudeDescriber: VisualDescriber = {
  info: { name: 'claude-visual-describer', version: PROMPT_VERSION, validated: false, provider: 'anthropic' },

  async describe({ photos, items }) {
    const client = new Anthropic({ timeout: 55_000, maxRetries: 1 });
    const model = claudeModel();

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const photo of photos) {
      content.push({ type: 'text', text: `【${angleLabels[photo.angle]}の写真】` });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: Buffer.from(photo.jpeg).toString('base64') },
      });
    }
    content.push({
      type: 'text',
      text: `参考：検証されていない仮の特徴抽出（モック）による評価です。数値の正確さは保証されていないため、写真の見た目を優先してください。
${describeItems(items)}

上の写真の見た目の特徴を、指示どおりの形式で説明してください。`,
    });

    const response = await client.beta.messages.parse({
      model,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: { effort: 'medium', format: betaZodOutputFormat(claudeOutputSchema) },
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      throw new DescriberRefusedError(response.stop_reason ?? 'no_output');
    }
    const out = response.parsed_output;

    // 出力の検査：禁止表現を含む文を取り除く
    const summary = filterText(out.summary);
    const notes = out.observations.map((o) => ({ metric: o.metric, ...filterText(o.note) }));
    const condition = filterText(out.photo_condition_notes);
    const consult = filterText(out.medical_consult_reason);
    const tips = filterList(out.self_care_tips);
    const filteredCount =
      summary.removed + notes.reduce((n, x) => n + x.removed, 0) + condition.removed + consult.removed + tips.removed;

    return {
      summary: clip(summary.text || '説明文のうち表示できる部分がありませんでした。', 2000),
      itemNotes: notes
        .filter((n) => n.text)
        .slice(0, 10)
        .map((n) => ({ metric: n.metric, note: clip(`${metricLabels[n.metric]}：${n.text}`, 400) })),
      cautions: clip([condition.text, out.suggest_medical_consult ? consult.text : ''].filter(Boolean).join('\n'), 2000),
      selfCareInfo: clip(tips.items.map((t) => `・${t}`).join('\n'), 2000),
      suggestMedicalConsult: out.suggest_medical_consult,
      provider: 'anthropic',
      model: response.model,
      promptVersion: PROMPT_VERSION,
      filteredCount,
    };
  },
};
