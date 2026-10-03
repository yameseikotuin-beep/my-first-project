import type { MealPlan, Profile, NutritionSettings } from '../types'
import type { FoodDb } from './foodDb'
import { MEAL_PRESETS, generateMealPlan } from './mealplan'

/**
 * ホームのボタンひとつで作る「今日の献立」。
 * 栄養設定（または利用者の目標）の1日の目標で、朝・昼・夕の3食を作る。
 * variation を変えると別の料理の組み合わせになる。avoidTemplates に今の献立の料理の型を渡すと、
 * それ以外の料理で作る（「別の献立にする」で必ず違う献立にするため）。
 */
export function quickDailyPlan(
  db: FoodDb,
  settings: NutritionSettings,
  profile: Profile | null,
  date: string,
  variation: number,
  userId: string | null,
  avoidTemplates: string[] = [],
): MealPlan {
  return generateMealPlan(db, {
    name: `${date.replace(/-/g, '/').replace(/^\d{4}\//, '')} の献立`,
    daily: { calories: settings.calorieTarget, protein: settings.proteinTarget, fat: settings.fatTarget, carbohydrates: settings.carbohydrateTarget },
    meals: MEAL_PRESETS[3].map((m) => ({ ...m, eatingOut: false })),
    days: 1,
    startDate: date,
    base: { avoidFoods: profile?.avoidFoods ?? [], avoidAllergens: profile?.allergens ?? [], useFoods: [] },
    userId,
    variation,
    avoidTemplates,
  })
}

/** 日付から決まる初期値（日によって献立が変わり、同じ日なら同じ献立から始まる） */
export function seedFor(date: string): number {
  return [...date].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 7
}

/** 献立に使われている料理の型 */
export function planTemplates(plan: MealPlan): string[] {
  return plan.days.flatMap((d) => d.meals.flatMap((m) => (m.recipe?.templateId ? [m.recipe.templateId] : [])))
}
