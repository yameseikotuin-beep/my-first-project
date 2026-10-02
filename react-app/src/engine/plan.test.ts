import { describe, expect, it } from 'vitest'
import type { InventoryItem, Profile, Recipe } from '../types'
import { createFoodDb } from './foodDb'
import { bmrGanpule, calculateTargets } from './profile'
import { MEAL_PRESETS, achievement, generateMealPlan } from './mealplan'
import { buildShoppingItems, shoppingText, unitLabel, useUpCandidates } from './shopping'
import { nutritionFor, sumNutrition } from './nutrition'

const db = createFoodDb()

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'p1', name: 'テスト', age: 35, sex: 'female', heightCm: 160, weightKg: 62, targetWeightKg: 56, bodyFatPercent: null,
  activityLevel: 'moderate', exerciseFrequency: '', goal: 'lose', periodWeeks: 16, allergens: [], avoidFoods: [], preferences: '',
  specialCondition: false, createdAt: '', updatedAt: '', ...over,
})

describe('個人別の栄養目標', () => {
  it('基礎代謝量は国立健康・栄養研究所の式で計算する', () => {
    expect(bmrGanpule(65, 170, 30, 'male')).toBeCloseTo(((0.0481 * 65 + 0.0234 * 170 - 0.0138 * 30 - 0.4235) * 1000) / 4.186, 6)
    expect(bmrGanpule(65, 170, 30, 'male')).toBeCloseTo(1497, 0)
  })

  it('BMI・消費量・減量カロリー・PFCを計算し、PFCの合計がカロリーと一致する', () => {
    const r = calculateTargets(profile())
    expect(r.ok).toBe(true)
    expect(r.bmi).toBeCloseTo(62 / 1.6 / 1.6, 6)
    expect(r.tdee!).toBeCloseTo(r.bmr! * 1.75, 6)
    expect(r.calories!).toBeLessThan(r.tdee!)
    expect(r.calories!).toBeGreaterThanOrEqual(r.bmr! - 10)
    const kcal = r.protein! * 4 + r.fat! * 9 + r.carbohydrates! * 4
    expect(Math.abs(kcal - r.calories!)).toBeLessThan(15)
    expect(r.basis.length).toBeGreaterThan(3)
  })

  it('極端な減量期間は安全な範囲に抑えて警告する', () => {
    const r = calculateTargets(profile({ targetWeightKg: 50, periodWeeks: 4 }))
    expect(r.tdee! - r.calories!).toBeLessThanOrEqual(Math.min(r.tdee! * 0.25, 750) + 10)
    expect(r.calories!).toBeGreaterThanOrEqual(r.bmr! - 10)
    expect(r.warnings.join()).toMatch(/過度な制限/)
  })

  it('妊娠・授乳・持病などの場合や18歳未満は減量目標を自動設定しない', () => {
    expect(calculateTargets(profile({ specialCondition: true })).blocked).toMatch(/医師/)
    expect(calculateTargets(profile({ age: 15 })).blocked).toMatch(/18歳未満/)
    expect(calculateTargets(profile({ weightKg: 45, targetWeightKg: 42 })).blocked).toMatch(/低体重/)
  })
})

