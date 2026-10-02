import { TEMPLATES, TEMPLATE_BY_ID, type RecipeTemplate, type TemplateSlot } from '../data/templates'
import type { CookMethod, Food, GenerationRequest, NutritionTargets, Recipe } from '../types'
import type { FoodDb } from './foodDb'
import { matchFood, normalizeName } from './foodDb'
import { emptyNutrition, runPipeline, type DraftMeta, type RecipeDraft } from './draft'
import { checkFeasibility, suggestionsFromRecipe } from './feasibility'

/** 表示用の短い名前（括弧内を省く） */
export function shortName(food: Food): string {
  return food.displayName.replace(/（.*?）/g, '')
}

const GENERIC_PROTEIN_CATEGORIES = new Set(['肉類', '魚介類'])
const TOFU_IDS = new Set(['04032', '04033'])
const KIMCHI = '06236'

/** スロットにその食品を入れられるか */
export function slotAccepts(slot: TemplateSlot, food: Food): boolean {
  if (slot.accepts) return slot.accepts.includes(food.id)
  if (slot.preferred.includes(food.id)) return true
  switch (slot.role) {
    case 'protein':
      return food.role === 'protein' && (GENERIC_PROTEIN_CATEGORIES.has(food.category) || TOFU_IDS.has(food.id))
    case 'veg':
      return food.role === 'veg' && food.id !== KIMCHI
    case 'fruit':
      return food.role === 'fruit'
    default:
      return false
  }
}

export function templateTime(t: RecipeTemplate, method: CookMethod): number {
  return t.methodTime?.[method] ?? t.time
}

export interface ResolvedRequest {
  useFoods: Food[]
  useUpFoods: Food[]
  unmatched: { input: string; candidates: Food[] }[]
  excluded: Set<string>
  allowedSeasonings: Set<string> | null
}

/** 入力された食材名を照合し、避ける食材・アレルゲンから除外リストを作る */
export function resolveRequest(db: FoodDb, req: GenerationRequest): ResolvedRequest {
  const unmatched: ResolvedRequest['unmatched'] = []
  const resolve = (names: string[]) => {
    const out: Food[] = []
    for (const name of names.map((s) => s.trim()).filter(Boolean)) {
      const r = matchFood(db, name)
      if (r.status === 'unmatched') unmatched.push({ input: name, candidates: r.candidates })
      else if (!out.includes(r.food)) out.push(r.food)
    }
    return out
  }
  const useUpFoods = resolve(req.useUpFoods)
  const useFoods = resolve(req.useFoods).filter((f) => !useUpFoods.includes(f))

  // 避けたい食材は安全側に倒し、名前の部分一致でも除外する
  const excluded = new Set<string>()
  for (const name of req.avoidFoods.map((s) => normalizeName(s)).filter(Boolean)) {
    for (const food of db.all) {
      const names = [food.displayName, food.name, ...food.aliases].map(normalizeName)
      if (names.some((n) => n === name || n.includes(name))) excluded.add(food.id)
    }
  }
  for (const food of db.all) {
    if (food.allergens.some((a) => req.avoidAllergens.includes(a))) excluded.add(food.id)
  }
  let allowedSeasonings: Set<string> | null = null
  if (req.allowedSeasonings.length) {
    allowedSeasonings = new Set()
    for (const s of req.allowedSeasonings) {
      const r = matchFood(db, s)
      if (r.status !== 'unmatched') allowedSeasonings.add(r.food.id)
    }
  }
  return { useFoods, useUpFoods, unmatched, excluded, allowedSeasonings }
}

function difficultyOk(t: RecipeTemplate, d?: GenerationRequest['difficulty']) {
  if (!d) return true
  if (d === 'easy') return t.difficulty === 'easy'
  if (d === 'normal') return t.difficulty !== 'advanced'
  return true
}

