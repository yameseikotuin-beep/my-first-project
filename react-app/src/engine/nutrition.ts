import type { Food, Nutrition, PfcRatio, RecipeIngredient } from '../types'
import type { FoodDb } from './foodDb'

export const KCAL_PER_G = { protein: 4, fat: 9, carbohydrates: 4 } as const

export const ZERO: Nutrition = { calories: 0, protein: 0, fat: 0, carbohydrates: 0, fiber: 0, salt: 0 }

/** 栄養成分値 × 使用重量 ÷ 基準重量 */
export function nutritionFor(food: Food, grams: number): Nutrition {
  const k = grams / food.referenceWeight
  return {
    calories: food.calories * k,
    protein: food.protein * k,
    fat: food.fat * k,
    carbohydrates: food.carbohydrates * k,
    fiber: (food.fiber ?? 0) * k,
    salt: (food.salt ?? 0) * k,
  }
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbohydrates: a.carbohydrates + b.carbohydrates,
    fiber: a.fiber + b.fiber,
    salt: a.salt + b.salt,
  }
}

export function scaleNutrition(a: Nutrition, k: number): Nutrition {
  return {
    calories: a.calories * k,
    protein: a.protein * k,
    fat: a.fat * k,
    carbohydrates: a.carbohydrates * k,
    fiber: a.fiber * k,
    salt: a.salt * k,
  }
}

export function sumNutrition(list: Nutrition[]): Nutrition {
  return list.reduce(addNutrition, ZERO)
}

/** P・F・Cから算出したエネルギー（比率算出用。正式な表示値は成分表のエネルギー） */
export function pfcEnergy(n: Nutrition): number {
  return n.protein * KCAL_PER_G.protein + n.fat * KCAL_PER_G.fat + n.carbohydrates * KCAL_PER_G.carbohydrates
}

/** PFCエネルギー比率（%）。合計100%になるようPFC由来エネルギーを分母にする */
export function pfcRatio(n: Nutrition): PfcRatio {
  const total = pfcEnergy(n)
  if (total <= 0) return { protein: 0, fat: 0, carbohydrates: 0 }
  return {
    protein: (n.protein * KCAL_PER_G.protein * 100) / total,
    fat: (n.fat * KCAL_PER_G.fat * 100) / total,
    carbohydrates: (n.carbohydrates * KCAL_PER_G.carbohydrates * 100) / total,
  }
}

/** エネルギー比率（%）とカロリーからグラム数へ換算 */
export function gramsFromRatio(calories: number, ratio: PfcRatio): { protein: number; fat: number; carbohydrates: number } {
  return {
    protein: (calories * ratio.protein) / 100 / KCAL_PER_G.protein,
    fat: (calories * ratio.fat) / 100 / KCAL_PER_G.fat,
    carbohydrates: (calories * ratio.carbohydrates) / 100 / KCAL_PER_G.carbohydrates,
  }
}

export interface IngredientCalc {
  /** 1人前あたり */
  total: Nutrition
  /** 栄養値が計算に含まれていない食材 */
  missing: string[]
  /** 推定値を含む食材 */
  estimated: string[]
}

/** 材料（1人前の重量）から栄養値を計算し、各材料にも栄養値を格納する */
export function calculateIngredients(db: FoodDb, ingredients: RecipeIngredient[]): { ingredients: RecipeIngredient[]; calc: IngredientCalc } {
  const missing: string[] = []
  const estimated: string[] = []
  const updated = ingredients.map((ing) => {
    const food = db.get(ing.foodId)
    if (!food) {
      missing.push(ing.name)
      return { ...ing, nutrition: null }
    }
    if (food.estimated) estimated.push(ing.name)
    return { ...ing, nutrition: nutritionFor(food, ing.amountG), foodState: ing.foodState ?? food.state, estimated: food.estimated }
  })
  const total = sumNutrition(updated.flatMap((i) => (i.nutrition ? [i.nutrition] : [])))
  return { ingredients: updated, calc: { total, missing, estimated } }
}

export const round1 = (x: number) => Math.round(x * 10) / 10
export const round0 = (x: number) => Math.round(x)

export function roundNutrition(n: Nutrition): Nutrition {
  return {
    calories: round0(n.calories),
    protein: round1(n.protein),
    fat: round1(n.fat),
    carbohydrates: round1(n.carbohydrates),
    fiber: round1(n.fiber),
    salt: round1(n.salt),
  }
}
