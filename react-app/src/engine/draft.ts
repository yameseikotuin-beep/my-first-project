import type { Difficulty, FoodRole, FoodState, NutritionTargets, Recipe, RecipeIngredient } from '../types'
import { FOOD_SOURCE } from '../data/foods'
import type { FoodDb } from './foodDb'
import { matchFood } from './foodDb'
import { calculateIngredients, pfcEnergy, pfcRatio, round1 } from './nutrition'
import { optimizeAmounts, type OptItem } from './optimizer'
import { validateRecipe } from './validate'
import { newId } from '../util/id'

/**
 * レシピ構成案（AIの出力形式）。開発指示書のJSON構造に準拠する。
 * nutrition は常に null で受け取り、計算エンジンが埋める。
 */
export interface RecipeDraft {
  recipe_name: string
  description: string
  servings: number
  cooking_time_minutes: number
  difficulty: 'easy' | 'normal' | 'advanced'
  ingredients: DraftIngredient[]
  seasonings: DraftIngredient[]
  steps: string[]
  nutrition: {
    calories_kcal: null
    protein_g: null
    fat_g: null
    carbohydrates_g: null
    fiber_g: null
    salt_g: null
    pfc_ratio: { protein_percent: null; fat_percent: null; carbohydrate_percent: null }
  }
  nutrition_source: string
  warnings: string[]
}

export interface DraftIngredient {
  name: string
  amount_g: number
  food_state: string | null
  database_id: string | null
}

/** ローカル構成エンジンが付ける補助情報（AIの出力には含まれない） */
export interface DraftMeta {
  templateId: string | null
  genre: Recipe['genre']
  method: Recipe['method']
  mealType: Recipe['mealType']
  /** ingredients/seasonings と同じ順序の補助情報 */
  items: { slot?: string; role: FoodRole; bounds?: { min: number; max: number; step: number; default: number; optional: boolean }; added: boolean; fixed: boolean }[]
  /** steps と同じ順序。そのスロットが0gになったら手順を省く */
  stepNeeds: (string | null)[]
  points: string[]
  unusedFoods: { name: string; reason: string }[]
}

const EMPTY_NUTRITION: RecipeDraft['nutrition'] = {
  calories_kcal: null, protein_g: null, fat_g: null, carbohydrates_g: null, fiber_g: null, salt_g: null,
  pfc_ratio: { protein_percent: null, fat_percent: null, carbohydrate_percent: null },
}

export function emptyNutrition(): RecipeDraft['nutrition'] {
  return structuredClone(EMPTY_NUTRITION)
}

/**
 * 外部（AI）から受け取ったJSONを検証して RecipeDraft に変換する。
 * 構造が不正な場合は例外を投げる。AIが栄養値を入れていても破棄し、警告を付ける。
 */
export function parseRecipeDraft(json: unknown): RecipeDraft {
  const fail = (msg: string): never => {
    throw new Error(`AIの出力形式が不正です: ${msg}`)
  }
  if (!json || typeof json !== 'object') fail('オブジェクトではありません')
  const o = json as Record<string, unknown>
  const str = (k: string) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string) : fail(`${k} がありません`))
  const num = (k: string, lo: number, hi: number) => {
    const v = o[k]
    return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : fail(`${k} が不正です`)
  }
  const ingList = (k: string, required: boolean): DraftIngredient[] => {
    const v = o[k]
    if (!Array.isArray(v)) return required ? fail(`${k} が配列ではありません`) : []
    return v.map((x, i) => {
      if (!x || typeof x !== 'object') fail(`${k}[${i}] が不正です`)
      const it = x as Record<string, unknown>
      if (typeof it.name !== 'string' || !it.name.trim()) fail(`${k}[${i}].name がありません`)
      if (typeof it.amount_g !== 'number' || !Number.isFinite(it.amount_g) || it.amount_g < 0 || it.amount_g > 2000) fail(`${k}[${i}].amount_g が不正です`)
      return { name: it.name as string, amount_g: it.amount_g as number, food_state: typeof it.food_state === 'string' ? it.food_state : null, database_id: null }
    })
  }
  const difficulty = o.difficulty === 'easy' || o.difficulty === 'normal' || o.difficulty === 'advanced' ? o.difficulty : fail('difficulty が不正です')
  const steps = Array.isArray(o.steps) && o.steps.every((s) => typeof s === 'string') ? (o.steps as string[]) : fail('steps が不正です')
  const ingredients = ingList('ingredients', true)
  if (ingredients.length === 0) fail('ingredients が空です')
  const warnings: string[] = Array.isArray(o.warnings) ? (o.warnings as unknown[]).filter((w): w is string => typeof w === 'string') : []
  const n = o.nutrition as Record<string, unknown> | undefined
  if (n && Object.values(n).some((v) => typeof v === 'number')) warnings.push('AIが出力した栄養値は使用せず、食品成分データから再計算しました。')
  return {
    recipe_name: str('recipe_name'),
    description: typeof o.description === 'string' ? o.description : '',
    servings: num('servings', 1, 6),
    cooking_time_minutes: num('cooking_time_minutes', 1, 240),
    difficulty,
    ingredients,
    seasonings: ingList('seasonings', false),
    steps,
    nutrition: emptyNutrition(),
    nutrition_source: '食品成分データベースから計算',
    warnings,
  }
}

