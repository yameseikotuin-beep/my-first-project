import { TEMPLATE_BY_ID } from '../data/templates'
import { substitutionsFor } from '../data/substitutions'
import type { Food, NutritionTargets, Recipe } from '../types'
import type { FoodDb } from './foodDb'
import { runPipeline, emptyNutrition, type DraftMeta, type RecipeDraft } from './draft'
import { rebuildFromTemplate, slotAccepts, templateTime } from './generator'
import { round1 } from './nutrition'

export type AdjustOp = 'kcal-100' | 'kcal+100' | 'protein+10' | 'fat-5' | 'carb-10' | 'lowfat' | 'highprotein' | 'faster'

export const ADJUST_LABEL: Record<AdjustOp, string> = {
  'kcal-100': 'カロリー -100kcal',
  'kcal+100': 'カロリー +100kcal',
  'protein+10': 'タンパク質 +10g',
  'fat-5': '脂質 -5g',
  'carb-10': '炭水化物 -10g',
  lowfat: '低脂質に変更',
  highprotein: '高タンパクに変更',
  faster: '調理時間を短縮',
}

export interface AdjustResult {
  recipe: Recipe | null
  message: string
}

/**
 * 栄養条件の調整。材料と分量を変更したうえで、成分データから再計算する
 * （表示値だけを書き換えることはしない）。
 */
export function adjustRecipe(db: FoodDb, recipe: Recipe, op: AdjustOp): AdjustResult {
  const n = recipe.nutrition
  const t = recipe.targets
  const base: NutritionTargets = { ...t, targetCalories: undefined }
  switch (op) {
    case 'kcal-100': {
      const max = Math.round(n.calories - 100)
      if (max < 80) return { recipe: null, message: 'これ以上カロリーを下げると1食分として成り立たないため、調整できません。' }
      return finish(db, recipe, reopt(db, recipe, { ...base, maxCalories: max, targetCalories: max * 0.97 }), `カロリー上限を${max}kcalにして分量を再計算しました。`)
    }
    case 'kcal+100': {
      const max = Math.round(n.calories + 100)
      return finish(db, recipe, reopt(db, recipe, { ...base, maxCalories: max, targetCalories: max * 0.97 }), `カロリー上限を${max}kcalにして分量を再計算しました。`)
    }
    case 'protein+10': {
      const goal = Math.ceil(n.protein + 10)
      const targets: NutritionTargets = { ...base, maxCalories: Math.max(t.maxCalories, Math.round(n.calories)), protein: { mode: 'min', value: goal } }
      let r = reopt(db, recipe, targets)
      if (r && r.nutrition.protein < goal) r = reopt(db, recipe, targets, { leanSwap: true }) ?? r
      return finish(db, recipe, r, `タンパク質${goal}g以上を条件に再計算しました。`)
    }
    case 'fat-5': {
      const goal = Math.max(1, Math.floor(n.fat - 5))
      const targets: NutritionTargets = { ...base, fat: { mode: 'max', value: goal } }
      let r = reopt(db, recipe, targets)
      if (r && r.nutrition.fat > goal) r = reopt(db, recipe, targets, { oilFactor: 0.5 }) ?? r
      if (r && r.nutrition.fat > goal) r = reopt(db, recipe, targets, { oilFactor: 0.5, leanSwap: true }) ?? r
      return finish(db, recipe, r, `脂質${goal}g以下を条件に再計算しました。`)
    }
    case 'carb-10': {
      const goal = Math.max(0, Math.floor(n.carbohydrates - 10))
      return finish(db, recipe, reopt(db, recipe, { ...base, carbohydrates: { mode: 'max', value: goal } }), `炭水化物${goal}g以下を条件に再計算しました。`)
    }
    case 'lowfat': {
      const goal = Math.max(1, Math.floor(n.fat * 0.7))
      return finish(db, recipe, reopt(db, recipe, { ...base, fat: { mode: 'max', value: goal } }, { oilFactor: 0.5, leanSwap: true }), `脂質の多い食材を置き換え、油を半量にして、脂質${goal}g以下で再計算しました。`)
    }
    case 'highprotein': {
      const goal = Math.ceil(n.protein * 1.15)
      const targets: NutritionTargets = { ...base, maxCalories: Math.max(t.maxCalories, Math.round(n.calories)), protein: { mode: 'min', value: goal } }
      return finish(db, recipe, reopt(db, recipe, targets, { leanSwap: true }), `タンパク質の多い食材を優先し、${goal}g以上で再計算しました。`)
    }
    case 'faster': {
      const tpl = recipe.templateId ? TEMPLATE_BY_ID.get(recipe.templateId) : undefined
      if (!tpl) return { recipe: null, message: 'このレシピは調理時間の短縮に対応していません。' }
      const faster = tpl.methods
        .map((m) => ({ m, time: templateTime(tpl, m) }))
        .filter((x) => x.time < recipe.cookingTime)
        .sort((a, b) => a.time - b.time)[0]
      if (!faster) return { recipe: null, message: `このレシピはこれ以上短い調理方法がありません（現在${recipe.cookingTime}分）。食材指定やカロリー指定で調理時間を短く指定して再生成してください。` }
      const r = rebuildFromTemplate(db, recipe, { method: faster.m })
      return finish(db, recipe, r, `調理方法を「${faster.m}」に変更し、${recipe.cookingTime}分→${faster.time}分にしました。`)
    }
  }
}

