import type { GenerationRequest, Recipe } from '../types'
import type { FoodDb } from '../engine/foodDb'
import { emptyNutrition, runPipeline, type DraftMeta, type RecipeDraft } from '../engine/draft'
import { resolveRequest, type GenerationResult } from '../engine/generator'
import { checkFeasibility, suggestionsFromRecipe } from '../engine/feasibility'
import { targetDeviation } from '../engine/validate'
import type { AiRecipe, AiRecipeRequest } from '../../supabase/functions/_shared/recipeAi.ts'
import { functionErrorMessage, getSupabase } from './supabase'

/** アプリの生成条件を、Edge Function に送るリクエストに変換する（食材は食品番号で送る） */
export function toAiRequest(db: FoodDb, req: GenerationRequest, count: number, note?: string): AiRecipeRequest {
  const rr = resolveRequest(db, req)
  const isBase = (id: string) => !id.startsWith('custom')
  return {
    mode: req.mode,
    targets: req.targets,
    mealType: req.mealType,
    genre: req.genre,
    method: req.method,
    maxTime: req.maxTime,
    difficulty: req.difficulty,
    servings: req.servings,
    useFoodIds: rr.useFoods.map((f) => f.id).filter(isBase),
    useUpFoodIds: rr.useUpFoods.map((f) => f.id).filter(isBase),
    avoidFoodIds: [...rr.excluded].filter(isBase),
    extraPolicy: req.extraPolicy,
    allowedSeasoningIds: rr.allowedSeasonings ? [...rr.allowedSeasonings].filter(isBase) : [],
    count,
    note: note?.trim() || undefined,
  }
}

const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5)

/**
 * AIの構成案を、テンプレートと同じパイプライン（照合→分量調整→栄養計算→検証）に渡せる形にする。
 * AIの分量を初期値とし、主な食材は±40%、副菜・主食は±50%の範囲で条件に合わせて調整する。
 * 油は脂質の条件に合わせて調整し、それ以外の調味料はAIの分量のまま固定する。
 */
export function aiRecipeToDraft(ai: AiRecipe, db: FoodDb, req: Pick<GenerationRequest, 'mealType' | 'servings'>, userFoodIds: Set<string>): { draft: RecipeDraft; meta: DraftMeta } {
  const main = ai.ingredients.filter((i) => i.role !== 'seasoning')
  const seasonings = ai.ingredients.filter((i) => i.role === 'seasoning')
  const item = (i: AiRecipe['ingredients'][number]) => ({
    name: db.get(i.food_id)?.displayName ?? i.food_id,
    amount_g: i.amount_g,
    food_state: db.get(i.food_id)?.state ?? null,
    database_id: i.food_id,
  })
  const draft: RecipeDraft = {
    recipe_name: ai.recipe_name,
    description: ai.description,
    servings: req.servings,
    cooking_time_minutes: ai.cooking_time_minutes,
    difficulty: ai.difficulty,
    ingredients: main.map(item),
    seasonings: seasonings.map(item),
    steps: ai.steps,
    nutrition: emptyNutrition(),
    nutrition_source: '食品成分データベースから計算',
    warnings: ['料理の構成（食材・手順）はAIが考案し、分量の調整・栄養計算・条件の検証はアプリが食品成分表に基づいて行いました。'],
  }
  const meta: DraftMeta = {
    templateId: null,
    genre: ai.genre as Recipe['genre'],
    method: ai.method as Recipe['method'],
    mealType: req.mealType,
    items: [
      ...main.map((i) => {
        const k = i.role === 'main' ? 0.4 : 0.5
        const step = i.amount_g >= 40 ? 5 : 1
        const min = step === 5 ? round5(i.amount_g * (1 - k)) : Math.max(1, Math.round(i.amount_g * (1 - k)))
        const max = step === 5 ? round5(i.amount_g * (1 + k)) : Math.max(min + 1, Math.round(i.amount_g * (1 + k)))
        return {
          role: db.get(i.food_id)?.role ?? 'veg',
          bounds: { min, max, step, default: i.amount_g, optional: false },
          added: userFoodIds.size > 0 && !userFoodIds.has(i.food_id),
          fixed: false,
        }
      }),
      ...seasonings.map((i) => {
        const food = db.get(i.food_id)
        if (food?.role === 'fat') {
          return { role: food.role, bounds: { min: Math.max(1, Math.round(i.amount_g * 0.5)), max: Math.max(Math.round(i.amount_g * 2), 4), step: 1, default: i.amount_g, optional: false }, added: false, fixed: false }
        }
        return { role: food?.role ?? 'seasoning', added: false, fixed: true }
      }),
    ],
    stepNeeds: ai.steps.map(() => null),
    points: ai.points,
    unusedFoods: [],
  }
  return { draft, meta }
}