/** 条件に合うテンプレートと調理方法の組み合わせ */
export function candidateTemplates(req: GenerationRequest, rr: ResolvedRequest): { template: RecipeTemplate; method: CookMethod }[] {
  const out: { template: RecipeTemplate; method: CookMethod }[] = []
  for (const t of TEMPLATES) {
    if (req.excludeTemplates?.includes(t.id)) continue
    if (!t.mealTypes.includes(req.mealType)) continue
    if (req.genre && t.genre !== req.genre) continue
    if (!difficultyOk(t, req.difficulty)) continue
    if (t.seasonings.some((s) => rr.excluded.has(s.foodId))) continue
    if (rr.allowedSeasonings && t.seasonings.some((s) => !rr.allowedSeasonings!.has(s.foodId))) continue
    const methods = req.method ? t.methods.filter((m) => m === req.method) : t.methods
    for (const m of methods) {
      if (req.maxTime && templateTime(t, m) > req.maxTime) continue
      out.push({ template: t, method: m })
      break
    }
  }
  return out
}

interface Fill {
  slot: TemplateSlot
  food: Food | null
  added: boolean
}

/**
 * テンプレートのスロットに食材を割り当てる。
 * 食材指定モードでは指定食材を優先し、追加食材の方針に従って残りを埋める。
 */
export function fillSlots(
  db: FoodDb,
  t: RecipeTemplate,
  req: GenerationRequest,
  rr: ResolvedRequest,
  variant: number,
): { fills: Fill[]; used: Food[]; unused: { name: string; reason: string }[] } | null {
  const fills: Fill[] = t.slots.map((slot) => ({ slot, food: null, added: false }))
  const userFoods = [...rr.useUpFoods, ...rr.useFoods].filter((f) => !rr.excluded.has(f.id))
  const used: Food[] = []
  const unused: { name: string; reason: string }[] = []

  for (const food of userFoods) {
    // そのまま受け入れるスロット（preferred にあるもの）を優先
    const target =
      fills.find((fl) => !fl.food && fl.slot.preferred.includes(food.id) && slotAccepts(fl.slot, food)) ??
      fills.find((fl) => !fl.food && slotAccepts(fl.slot, food))
    if (target) {
      target.food = food
      used.push(food)
    } else if (req.mode === 'ingredients') {
      unused.push({ name: food.displayName, reason: 'この料理の構成（主菜・野菜・主食の組み合わせ）に合わないため使っていません' })
    }
  }

  if (req.mode === 'ingredients' && used.length === 0) return null

  for (const fl of fills) {
    if (fl.food) continue
    const choices = fl.slot.preferred.map((id) => db.get(id)).filter((f): f is Food => !!f && !rr.excluded.has(f.id) && !used.includes(f))
    const allowExtra = req.mode === 'calorie' || req.extraPolicy === 'allow' || (req.extraPolicy === 'minimal' && !fl.slot.optional)
    if (!allowExtra || choices.length === 0) {
      if (fl.slot.optional) continue
      return null
    }
    const idx = fl.slot.key === 'protein' ? variant % choices.length : 0
    fl.food = choices[idx]
    fl.added = req.mode === 'ingredients'
  }
  return { fills, used, unused }
}

