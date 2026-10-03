import type { GenerationRequest, MealPlan, MealPlanDay, MealType, Nutrition, PlannedMeal } from '../types'
import type { FoodDb } from './foodDb'
import { generateRecipes } from './generator'
import { sumNutrition, ZERO } from './nutrition'
import { newId } from '../util/id'

export interface MealSlotDef {
  mealType: MealType
  label: string
  share: number
}

/** 食事回数ごとの既定のカロリー配分（%） */
export const MEAL_PRESETS: Record<3 | 4 | 5, MealSlotDef[]> = {
  3: [
    { mealType: '朝食', label: '朝食', share: 25 },
    { mealType: '昼食', label: '昼食', share: 35 },
    { mealType: '夕食', label: '夕食', share: 40 },
  ],
  4: [
    { mealType: '朝食', label: '朝食', share: 25 },
    { mealType: '昼食', label: '昼食', share: 30 },
    { mealType: '間食', label: '間食', share: 10 },
    { mealType: '夕食', label: '夕食', share: 35 },
  ],
  5: [
    { mealType: '朝食', label: '朝食', share: 20 },
    { mealType: '間食', label: '間食（午前）', share: 10 },
    { mealType: '昼食', label: '昼食', share: 30 },
    { mealType: '間食', label: '間食（午後）', share: 10 },
    { mealType: '夕食', label: '夕食', share: 30 },
  ],
}

export interface DailyTargets {
  calories: number
  protein: number
  fat: number
  carbohydrates: number
}

export interface MealPlanInput {
  name: string
  daily: DailyTargets
  meals: (MealSlotDef & { eatingOut: boolean })[]
  days: number
  startDate: string
  base: Pick<GenerationRequest, 'genre' | 'maxTime' | 'avoidFoods' | 'avoidAllergens' | 'useFoods' | 'method'>
  userId: string | null
  /** 作り直すたびに変えると、別の料理の組み合わせになる */
  variation?: number
  /** 使わない料理の型（作り直す前の献立と違う料理にするため）。候補がなくなる場合は使う */
  avoidTemplates?: string[]
}

/**
 * 1日の食事プランを作る。食事ごとに残りの目標値を配分して順にレシピを生成し、
 * 前の食事の過不足を後の食事で調整する。
 */
export function generateMealPlan(db: FoodDb, input: MealPlanInput): MealPlan {
  const days: MealPlanDay[] = []
  let previousTemplates: string[] = input.avoidTemplates ?? []
  for (let d = 0; d < input.days; d++) {
    const date = addDays(input.startDate, d)
    const used: string[] = []
    const meals: PlannedMeal[] = []
    const remaining = { ...input.daily }
    let remainingShare = input.meals.reduce((s, m) => s + m.share, 0)
    for (const m of input.meals) {
      const k = remainingShare > 0 ? m.share / remainingShare : 0
      const budget = {
        calories: Math.max(0, remaining.calories * k),
        protein: Math.max(0, remaining.protein * k),
        fat: Math.max(0, remaining.fat * k),
        carbohydrates: Math.max(0, remaining.carbohydrates * k),
      }
      remainingShare -= m.share
      if (m.eatingOut) {
        meals.push({ mealType: m.mealType, label: m.label, share: m.share, eatingOut: true, budget, recipe: null, error: null })
        subtract(remaining, budget)
        continue
      }
      const req: GenerationRequest = {
        mode: input.base.useFoods.length ? 'ingredients' : 'calorie',
        targets: {
          maxCalories: Math.round(budget.calories * 1.08),
          targetCalories: budget.calories,
          protein: { mode: 'target', value: Math.round(budget.protein) },
          fat: { mode: 'target', value: Math.round(budget.fat) },
          carbohydrates: { mode: 'target', value: Math.round(budget.carbohydrates) },
        },
        mealType: m.mealType,
        genre: input.base.genre,
        method: input.base.method,
        maxTime: input.base.maxTime,
        servings: 1,
        useFoods: input.base.useFoods,
        useUpFoods: [],
        avoidFoods: input.base.avoidFoods,
        avoidAllergens: input.base.avoidAllergens,
        extraPolicy: 'allow',
        allowedSeasonings: [],
        variation: d + (input.variation ?? 0),
        excludeTemplates: [...used, ...previousTemplates],
        // 800kcalを超える食事は、それに見合う量まで分量の上限を広げる
        portionScale: Math.min(Math.max(budget.calories / 800, 1), 1.5),
      }
      let result = generateRecipes(db, req, 1)
      // 種類の重複回避で候補がなくなった場合は、重複を許して再試行
      if (result.recipes.length === 0) result = generateRecipes(db, { ...req, excludeTemplates: used }, 1)
      if (result.recipes.length === 0 && req.mode === 'ingredients') result = generateRecipes(db, { ...req, mode: 'calorie', excludeTemplates: used }, 1)
      // 条件をゆるめる（タンパク質の下限を外す）
      if (result.recipes.length === 0) result = generateRecipes(db, { ...req, mode: 'calorie', excludeTemplates: [], targets: { ...req.targets, protein: undefined } }, 1)
      const recipe = result.recipes[0] ?? null
      if (recipe) {
        recipe.userId = input.userId
        if (recipe.templateId) used.push(recipe.templateId)
        subtract(remaining, recipe.nutrition)
      }
      meals.push({
        mealType: m.mealType, label: m.label, share: m.share, eatingOut: false, budget, recipe,
        error: recipe ? null : [...result.reasons, ...result.suggestions].join(' ') || 'この食事のレシピを作成できませんでした。',
      })
    }
    previousTemplates = used
    days.push({ date, meals, totals: dayTotals(meals) })
  }
  return { id: newId(), userId: input.userId, name: input.name, daily: input.daily, days, createdAt: new Date().toISOString() }
}

function subtract(rem: DailyTargets, n: Pick<Nutrition, 'calories' | 'protein' | 'fat' | 'carbohydrates'>) {
  rem.calories -= n.calories
  rem.protein -= n.protein
  rem.fat -= n.fat
  rem.carbohydrates -= n.carbohydrates
}

/** 自炊分（レシピがある食事）の合計 */
export function dayTotals(meals: PlannedMeal[]): Nutrition {
  return meals.reduce((acc, m) => (m.recipe ? sumNutrition([acc, m.recipe.nutrition]) : acc), ZERO)
}

export interface Achievement {
  key: keyof DailyTargets
  label: string
  target: number
  actual: number
  percent: number
  diff: number
}

export function achievement(daily: DailyTargets, totals: Nutrition): Achievement[] {
  const rows: [keyof DailyTargets, string][] = [['calories', 'カロリー'], ['protein', 'タンパク質'], ['fat', '脂質'], ['carbohydrates', '炭水化物']]
  return rows.map(([key, label]) => ({
    key, label, target: daily[key], actual: totals[key],
    percent: daily[key] > 0 ? (totals[key] / daily[key]) * 100 : 0,
    diff: totals[key] - daily[key],
  }))
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