function finish(_db: FoodDb, before: Recipe, after: Recipe | null, message: string): AdjustResult {
  if (!after) return { recipe: null, message: '調整できませんでした。' }
  const d = (a: number, b: number, unit: string, digits = 1) => {
    const diff = digits ? round1(a - b) : Math.round(a - b)
    return `${diff >= 0 ? '+' : ''}${diff}${unit}`
  }
  const summary = `（${d(after.nutrition.calories, before.nutrition.calories, 'kcal', 0)}、P ${d(after.nutrition.protein, before.nutrition.protein, 'g')}、F ${d(after.nutrition.fat, before.nutrition.fat, 'g')}、C ${d(after.nutrition.carbohydrates, before.nutrition.carbohydrates, 'g')}）`
  const status = after.validation.status === 'failed' ? ' ただし、新しい条件をすべて満たすことはできませんでした。' : ''
  return { recipe: after, message: message + summary + status }
}

interface ReoptOptions {
  oilFactor?: number
  /** 脂質の少ない・タンパク質の多い食材へ置き換える */
  leanSwap?: boolean
}

function reopt(db: FoodDb, recipe: Recipe, targets: NutritionTargets, o: ReoptOptions = {}): Recipe | null {
  const replace: Record<string, string> = {}
  if (o.leanSwap && recipe.templateId) {
    const tpl = TEMPLATE_BY_ID.get(recipe.templateId)
    for (const ing of recipe.ingredients) {
      const food = db.get(ing.foodId)
      const slot = tpl?.slots.find((s) => s.key === ing.slot)
      if (!food || !slot || food.role !== 'protein') continue
      const better = leanerAlternatives(db, food).find((alt) => slotAccepts(slot, alt))
      if (better) replace[slot.key] = better.id
    }
  }
  if (recipe.templateId) return rebuildFromTemplate(db, recipe, { targets, replace, oilFactor: o.oilFactor })
  return reoptimizeFree(db, recipe, targets, o.oilFactor ?? 1)
}

/** 置き換え表に載っている、脂質がより少なくタンパク質比率の高い食材 */
function leanerAlternatives(db: FoodDb, food: Food): Food[] {
  return substitutionsFor(food.id)
    .map((s) => db.get(s.to))
    .filter((f): f is Food => !!f && f.fat < food.fat && f.protein / Math.max(f.calories, 1) >= food.protein / Math.max(food.calories, 1))
}