/** AIの構成案（複数）から、検証済みのレシピの結果を作る */
export function buildAiResult(db: FoodDb, req: GenerationRequest, aiRecipes: AiRecipe[], dropped: string[]): GenerationResult {
  const rr = resolveRequest(db, req)
  const userFoods = [...rr.useUpFoods, ...rr.useFoods]
  const userIds = new Set(userFoods.map((f) => f.id))
  const recipes: Recipe[] = aiRecipes.map((ai) => {
    const { draft, meta } = aiRecipeToDraft(ai, db, req, req.mode === 'ingredients' ? userIds : new Set())
    if (req.mode === 'ingredients') {
      meta.unusedFoods = userFoods
        .filter((f) => !ai.ingredients.some((i) => i.food_id === f.id))
        .map((f) => ({ name: f.displayName, reason: 'AIが考案したこの料理の構成では使われませんでした' }))
    }
    const r = runPipeline(db, draft, meta, req.targets, { optimize: true, servings: req.servings })
    r.source = 'ai'
    return r
  })
  const sorted = recipes.sort((a, b) => {
    const rank = { ok: 0, partial: 1, failed: 2 } as const
    return rank[a.validation.status] - rank[b.validation.status] || targetDeviation(a.nutrition, req.targets) - targetDeviation(b.nutrition, req.targets)
  })
  const passed = sorted.filter((r) => r.validation.status !== 'failed')
  const failed = sorted.filter((r) => r.validation.status === 'failed')
  const notes = dropped.map((d) => `AIの案のうち使えなかったもの: ${d}`)
  if (passed.length === 0) {
    return {
      status: 'failed',
      recipes: [],
      rejected: failed,
      reasons: ['AIが考案したレシピは、分量を調整しても指定された条件をすべて満たせませんでした。', ...notes],
      suggestions: failed[0] ? suggestionsFromRecipe(failed[0]) : ['条件を変えて再試行する', '料理の型から生成する（AIを使わない）'],
      unmatched: rr.unmatched,
    }
  }
  return {
    status: passed.every((r) => r.validation.status === 'ok') ? 'success' : 'partial',
    recipes: passed,
    rejected: failed,
    reasons: notes,
    suggestions: [],
    unmatched: rr.unmatched,
  }
}

/** AIにレシピを考案してもらう（ログインが必要） */
export async function generateAiRecipes(db: FoodDb, req: GenerationRequest, note?: string, count = 3): Promise<GenerationResult> {
  const sb = getSupabase()
  if (!sb) throw new Error('クラウド機能が設定されていません。')
  // 実現できない条件はAIを呼ぶ前に判定する（無駄な利用を防ぐ）
  const rr = resolveRequest(db, req)
  const feas = checkFeasibility(req.targets, db.all.filter((f) => !rr.excluded.has(f.id)))
  if (!feas.feasible) return { status: 'infeasible', recipes: [], rejected: [], reasons: feas.reasons, suggestions: feas.suggestions, unmatched: rr.unmatched }
  const { data, error } = await sb.functions.invoke<{ recipes: AiRecipe[]; dropped: string[] }>('generate-recipe', { body: toAiRequest(db, req, count, note) })
  if (error) throw new Error(await functionErrorMessage(error))
  if (!data || !Array.isArray(data.recipes)) throw new Error('サーバーの応答が不正です。')
  return buildAiResult(db, req, data.recipes, data.dropped ?? [])
}