/** スロットの割り当てから構成案（AIと同じJSON形式）を作る */
export function composeDraft(
  t: RecipeTemplate,
  method: CookMethod,
  fills: Fill[],
  req: Pick<GenerationRequest, 'mealType' | 'servings'>,
  db: FoodDb,
  unused: { name: string; reason: string }[],
  oilFactor = 1,
): { draft: RecipeDraft; meta: DraftMeta } {
  const active = fills.filter((f) => f.food)
  const names = new Map(active.map((f) => [f.slot.key, shortName(f.food!)]))
  const fillText = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => names.get(k) ?? '')
  const stepDefs = t.methodSteps?.[method] ?? t.steps
  const steps = stepDefs.filter((s) => !s.needs || names.has(s.needs))

  const seasonings = t.seasonings
    .map((s) => ({ food: db.get(s.foodId)!, grams: s.grams * (db.get(s.foodId)?.role === 'fat' ? oilFactor : 1) }))
    .filter((s) => s.food && s.grams > 0)

  const draft: RecipeDraft = {
    recipe_name: fillText(t.name),
    description: t.description,
    servings: req.servings,
    cooking_time_minutes: templateTime(t, method),
    difficulty: t.difficulty,
    ingredients: active.map((f) => ({
      name: f.food!.displayName,
      amount_g: f.slot.default > 0 ? f.slot.default : f.slot.min,
      food_state: f.food!.state,
      database_id: f.food!.id,
    })),
    seasonings: seasonings.map((s) => ({ name: s.food.displayName, amount_g: Math.round(s.grams * 10) / 10, food_state: s.food.state, database_id: s.food.id })),
    steps: steps.map((s) => fillText(s.text)),
    nutrition: emptyNutrition(),
    nutrition_source: '食品成分データベースから計算',
    warnings: [],
  }
  const meta: DraftMeta = {
    templateId: t.id,
    genre: t.genre,
    method,
    mealType: req.mealType,
    items: [
      ...active.map((f) => ({
        slot: f.slot.key,
        role: f.food!.role,
        bounds: { min: f.slot.min, max: f.slot.max, step: f.slot.step, default: f.slot.default, optional: !!f.slot.optional },
        added: f.added,
        fixed: false,
      })),
      ...seasonings.map((s) => ({ role: s.food.role, added: false, fixed: true })),
    ],
    stepNeeds: steps.map((s) => s.needs ?? null),
    points: t.points,
    unusedFoods: unused,
  }
  return { draft, meta }
}

export interface GenerationResult {
  status: 'success' | 'partial' | 'infeasible' | 'failed'
  recipes: Recipe[]
  /** 条件を満たせなかった候補（参考表示用。成功扱いにしない） */
  rejected: Recipe[]
  reasons: string[]
  suggestions: string[]
  unmatched: { input: string; candidates: Food[] }[]
}

const STATUS_RANK = { ok: 0, partial: 1, failed: 2 } as const

/**
 * レシピ生成のエントリポイント。
 * 1. 実現可能性の事前判定 → 2. 構成案の作成 → 3. 照合・分量決定・栄養計算・検証
 * → 4. 検証を通ったレシピだけを結果として返す。
 */
