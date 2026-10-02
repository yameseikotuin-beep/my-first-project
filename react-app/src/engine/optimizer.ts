import type { Food, Nutrition, NutritionTargets } from '../types'
import { nutritionFor, sumNutrition } from './nutrition'

export interface OptItem {
  food: Food | null
  amount: number
  min: number
  max: number
  step: number
  default: number
  fixed: boolean
  optional: boolean
}

/** 目標値（target）として許容する誤差：±10% または ±3g の大きい方 */
export function targetTolerance(value: number): number {
  return Math.max(value * 0.1, 3)
}

export function defaultTargetCalories(t: NutritionTargets): number {
  return t.targetCalories ?? t.maxCalories * 0.95
}

/**
 * 分量の評価値（小さいほど良い）。
 * 必須条件の違反には大きなペナルティ、目標値からのずれには中程度、
 * 既定分量からの乖離（現実的な分量らしさ）と高タンパク・低脂質の好みには小さな重みを付ける。
 */
export function score(n: Nutrition, items: OptItem[], amounts: number[], t: NutritionTargets): number {
  let hard = 0
  if (n.calories > t.maxCalories) hard += (n.calories - t.maxCalories) / 5
  for (const key of ['protein', 'fat', 'carbohydrates'] as const) {
    const c = t[key]
    if (!c) continue
    const v = n[key]
    if (c.mode === 'min' && v < c.value) hard += c.value - v
    if (c.mode === 'max' && v > c.value) hard += v - c.value
  }

  let soft = 0
  const tc = defaultTargetCalories(t)
  soft += (Math.abs(n.calories - tc) / Math.max(tc, 1)) * 6
  for (const key of ['protein', 'fat', 'carbohydrates'] as const) {
    const c = t[key]
    if (!c || c.mode !== 'target') continue
    const dev = Math.abs(n[key] - c.value)
    const tol = targetTolerance(c.value)
    soft += (dev / Math.max(c.value, 1)) * 8 + (dev > tol ? (dev - tol) * 0.5 : 0)
  }

  // 高タンパク・低脂質を優先
  const pref = (n.fat - n.protein) * 0.01

  let realism = 0
  items.forEach((it, i) => {
    if (it.fixed) return
    const range = Math.max(it.max - it.min, it.step)
    realism += (Math.abs(amounts[i] - it.default) / range) * 1.5
  })

  return hard * 1000 + soft + pref + realism
}

function totals(items: OptItem[], amounts: number[]): Nutrition {
  return sumNutrition(items.flatMap((it, i) => (it.food ? [nutritionFor(it.food, amounts[i])] : [])))
}

function neighbors(it: OptItem, a: number): number[] {
  if (it.fixed) return []
  const out = new Set<number>()
  if (it.optional && a === 0) {
    out.add(it.min)
    out.add(it.default > 0 ? it.default : it.min)
  } else {
    for (const k of [1, 2, 5]) {
      out.add(clamp(a + it.step * k, it.min, it.max))
      out.add(clamp(a - it.step * k, it.min, it.max))
    }
    if (it.optional) out.add(0)
  }
  out.delete(a)
  return [...out]
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x))
}

/** 刻み幅に合わせて丸める */
function snap(it: OptItem, a: number): number {
  if (it.fixed) return a
  if (it.optional && a <= 0) return 0
  const s = it.min + Math.round((a - it.min) / it.step) * it.step
  return clamp(s, it.min, it.max)
}

export interface OptResult {
  amounts: number[]
  nutrition: Nutrition
  score: number
}

/**
 * 座標降下法による分量の最適化。複数の初期値から探索し、最良のものを返す。
 * 結果は決定的（乱数を使わない）。
 */
export function optimizeAmounts(items: OptItem[], t: NutritionTargets): OptResult {
  const starts: number[][] = [
    items.map((it) => snap(it, it.amount)),
    items.map((it) => snap(it, it.default)),
    items.map((it) => (it.fixed ? it.amount : it.optional ? 0 : it.min)),
    items.map((it) => (it.fixed ? it.amount : it.food?.role === 'protein' ? it.max : it.optional ? 0 : it.min)),
  ]
  let best: OptResult | null = null
  for (const start of starts) {
    const r = descend(items, start, t)
    if (!best || r.score < best.score) best = r
  }
  return best!
}

function descend(items: OptItem[], start: number[], t: NutritionTargets): OptResult {
  let amounts = [...start]
  let n = totals(items, amounts)
  let s = score(n, items, amounts, t)
  for (let iter = 0; iter < 400; iter++) {
    let improved = false
    let bestMove: { amounts: number[]; n: Nutrition; s: number } | null = null
    items.forEach((it, i) => {
      for (const v of neighbors(it, amounts[i])) {
        const next = [...amounts]
        next[i] = v
        const nn = totals(items, next)
        const ss = score(nn, items, next, t)
        if (ss < s - 1e-9 && (!bestMove || ss < bestMove.s)) bestMove = { amounts: next, n: nn, s: ss }
      }
    })
    if (bestMove) {
      const m = bestMove as { amounts: number[]; n: Nutrition; s: number }
      amounts = m.amounts
      n = m.n
      s = m.s
      improved = true
    }
    if (!improved) break
  }
  return { amounts, nutrition: n, score: s }
}