/** テンプレートを持たないレシピ（手動編集など）の分量再最適化 */
export function reoptimizeFree(db: FoodDb, recipe: Recipe, targets: NutritionTargets, oilFactor = 1): Recipe {
  const draft: RecipeDraft = {
    recipe_name: recipe.recipeName,
    description: recipe.description,
    servings: recipe.servings,
    cooking_time_minutes: recipe.cookingTime,
    difficulty: recipe.difficulty,
    ingredients: recipe.ingredients.filter((i) => !i.fixed).map((i) => ({ name: i.name, amount_g: i.amountG, food_state: i.foodState, database_id: i.foodId })),
    seasonings: recipe.ingredients.filter((i) => i.fixed).map((i) => ({ name: i.name, amount_g: i.role === 'fat' ? round1(i.amountG * oilFactor) : i.amountG, food_state: i.foodState, database_id: i.foodId })),
    steps: recipe.steps,
    nutrition: emptyNutrition(),
    nutrition_source: '食品成分データベースから計算',
    warnings: [],
  }
  const free = recipe.ingredients.filter((i) => !i.fixed)
  const fixed = recipe.ingredients.filter((i) => i.fixed)
  const meta: DraftMeta = {
    templateId: null,
    genre: recipe.genre,
    method: recipe.method,
    mealType: recipe.mealType,
    items: [
      ...free.map((i) => ({
        slot: i.slot,
        role: i.role,
        bounds: i.bounds
          ? { ...i.bounds, default: i.amountG, optional: false }
          : { min: Math.max(5, Math.round(i.amountG * 0.5)), max: Math.round(i.amountG * 1.5) + 10, step: 5, default: i.amountG, optional: false },
        added: i.added,
        fixed: false,
      })),
      ...fixed.map((i) => ({ role: i.role, added: i.added, fixed: true })),
    ],
    stepNeeds: recipe.steps.map(() => null),
    points: recipe.points.slice(1),
    unusedFoods: recipe.unusedFoods,
  }
  return runPipeline(db, draft, meta, targets, { optimize: true, servings: recipe.servings, id: recipe.id, userId: recipe.userId, now: recipe.createdAt })
}

export interface SubstituteOption {
  food: Food
  note: string
  caution?: string
  /** 料理の型に合わず置き換えできない理由 */
  blocked?: string
}

/** ある材料の置き換え候補（置き換え表 → 同じ分類の食品の順） */
export function substituteOptions(db: FoodDb, recipe: Recipe, ingredientIndex: number): SubstituteOption[] {
  const ing = recipe.ingredients[ingredientIndex]
  const food = db.get(ing?.foodId)
  if (!food) return []
  const tpl = recipe.templateId ? TEMPLATE_BY_ID.get(recipe.templateId) : undefined
  const slot = tpl?.slots.find((s) => s.key === ing.slot)
  const out: SubstituteOption[] = []
  for (const s of substitutionsFor(food.id)) {
    const f = db.get(s.to)
    if (f) out.push({ food: f, note: s.note, caution: s.caution })
  }
  const same = db.all
    .filter((f) => f.id !== food.id && f.role === food.role && f.category === food.category && !out.some((o) => o.food.id === f.id))
    .sort((a, b) => a.fat - b.fat)
    .slice(0, 6)
  for (const f of same) out.push({ food: f, note: '同じ分類の食材です。味や食感が変わります。' })
  return out.map((o) => {
    if (slot && !slotAccepts(slot, o.food)) return { ...o, blocked: 'この料理の作り方・味付けに合わないため、この料理では置き換えできません。' }
    if (ing.fixed && o.food.role !== food.role) return { ...o, blocked: '調味料の役割が異なるため置き換えできません。' }
    return o
  })
}

/** 材料を置き換えて再計算する（分量は元のまま。栄養値は必ず再計算） */
export function substituteIngredient(db: FoodDb, recipe: Recipe, ingredientIndex: number, newFoodId: string): Recipe | null {
  const ing = recipe.ingredients[ingredientIndex]
  const food = db.get(newFoodId)
  if (!ing || !food) return null
  if (recipe.templateId && ing.slot) {
    const r = rebuildFromTemplate(db, { ...recipe, ingredients: recipe.ingredients.map((x, i) => (i === ingredientIndex ? { ...x, foodId: newFoodId } : x)) }, { replace: { [ing.slot]: newFoodId } })
    return r
  }
  const oldName = ing.name
  const ingredients = recipe.ingredients.map((x, i) => (i === ingredientIndex ? { ...x, foodId: food.id, name: food.displayName, foodState: food.state, role: food.role } : x))
  const steps = recipe.steps.map((s) => s.split(oldName.replace(/（.*?）/g, '')).join(food.displayName.replace(/（.*?）/g, '')))
  return reoptimizeFree(db, { ...recipe, ingredients, steps, recipeName: recipe.recipeName.split(oldName.replace(/（.*?）/g, '')).join(food.displayName.replace(/（.*?）/g, '')) }, recipe.targets)
}