const STATE_SET = new Set<FoodState>(['生', 'ゆで', '焼き', 'めし', '乾', '加工品'])

export interface PipelineOptions {
  /** 分量を最適化する（false なら draft の分量をそのまま使う） */
  optimize: boolean
  servings?: number
  id?: string
  userId?: string | null
  now?: string
}

/**
 * 構成案 → 食品照合 → 分量の確定 → 栄養計算 → 条件検証 を行い、Recipe を返す。
 * 栄養値はすべてここで計算し、構成案の値は使わない。
 */
export function runPipeline(db: FoodDb, draft: RecipeDraft, meta: DraftMeta | null, targets: NutritionTargets, opts: PipelineOptions): Recipe {
  const all = [...draft.ingredients, ...draft.seasonings]
  const warnings = [...draft.warnings]

  // 1. 食品照合
  let ingredients: RecipeIngredient[] = all.map((d, i) => {
    const m = meta?.items[i]
    let foodId: string | null = null
    let matchStatus: RecipeIngredient['matchStatus'] = 'unmatched'
    if (d.database_id && db.get(d.database_id)) {
      foodId = d.database_id
      matchStatus = 'exact'
    } else {
      const r = matchFood(db, d.name)
      if (r.status !== 'unmatched') {
        foodId = r.food.id
        matchStatus = r.status
      } else {
        warnings.push(`「${d.name}」は食品成分データに見つからないため、栄養計算に含まれていません。${r.candidates.length ? `候補: ${r.candidates.map((c) => c.displayName).join('、')}` : ''}`)
      }
    }
    const food = db.get(foodId)
    const isSeasoning = i >= draft.ingredients.length
    return {
      foodId,
      name: food?.displayName ?? d.name,
      amountG: d.amount_g,
      foodState: d.food_state && STATE_SET.has(d.food_state as FoodState) ? (d.food_state as FoodState) : (food?.state ?? null),
      role: m?.role ?? food?.role ?? (isSeasoning ? 'seasoning' : 'veg'),
      slot: m?.slot,
      bounds: m?.bounds ? { min: m.bounds.min, max: m.bounds.max, step: m.bounds.step } : undefined,
      fixed: m?.fixed ?? isSeasoning,
      added: m?.added ?? false,
      nutrition: null,
      matchStatus,
      estimated: food?.estimated ?? false,
    }
  })

  // 2〜3. 分量の確定（最適化）
  if (opts.optimize) {
    const items: OptItem[] = ingredients.map((ing, i) => {
      const b = meta?.items[i]?.bounds
      const base = ing.amountG
      return {
        food: db.get(ing.foodId) ?? null,
        amount: base,
        min: b ? b.min : Math.max(0, Math.round(base * 0.5)),
        max: b ? b.max : Math.round(base * 1.5),
        step: b ? b.step : 5,
        default: b ? b.default : base,
        fixed: ing.fixed,
        optional: b ? b.optional : false,
      }
    })
    const r = optimizeAmounts(items, targets)
    ingredients = ingredients.map((ing, i) => ({ ...ing, amountG: r.amounts[i] }))
  }

  // 0gになった任意食材と、その食材だけに関する手順を除く
  const removedSlots = new Set(ingredients.filter((i) => i.amountG === 0 && i.slot).map((i) => i.slot!))
  ingredients = ingredients.filter((i) => i.amountG > 0)
  const steps = draft.steps.filter((_, i) => {
    const need = meta?.stepNeeds[i]
    return !need || !removedSlots.has(need)
  })

  // 4. 栄養計算
  const { ingredients: calculated, calc } = calculateIngredients(db, ingredients)
  const n = calc.total

  // 5. 条件検証
  const validation = validateRecipe(db, n, calculated, steps, targets)

  const ratio = pfcRatio(n)
  const pe = pfcEnergy(n)
  if (n.calories > 0 && Math.abs(pe - n.calories) / n.calories > 0.1) {
    warnings.push(`P・F・Cから計算したエネルギー（${Math.round(pe)}kcal）と成分表のエネルギー（${Math.round(n.calories)}kcal）に差があります。食物繊維や食品ごとの換算係数の違いによるもので、表示カロリーは成分表の値です。`)
  }
  const unverified = calculated.filter((i) => db.get(i.foodId)?.verification === 'transcribed')
  if (unverified.length) warnings.push('食品成分値は日本食品標準成分表（八訂）の値を手入力したもので、公式ファイルとの機械照合はまだ行っていません。')
  if (calc.estimated.length) warnings.push(`推定値を含む食材があります: ${calc.estimated.join('、')}（確定値ではありません）`)
  warnings.push('栄養値は生の重量（ごはんは炊いた後の重量）から計算しています。調理による水分・栄養の変化は含みません。')

  const points = [...(meta?.points ?? [])]
  if (n.protein > 0) points.unshift(`タンパク質 ${round1(n.protein)}g（エネルギー比 ${Math.round(ratio.protein)}%）、脂質 ${round1(n.fat)}g（同 ${Math.round(ratio.fat)}%）`)
  if (n.fiber >= 5) points.push(`食物繊維を ${round1(n.fiber)}g とれる`)
  if (n.salt > 3) warnings.push(`食塩相当量が ${round1(n.salt)}g とやや多めです。調味料を控えめにすると減らせます。`)

  const now = opts.now ?? new Date().toISOString()
  return {
    id: opts.id ?? newId(),
    userId: opts.userId ?? null,
    templateId: meta?.templateId ?? null,
    recipeName: draft.recipe_name,
    description: draft.description,
    genre: meta?.genre ?? null,
    method: meta?.method ?? null,
    mealType: meta?.mealType ?? null,
    servings: opts.servings ?? draft.servings,
    cookingTime: draft.cooking_time_minutes,
    difficulty: draft.difficulty as Difficulty,
    ingredients: calculated,
    steps,
    nutrition: n,
    pfcRatio: ratio,
    pfcEnergy: pe,
    nutritionSource: `${FOOD_SOURCE}に基づき計算`,
    targets,
    validation,
    points,
    warnings,
    unusedFoods: meta?.unusedFoods ?? [],
    createdAt: now,
    updatedAt: now,
  }
}

/** 既存レシピを分量そのままで再計算・再検証する（手動編集後など） */
export function recalcRecipe(db: FoodDb, recipe: Recipe): Recipe {
  const { ingredients, calc } = calculateIngredients(db, recipe.ingredients.filter((i) => i.amountG > 0))
  const n = calc.total
  return {
    ...recipe,
    ingredients,
    nutrition: n,
    pfcRatio: pfcRatio(n),
    pfcEnergy: pfcEnergy(n),
    validation: validateRecipe(db, n, ingredients, recipe.steps, recipe.targets),
    updatedAt: new Date().toISOString(),
  }
}
