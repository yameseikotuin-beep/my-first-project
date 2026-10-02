import type { Food, NutritionTargets, Recipe } from '../types'
import { KCAL_PER_G } from './nutrition'

export interface Feasibility {
  feasible: boolean
  reasons: string[]
  suggestions: string[]
}

const ceil10 = (x: number) => Math.ceil(x / 10) * 10
const floor1 = (x: number) => Math.floor(x)

/**
 * 栄養学的に実現できるかを、生成前に食品データから判定する。
 * ここで不可能と判定した条件ではレシピを生成しない。
 */
export function checkFeasibility(t: NutritionTargets, usableFoods: Food[]): Feasibility {
  const reasons: string[] = []
  const suggestions: string[] = []

  if (!(t.maxCalories > 0)) {
    return { feasible: false, reasons: ['カロリー上限が指定されていません。'], suggestions: ['1食あたり200〜800kcal程度を目安に指定してください。'] }
  }
  if (t.maxCalories < 50) {
    reasons.push(`${t.maxCalories}kcalは1食分として現実的な量になりません。`)
    suggestions.push('カロリー上限を100kcal以上（間食）または300kcal以上（主食事）にしてください。')
  }

  // タンパク質：最もエネルギー効率よくタンパク質をとれる食品でも必要なカロリー
  const proteinFoods = usableFoods.filter((f) => f.protein >= 5 && !f.estimated)
  const p = t.protein
  if (p && (p.mode === 'min' || p.mode === 'target') && p.value > 0 && proteinFoods.length) {
    const best = proteinFoods.reduce((a, b) => (a.calories / a.protein <= b.calories / b.protein ? a : b))
    const kcalPerG = best.calories / best.protein
    const minKcal = p.value * kcalPerG
    if (minKcal > t.maxCalories) {
      reasons.push(
        `タンパク質${p.value}gをとるには、最もカロリー効率の良い「${best.displayName}」だけを使っても約${Math.round(minKcal)}kcalが必要で、上限${t.maxCalories}kcalを超えます。`,
      )
      suggestions.push(`カロリー上限を${ceil10(minKcal * 1.2)}kcal以上に増やす（野菜・調味料の分を含めた目安）`)
      suggestions.push(`タンパク質の目標を${floor1((t.maxCalories * 0.8) / kcalPerG)}g以下に下げる`)
    }
  }

  const f = t.fat
  if (f && (f.mode === 'max' || f.mode === 'target') && f.value < 1) {
    reasons.push('肉・魚・大豆製品・野菜にも微量の脂質が含まれるため、脂質を0gにすることはできません。')
    suggestions.push(`脂質の上限を${Math.max(3, Math.round((t.maxCalories * 0.1) / KCAL_PER_G.fat))}g以上にする（カロリーの10%程度が目安）`)
  }

  const c = t.carbohydrates
  if (c && c.mode === 'min' && p && p.mode === 'min') {
    const need = p.value * KCAL_PER_G.protein + c.value * KCAL_PER_G.carbohydrates
    if (need > t.maxCalories) {
      reasons.push(`タンパク質${p.value}g以上と炭水化物${c.value}g以上だけで約${need}kcalになり、上限${t.maxCalories}kcalを超えます。`)
      suggestions.push(`カロリー上限を${ceil10(need * 1.15)}kcal以上にする、またはどちらかの目標を下げる`)
    }
  }

  // PFC（グラム）から計算されるエネルギーが上限と大きく食い違う場合
  if (p && f && c && p.mode !== 'max' && c.mode !== 'max' && f.mode !== 'min') {
    const implied = p.value * 4 + (f.mode === 'target' ? f.value * 9 : 0) + c.value * 4
    if (implied > t.maxCalories * 1.15 && reasons.length === 0) {
      reasons.push(`指定したPFCの合計エネルギー（約${Math.round(implied)}kcal）がカロリー上限（${t.maxCalories}kcal）を大きく超えています。`)
      suggestions.push(`カロリー上限を${ceil10(implied)}kcal程度にするか、炭水化物の目標を下げる`)
    }
  }

  return { feasible: reasons.length === 0, reasons, suggestions }
}

/** 生成したが条件を満たせなかったレシピから、具体的な緩和案を作る */
export function suggestionsFromRecipe(r: Recipe): string[] {
  const out: string[] = []
  const t = r.targets
  const n = r.nutrition
  if (n.calories > t.maxCalories) out.push(`カロリー上限を${ceil10(n.calories)}kcalに増やす`)
  if (t.protein?.mode === 'min' && n.protein < t.protein.value) {
    out.push(`タンパク質の目標を${floor1(n.protein)}gに下げる`)
    out.push(`カロリー上限を${ceil10(t.maxCalories + (t.protein.value - n.protein) * 4.5 + 20)}kcal程度に増やす`)
  }
  if (t.fat?.mode === 'max' && n.fat > t.fat.value) out.push(`脂質の上限を${Math.ceil(n.fat)}gに上げる、または脂質の少ない食材に置き換える`)
  if (t.carbohydrates?.mode === 'max' && n.carbohydrates > t.carbohydrates.value) out.push(`炭水化物の上限を${Math.ceil(n.carbohydrates)}gに上げる、または主食を減らす`)
  const coverage = r.validation.checks.find((c) => c.key === 'coverage' && !c.ok)
  if (coverage) out.push('成分データのない食材を、食材データベースの食品から選び直すか、推定値として登録する')
  return [...new Set(out)]
}
