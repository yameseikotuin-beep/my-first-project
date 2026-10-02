import type { Nutrition, Recipe, RecipeIngredient } from '../types'
import { scaleNutrition } from './nutrition'

export interface ScaledRecipe {
  items: RecipeIngredient[]
  total: Nutrition
  perServing: Nutrition
  notes: string[]
}

/**
 * 人数分の分量に換算する。栄養値はレシピ（1人前）の材料から計算済みの値を
 * 人数倍するだけなので、1人前あたりの値は変わらない。
 */
export function scaledIngredients(r: Recipe): ScaledRecipe {
  const k = r.servings
  const items = r.ingredients.map((i) => ({
    ...i,
    amountG: i.amountG * k,
    nutrition: i.nutrition ? scaleNutrition(i.nutrition, k) : null,
  }))
  const notes: string[] = []
  if (k >= 2) {
    notes.push(`${k}人前の分量です。調味料は人数分に比例させていますが、味を見ながら調整してください（塩分の摂りすぎに注意）。`)
    if (r.method === '電子レンジ') {
      notes.push(`電子レンジの加熱時間は量に比例して長くなります（${k}人前なら1人前の約${(1 + (k - 1) * 0.7).toFixed(1)}倍が目安）。途中で混ぜ、中心まで加熱されているか必ず確認してください。`)
    } else if (r.method === '煮る' || r.method === '蒸す') {
      notes.push('量が増えると煮立つまで・蒸し上がるまでの時間が長くなります。水分量は具材がかぶる程度に調整し、中心まで加熱されているか確認してください。')
    } else if (r.method === '焼く' || r.method === '炒める') {
      notes.push('フライパンに入りきらない場合は2回に分けて焼く・炒めると、温度が下がらず仕上がりがよくなります。')
    }
  }
  return { items, total: scaleNutrition(r.nutrition, k), perServing: r.nutrition, notes }
}
