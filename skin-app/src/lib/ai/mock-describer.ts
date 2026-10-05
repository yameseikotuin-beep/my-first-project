import { metricLabels, regionLabels, gradeLabels } from '@/lib/analysis/labels';
import { METRICS } from '@/lib/analysis/types';
import type { VisualDescriber } from './description';

// AI を使わない仮の説明文。特徴抽出（モック）の結果を言葉に置き換えるだけで、写真は見ていない。
export const mockDescriber: VisualDescriber = {
  info: { name: 'mock-template', version: '0.1.0', validated: false, provider: 'mock' },

  async describe({ items }) {
    const itemNotes = METRICS.map((metric) => {
      const graded = items.filter((i) => i.metric === metric && i.determinable && i.grade !== null);
      if (graded.length === 0) return { metric, note: '判定できる部位がありませんでした。' };
      const top = [...graded].sort((a, b) => (b.grade ?? 0) - (a.grade ?? 0))[0];
      return {
        metric,
        note: `（仮の値）${regionLabels[top.region]}で「${gradeLabels[top.grade!]}」と評価されています。`,
      };
    });
    return {
      summary:
        'これは AI を使わずに作った仮の説明文です。写真の内容を見て書いたものではありません。各項目の評価もモック（未検証）の仮の値です。',
      itemNotes: itemNotes.map((n) => ({ ...n, note: `${metricLabels[n.metric]}：${n.note}` })),
      cautions: '照明・角度・メイク・カメラの性能によって、見え方は大きく変わります。',
      selfCareInfo:
        '一般的なセルフケアとして、洗顔後の保湿、日中の紫外線対策、十分な睡眠が挙げられます。肌に合わないと感じるものは使用を控えてください。',
      suggestMedicalConsult: false,
      provider: 'mock',
      model: null,
      promptVersion: 'mock-v1',
      filteredCount: 0,
    };
  },
};