export function generateRecipes(db: FoodDb, req: GenerationRequest, limit = 5): GenerationResult {
  const rr = resolveRequest(db, req)
  const usable = db.all.filter((f) => !rr.excluded.has(f.id))
  const feas = checkFeasibility(req.targets, usable)
  if (!feas.feasible) {
    return { status: 'infeasible', recipes: [], rejected: [], reasons: feas.reasons, suggestions: feas.suggestions, unmatched: rr.unmatched }
  }

  const candidates = candidateTemplates(req, rr)
  const variants = req.mode === 'calorie' ? 2 : 1
  const results: { recipe: Recipe; usedCount: number; order: number }[] = []
  const offset = req.variation ?? 0
  candidates.forEach(({ template, method }, order) => {
    for (let v = 0; v < variants; v++) {
      const filled = fillSlots(db, template, req, rr, v + offset)
      if (!filled) continue
      const { draft, meta } = composeDraft(template, method, filled.fills, req, db, filled.unused)
      const recipe = runPipeline(db, draft, meta, req.targets, { optimize: true, servings: req.servings })
      const usedCount = filled.used.reduce((s, f) => s + (rr.useUpFoods.includes(f) ? 2 : 1), 0)
      results.push({ recipe, usedCount, order: (order + offset * 3) % Math.max(candidates.length, 1) })
    }
  })

  // 同じ名前のレシピは最良のものだけ残す
  const byName = new Map<string, (typeof results)[number]>()
  for (const r of results) {
    const prev = byName.get(r.recipe.recipeName)
    if (!prev || compare(r, prev) < 0) byName.set(r.recipe.recipeName, r)
  }
  const sorted = [...byName.values()].sort(compare)
  const passed = sorted.filter((r) => r.recipe.validation.status !== 'failed')
  const failed = sorted.filter((r) => r.recipe.validation.status === 'failed')

  // 同じテンプレートが並びすぎないように分散させる
  const picked: Recipe[] = []
  const seenTemplates = new Set<string | null>()
  for (const r of passed) {
    if (picked.length >= limit) break
    if (seenTemplates.has(r.recipe.templateId)) continue
    picked.push(r.recipe)
    seenTemplates.add(r.recipe.templateId)
  }
  for (const r of passed) {
    if (picked.length >= limit) break
    if (!picked.includes(r.recipe)) picked.push(r.recipe)
  }

  if (candidates.length === 0) {
    return {
      status: 'failed',
      recipes: [],
      rejected: [],
      reasons: ['指定された料理ジャンル・調理方法・調理時間・難易度・調味料の組み合わせに合うレシピの型がありません。'],
      suggestions: ['料理ジャンルや調理方法を「指定なし」にする', '調理時間の上限を延ばす', '難易度を「普通」以上にする'],
      unmatched: rr.unmatched,
    }
  }
  if (picked.length === 0) {
    const closest = failed[0]?.recipe
    return {
      status: 'failed',
      recipes: [],
      rejected: failed.slice(0, 2).map((r) => r.recipe),
      reasons: [
        req.mode === 'ingredients' && results.length === 0
          ? '指定された食材を使える料理の型が見つかりませんでした（追加食材の禁止・避けたい食材の指定も影響します）。'
          : '指定された条件をすべて満たすレシピを作成できませんでした。',
      ],
      suggestions: closest
        ? suggestionsFromRecipe(closest)
        : ['追加食材を「許可」にする', '料理ジャンルや調理方法を「指定なし」にする'],
      unmatched: rr.unmatched,
    }
  }
  const allOk = picked.every((r) => r.validation.status === 'ok')
  return {
    status: allOk ? 'success' : 'partial',
    recipes: picked,
    rejected: failed.slice(0, 2).map((r) => r.recipe),
    reasons: [],
    suggestions: [],
    unmatched: rr.unmatched,
  }

  function compare(a: (typeof results)[number], b: (typeof results)[number]) {
    const s = STATUS_RANK[a.recipe.validation.status] - STATUS_RANK[b.recipe.validation.status]
    if (s) return s
    if (a.usedCount !== b.usedCount) return b.usedCount - a.usedCount
    return a.order - b.order
  }
}

/** テンプレートからレシピを作り直す（調整・置き換えで使う） */
export function rebuildFromTemplate(
  db: FoodDb,
  recipe: Recipe,
  changes: { targets?: NutritionTargets; replace?: Record<string, string>; oilFactor?: number; method?: CookMethod },
): Recipe | null {
  const t = recipe.templateId ? TEMPLATE_BY_ID.get(recipe.templateId) : undefined
  if (!t) return null
  const method = changes.method ?? recipe.method ?? t.methods[0]
  const fills: Fill[] = t.slots.map((slot) => {
    const ing = recipe.ingredients.find((i) => i.slot === slot.key)
    const id = changes.replace?.[slot.key] ?? ing?.foodId
    const food = id ? db.get(id) ?? null : null
    return { slot, food, added: ing?.added ?? false }
  })
  const targets = changes.targets ?? recipe.targets
  const { draft, meta } = composeDraft(t, method, fills, { mealType: recipe.mealType ?? '夕食', servings: recipe.servings }, db, recipe.unusedFoods, changes.oilFactor ?? 1)
  // 現在の分量を初期値として使う
  draft.ingredients.forEach((d) => {
    const cur = recipe.ingredients.find((i) => i.foodId === d.database_id)
    if (cur) d.amount_g = cur.amountG
  })
  return runPipeline(db, draft, meta, targets, { optimize: true, servings: recipe.servings, id: recipe.id, userId: recipe.userId, now: recipe.createdAt })
}