describe('1日の食事プラン', () => {
  const daily = { calories: 1700, protein: 100, fat: 38, carbohydrates: 238 }
  const plan = generateMealPlan(db, {
    name: 'テスト', daily, days: 1, startDate: '2026-10-02', userId: null,
    meals: MEAL_PRESETS[4].map((m) => ({ ...m, eatingOut: false })),
    base: { avoidFoods: [], avoidAllergens: [], useFoods: [] },
  })
  const day = plan.days[0]

  it('各食事のレシピを作り、1日の合計を材料から計算する', () => {
    expect(day.meals).toHaveLength(4)
    for (const m of day.meals) expect(m.recipe, m.label).not.toBeNull()
    const sum = sumNutrition(day.meals.flatMap((m) => m.recipe!.ingredients.map((i) => nutritionFor(db.get(i.foodId)!, i.amountG))))
    expect(day.totals.calories).toBeCloseTo(sum.calories, 6)
  })

  it('1日の合計は目標に近く、達成率と過不足を出す', () => {
    const a = achievement(daily, day.totals)
    const kcal = a.find((x) => x.key === 'calories')!
    expect(kcal.percent).toBeGreaterThan(90)
    expect(kcal.percent).toBeLessThan(108)
    expect(a.find((x) => x.key === 'protein')!.percent).toBeGreaterThan(85)
    expect(a.every((x) => Number.isFinite(x.diff))).toBe(true)
  })

  it('同じ日に同じ料理の型を繰り返さない', () => {
    const ids = day.meals.map((m) => m.recipe!.templateId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('外食の食事はレシピを作らず、合計にも含めない', () => {
    const p = generateMealPlan(db, {
      name: 'x', daily, days: 1, startDate: '2026-10-02', userId: null,
      meals: MEAL_PRESETS[3].map((m) => ({ ...m, eatingOut: m.mealType === '昼食' })),
      base: { avoidFoods: [], avoidAllergens: [], useFoods: [] },
    })
    const lunch = p.days[0].meals.find((m) => m.mealType === '昼食')!
    expect(lunch.recipe).toBeNull()
    expect(lunch.budget.calories).toBeGreaterThan(0)
    expect(p.days[0].totals.calories).toBeLessThan(daily.calories * 0.8)
  })

  it('アレルゲンを含む食品を使わない', () => {
    const p = generateMealPlan(db, {
      name: 'x', daily, days: 2, startDate: '2026-10-02', userId: null,
      meals: MEAL_PRESETS[3].map((m) => ({ ...m, eatingOut: false })),
      base: { avoidFoods: [], avoidAllergens: ['卵', '小麦'], useFoods: [] },
    })
    for (const d of p.days) for (const m of d.meals) for (const i of m.recipe?.ingredients ?? []) {
      expect(db.get(i.foodId)!.allergens.some((a) => a === '卵' || a === '小麦'), i.name).toBe(false)
    }
  })
})

describe('買い物リスト', () => {
  const recipe = (ings: [string, number][]): Recipe => ({
    ingredients: ings.map(([foodId, amountG]) => ({ foodId, name: db.get(foodId)!.displayName, amountG, foodState: db.get(foodId)!.state, role: db.get(foodId)!.role, fixed: db.get(foodId)!.category === '調味料', added: false, nutrition: null, matchStatus: 'exact', estimated: false })),
  }) as unknown as Recipe

  it('同じ食材を合算し、人数分を反映し、在庫を差し引く', () => {
    const r1 = recipe([['11220', 150], ['06061', 100], ['17007', 8]])
    const r2 = recipe([['11220', 120], ['12004', 50]])
    const inv: InventoryItem[] = [
      { id: 'i1', userId: null, name: '卵', foodId: '12004', amount: 1, unit: '個', expiry: null, createdAt: '' },
      { id: 'i2', userId: null, name: '鶏むね肉', foodId: '11220', amount: 100, unit: 'g', expiry: '2026-09-01', createdAt: '' },
    ]
    const { items, notes } = buildShoppingItems(db, [{ recipe: r1, servings: 2 }, { recipe: r2, servings: 1 }], inv, '2026-10-02')
    const chicken = items.find((i) => i.foodId === '11220')!
    expect(chicken.requiredG).toBe(420)
    // 期限切れの在庫は差し引かない
    expect(chicken.buyG).toBe(420)
    expect(notes.join()).toMatch(/期限切れ/)
    const egg = items.find((i) => i.foodId === '12004')!
    expect(egg.buyG).toBe(0)
    expect(items.find((i) => i.foodId === '17007')!.isSeasoning).toBe(true)
    expect(items[0].category).toBe('肉類')
    expect(shoppingText('テスト', items)).toMatch(/鶏むね肉（皮なし）：420g/)
  })

  it('目安単位を表示する', () => {
    expect(unitLabel(db, '12004', 100)).toBe('約2個')
    expect(unitLabel(db, '06061', 200)).toBe('約1/4玉')
  })

  it('使い切り候補は期限の近い順で、期限切れを除外する', () => {
    const items: InventoryItem[] = [
      { id: 'a', userId: null, name: 'A', foodId: null, amount: 1, unit: '個', expiry: '2026-10-10', createdAt: '' },
      { id: 'b', userId: null, name: 'B', foodId: null, amount: 1, unit: '個', expiry: '2026-10-03', createdAt: '' },
      { id: 'c', userId: null, name: 'C', foodId: null, amount: 1, unit: '個', expiry: '2026-10-01', createdAt: '' },
      { id: 'd', userId: null, name: 'D', foodId: null, amount: 1, unit: '個', expiry: null, createdAt: '' },
    ]
    const r = useUpCandidates(items, '2026-10-02')
    expect(r.usable.map((i) => i.id)).toEqual(['b', 'a', 'd'])
    expect(r.expired.map((i) => i.id)).toEqual(['c'])
  })
})
