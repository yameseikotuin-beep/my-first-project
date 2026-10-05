// AI の出力の検査（docs/05-security.md §7）
// 病名・診断・治療・効果の断定・写真から断定してはいけない数値に当たる表現を含む文を取り除く。
// 一覧は保守的に作っている（取り除きすぎる分には安全側）。

export const BANNED_TERMS: readonly string[] = [
  // 病名・医学的な判断
  '皮膚炎', 'アトピー', '湿疹', '乾癬', '酒さ', '酒皶', '肝斑', '白斑', '腫瘍', '悪性', '良性',
  'がん', '癌', 'メラノーマ', '黒色腫', '感染', '真菌', 'ヘルペス', 'ざ瘡', '疾患', '病気', '症状', '病変',
  '診断', '治療', '処方', '投薬', '医薬品', '薬を', 'ステロイド',
  // 効果の断定
  '治る', '治り', '治せ', '完治', '必ず', '確実に', '効果があり', '効果がある', '効きます', '効く',
  '改善します', '改善できます', '消えます', '消せます', '若返',
  // 写真から断定しない値
  '肌年齢', '水分量', '油分量', '皮脂量', '歳肌',
];

export type FilterResult = { text: string; removed: number };

/** 文単位で分け、禁止表現を含む文を取り除く */
export function filterText(text: string): FilterResult {
  const sentences = text.replace(/\r\n?/g, '\n').split(/(?<=[。！？!?\n])/);
  let removed = 0;
  const kept = sentences.filter((s) => {
    const hit = s.trim().length > 0 && BANNED_TERMS.some((t) => s.includes(t));
    if (hit) removed++;
    return !hit;
  });
  return { text: kept.join('').trim(), removed };
}

export function filterList(items: string[]): { items: string[]; removed: number } {
  let removed = 0;
  const kept: string[] = [];
  for (const item of items) {
    const r = filterText(item);
    removed += r.removed;
    if (r.text) kept.push(r.text);
  }
  return { items: kept, removed };
}
