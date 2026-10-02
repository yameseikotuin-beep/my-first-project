import type { CheckResult, Nutrition, NutritionTargets, RecipeIngredient, Validation } from '../types'
import type { FoodDb } from './foodDb'
import { round1 } from './nutrition'
import { targetTolerance } from './optimizer'

const NUTRIENT_LABEL = { protein: 'タンパク質', fat: '脂質', carbohydrates: '炭水化物' } as const

/** 1人前あたりの現実的な上限（g） */
export const MAX_SERVING_WEIGHT = 900
export const MAX_MAIN_PROTEIN = 300

export function validateRecipe(
  db: FoodDb,
  n: Nutrition,
  ingredients: RecipeIngredient[],
  steps: string[],
  t: NutritionTargets,
): Validation {
  const checks: CheckResult[] = []

  checks.push({
    key: 'calories',
    label: `カロリー ${t.maxCalories}kcal以内`,
    ok: n.calories <= t.maxCalories,
    level: 'hard',
    detail: `${Math.round(n.calories)}kcal（${n.calories <= t.maxCalories ? `残り${Math.round(t.maxCalories - n.calories)}kcal` : `${Math.round(n.calories - t.maxCalories)}kcal超過`}）`,
  })

  for (const key of ['protein', 'fat', 'carbohydrates'] as const) {
    const c = t[key]
    if (!c) continue
    const v = n[key]
    const label = NUTRIENT_LABEL[key]
    if (c.mode === 'min') {
      checks.push({ key, label: `${label} ${c.value}g以上`, ok: v >= c.value, level: 'hard', detail: `${round1(v)}g（${v >= c.value ? '達成' : `${round1(c.value - v)}g不足`}）` })
    } else if (c.mode === 'max') {
      checks.push({ key, label: `${label} ${c.value}g以下`, ok: v <= c.value, level: 'hard', detail: `${round1(v)}g（${v <= c.value ? '達成' : `${round1(v - c.value)}g超過`}）` })
    } else {
      const tol = targetTolerance(c.value)
      const diff = v - c.value
      checks.push({
        key,
        label: `${label} 目標${c.value}g（±${round1(tol)}g）`,
        ok: Math.abs(diff) <= tol,
        level: 'soft',
        detail: `${round1(v)}g（目標との差 ${diff >= 0 ? '+' : ''}${round1(diff)}g）`,
      })
    }
  }

  const missing = ingredients.filter((i) => !db.get(i.foodId))
  checks.push({
    key: 'coverage',
    label: 'すべての食材・調味料が栄養計算に含まれている',
    ok: missing.length === 0,
    level: 'hard',
    detail: missing.length ? `成分データがない食材: ${missing.map((m) => m.name).join('、')}` : `${ingredients.length}品目すべて計算済み`,
  })

  const stateMismatch = ingredients.filter((i) => {
    const food = db.get(i.foodId)
    return food && i.foodState && food.state !== i.foodState
  })
  checks.push({
    key: 'state',
    label: '食品の状態（生・ゆで等）がデータと一致している',
    ok: stateMismatch.length === 0,
    level: 'hard',
    detail: stateMismatch.length ? stateMismatch.map((i) => `${i.name}: 指定「${i.foodState}」/データ「${db.get(i.foodId)?.state}」`).join('、') : '一致',
  })

  const outOfRange = ingredients.filter((i) => !i.fixed && i.bounds && i.amountG > 0 && (i.amountG < i.bounds.min || i.amountG > i.bounds.max))
  const totalWeight = ingredients.reduce((s, i) => s + i.amountG, 0)
  const bigProtein = ingredients.filter((i) => i.role === 'protein' && i.amountG > MAX_MAIN_PROTEIN)
  const negative = ingredients.filter((i) => !(i.amountG >= 0))
  const realistic = outOfRange.length === 0 && totalWeight <= MAX_SERVING_WEIGHT && bigProtein.length === 0 && negative.length === 0
  checks.push({
    key: 'weight',
    label: '食材の重量が現実的',
    ok: realistic,
    level: 'hard',
    detail: realistic
      ? `1人前の総重量 ${Math.round(totalWeight)}g`
      : [
          outOfRange.length ? `範囲外: ${outOfRange.map((i) => `${i.name} ${i.amountG}g`).join('、')}` : '',
          totalWeight > MAX_SERVING_WEIGHT ? `総重量${Math.round(totalWeight)}gは1人前として多すぎる` : '',
          bigProtein.length ? `主菜の量が多すぎる: ${bigProtein.map((i) => i.name).join('、')}` : '',
          negative.length ? '不正な重量があります' : '',
        ].filter(Boolean).join(' / '),
  })

  const stepsOk = steps.length >= 2 && steps.every((s) => s.trim().length > 0) && !steps.some((s) => /\{[a-z0-9]+\}/.test(s))
  checks.push({ key: 'steps', label: '調理手順が実行可能', ok: stepsOk, level: 'hard', detail: stepsOk ? `${steps.length}工程` : '手順が不足しているか、未確定の項目があります' })

  const estimated = ingredients.filter((i) => db.get(i.foodId)?.estimated)
  checks.push({
    key: 'estimated',
    label: '成分表に基づく値のみで計算',
    ok: estimated.length === 0,
    level: 'quality',
    detail: estimated.length ? `推定値を含む: ${estimated.map((i) => i.name).join('、')}` : '推定値なし',
  })

  const hardFail = checks.some((c) => c.level === 'hard' && !c.ok)
  const softFail = checks.some((c) => c.level !== 'hard' && !c.ok)
  const status = hardFail ? 'failed' : softFail ? 'partial' : 'ok'
  const messages: string[] = []
  if (status === 'failed') messages.push('このレシピは指定条件を満たしていません。')
  if (status === 'partial') messages.push('必須条件は満たしていますが、目標値との差が許容範囲を超えている項目があります。')
  return { status, checks, messages }
}
