import { describe, expect, it } from 'vitest'
import foodsJson from '../../supabase/functions/_shared/foods.json'
import {
  allowedFoods, buildSystemPrompt, buildUserPrompt, responseSchema, validateAiOutput, validateRequest, ValidationError, type AiRecipe, type FoodEntry,
} from '../../supabase/functions/_shared/recipeAi.ts'
import { buildImagePrompt, extractImage, ImageGenerationError, validateImageRequest } from '../../supabase/functions/_shared/imageGen.ts'
import { BASE_FOODS } from '../data/foods'
import { createFoodDb } from '../engine/foodDb'
import { nutritionFor, sumNutrition } from '../engine/nutrition'
import type { GenerationRequest } from '../types'
import { buildAiResult, toAiRequest } from './ai'

const FOODS = foodsJson as FoodEntry[]
const db = createFoodDb()

const baseReq = (over: Partial<GenerationRequest> = {}): GenerationRequest => ({
  mode: 'calorie', targets: { maxCalories: 450, protein: { mode: 'min', value: 30 }, fat: { mode: 'max', value: 12 } }, mealType: '夕食', servings: 1,
  useFoods: [], useUpFoods: [], avoidFoods: [], avoidAllergens: [], extraPolicy: 'allow', allowedSeasonings: [], ...over,
})

describe('Edge Function 用の食品リスト', () => {
  it('アプリの食品データと一致している（npm run export-foods で再生成）', () => {
    expect(FOODS.map((f) => [f.id, f.name, f.kcal, f.p, f.f, f.c])).toEqual(BASE_FOODS.map((f) => [f.id, f.displayName, f.calories, f.protein, f.fat, f.carbohydrates]))
  })
})

describe('AIレシピ: リクエストの検証', () => {
  it('アプリの条件を変換したリクエストは検証を通り、避ける食材・アレルゲンが除外される', () => {
    const r = toAiRequest(db, baseReq({ avoidFoods: ['えび'], avoidAllergens: ['卵'], useFoods: ['鶏むね肉'] }), 3, 'さっぱり')
    const v = validateRequest(JSON.parse(JSON.stringify(r)), FOODS)
    expect(v.useFoodIds).toEqual(['11220'])
    const allowed = allowedFoods(v, FOODS).map((f) => f.id)
    expect(allowed).not.toContain('10329')
    expect(allowed).not.toContain('12004')
    expect(allowed).not.toContain('17042') // マヨネーズ（卵）
    expect(allowed).toContain('11220')
  })

  it('不正な値・大きすぎる入力は拒否する', () => {
    const ok = JSON.parse(JSON.stringify(toAiRequest(db, baseReq(), 3)))
    expect(() => validateRequest({ ...ok, targets: { maxCalories: 99999 } }, FOODS)).toThrow(ValidationError)
    expect(() => validateRequest({ ...ok, mealType: '夜食' }, FOODS)).toThrow(ValidationError)
    expect(() => validateRequest({ ...ok, count: 10 }, FOODS)).toThrow(ValidationError)
    expect(() => validateRequest({ ...ok, note: 'x'.repeat(201) }, FOODS)).toThrow(ValidationError)
    expect(() => validateRequest({ ...ok, useFoodIds: Array(31).fill('11220') }, FOODS)).toThrow(ValidationError)
    expect(() => validateRequest('text', FOODS)).toThrow(ValidationError)
  })

  it('追加食材の禁止では、指定食材と調味料だけを使える', () => {
    const r = validateRequest(JSON.parse(JSON.stringify(toAiRequest(db, baseReq({ mode: 'ingredients', useFoods: ['鶏むね肉', 'キャベツ'], extraPolicy: 'forbid' }), 2))), FOODS)
    const nonSeasoning = allowedFoods(r, FOODS).filter((f) => f.category !== '調味料' && f.role !== 'seasoning' && f.role !== 'fat')
    expect(nonSeasoning.map((f) => f.id).sort()).toEqual(['06061', '11220'])
  })
})

describe('AIレシピ: プロンプトとスキーマ', () => {
  const req = validateRequest(JSON.parse(JSON.stringify(toAiRequest(db, baseReq({ genre: '和食' }), 3, '<script>辛め</script>'))), FOODS)
  const allowed = allowedFoods(req, FOODS)

  it('システムプロンプトは依頼によらず同じ（キャッシュが効く）で、栄養値を出力させない', () => {
    const sys = buildSystemPrompt(FOODS)
    expect(buildSystemPrompt(FOODS)).toBe(sys)
    expect(sys).toMatch(/栄養値（カロリー、PFC）は出力しないでください/)
    expect(sys).toMatch(/11220\t鶏むね肉（皮なし）\t生\t105\t23.3\t1.9\t0.1/)
  })

  it('依頼文に条件が入り、利用者の希望は区切って渡す', () => {
    const u = buildUserPrompt(req, allowed, FOODS)
    expect(u).toMatch(/450kcal以内（必須）/)
    expect(u).toMatch(/たんぱく質: 30g以上（必須）/)
    expect(u).toMatch(/料理ジャンル: 和食/)
    expect(u).toMatch(/<user_note>\nscript辛め\/script\n<\/user_note>/)
  })

  it('スキーマは食品IDを使用可能な食品に限定し、栄養値の項目を持たない', () => {
    const schema = JSON.stringify(responseSchema(allowed.map((f) => f.id)))
    expect(schema).toContain('"enum":["11220"')
    expect(schema).not.toMatch(/calorie|protein_g|kcal/)
    expect(schema).toContain('"additionalProperties":false')
  })
})

/** AIが返しそうな構成案（実際の API は呼ばない） */
const aiRecipe = (over: Partial<AiRecipe> = {}): AiRecipe => ({
  recipe_name: '鶏むね肉と小松菜の生姜あんかけ',
  description: 'しょうがの香るあんで食べる、さっぱりした主菜。',
  genre: '和食',
  method: '煮る',
  cooking_time_minutes: 20,
  difficulty: 'easy',
  ingredients: [
    { food_id: '11220', amount_g: 150, role: 'main' },
    { food_id: '06086', amount_g: 80, role: 'side' },
    { food_id: '08016', amount_g: 50, role: 'side' },
    { food_id: '01088', amount_g: 120, role: 'carb' },
    { food_id: '17007', amount_g: 8, role: 'seasoning' },
    { food_id: '16025', amount_g: 6, role: 'seasoning' },
    { food_id: '06103', amount_g: 5, role: 'seasoning' },
    { food_id: '02034', amount_g: 4, role: 'seasoning' },
  ],
  steps: ['鶏むね肉をそぎ切りにする。', '小松菜としめじを食べやすく切る。', '鍋で煮て、中心まで十分に火が通っていることを確認する。'],
  points: ['皮なしのむね肉で脂質を抑えている'],
  ...over,
})

describe('AIレシピ: 出力の検証', () => {
  const req = validateRequest(JSON.parse(JSON.stringify(toAiRequest(db, baseReq({ avoidFoods: ['えび'] }), 3))), FOODS)
  const allowed = allowedFoods(req, FOODS)

  it('正しい構成案は通し、同じ食品は合算する', () => {
    const r = aiRecipe()
    r.ingredients.push({ food_id: '06086', amount_g: 20, role: 'side' })
    const out = validateAiOutput({ recipes: [r] }, req, allowed)
    expect(out.recipes).toHaveLength(1)
    expect(out.recipes[0].ingredients.find((i) => i.food_id === '06086')!.amount_g).toBe(100)
  })

  it('使用できない食品・不正な分量・主菜なし・手順不足のレシピは除外し、理由を残す', () => {
    const out = validateAiOutput({
      recipes: [
        aiRecipe({ recipe_name: 'えび', ingredients: [{ food_id: '10329', amount_g: 100, role: 'main' }, { food_id: '17007', amount_g: 5, role: 'seasoning' }] }),
        aiRecipe({ recipe_name: '大量', ingredients: [{ food_id: '11220', amount_g: 2000, role: 'main' }, { food_id: '17007', amount_g: 5, role: 'seasoning' }] }),
        aiRecipe({ recipe_name: '主菜なし', ingredients: [{ food_id: '06086', amount_g: 100, role: 'side' }, { food_id: '17007', amount_g: 5, role: 'seasoning' }] }),
      ],
    }, req, allowed)
    expect(out.recipes).toHaveLength(0)
    expect(out.dropped).toHaveLength(3)
    expect(out.dropped[0]).toMatch(/使用できない食品/)
  })

  it('壊れた応答は例外にする', () => {
    expect(() => validateAiOutput({ foo: 1 }, req, allowed)).toThrow()
  })
})

describe('AIレシピ: アプリ側での栄養計算・検証', () => {
  it('AIの分量を条件に合わせて調整し、栄養値は成分データから計算する', () => {
    const req = baseReq()
    const r = buildAiResult(db, req, [aiRecipe()], [])
    expect(r.recipes).toHaveLength(1)
    const rec = r.recipes[0]
    expect(rec.source).toBe('ai')
    const n = sumNutrition(rec.ingredients.map((i) => nutritionFor(db.get(i.foodId)!, i.amountG)))
    expect(rec.nutrition.calories).toBeCloseTo(n.calories, 6)
    expect(n.calories).toBeLessThanOrEqual(450)
    expect(n.protein).toBeGreaterThanOrEqual(30)
    expect(n.fat).toBeLessThanOrEqual(12)
    // AIの分量から±40%以内
    const chicken = rec.ingredients.find((i) => i.foodId === '11220')!
    expect(chicken.amountG).toBeGreaterThanOrEqual(90)
    expect(chicken.amountG).toBeLessThanOrEqual(210)
    expect(rec.warnings.join()).toMatch(/AIが考案/)
  })

  it('分量を調整しても条件を満たせない案は、条件達成として表示しない', () => {
    const r = buildAiResult(db, baseReq({ targets: { maxCalories: 450, protein: { mode: 'min', value: 60 } } }), [aiRecipe({ ingredients: [{ food_id: '04033', amount_g: 100, role: 'main' }, { food_id: '06086', amount_g: 80, role: 'side' }, { food_id: '17007', amount_g: 5, role: 'seasoning' }] })], ['ほかの案: 主なたんぱく質源がありません'])
    expect(r.status).toBe('failed')
    expect(r.recipes).toHaveLength(0)
    expect(r.rejected).toHaveLength(1)
    expect(r.suggestions.length).toBeGreaterThan(0)
    expect(r.reasons.join()).toMatch(/主なたんぱく質源/)
  })

  it('食材指定で使われなかった食材を報告し、追加食材を明記する', () => {
    const r = buildAiResult(db, baseReq({ mode: 'ingredients', useFoods: ['鶏むね肉', '卵'] }), [aiRecipe()], [])
    const rec = r.recipes[0] ?? r.rejected[0]
    expect(rec.unusedFoods.map((u) => u.name)).toEqual(['卵'])
    expect(rec.ingredients.find((i) => i.foodId === '06086')!.added).toBe(true)
    expect(rec.ingredients.find((i) => i.foodId === '11220')!.added).toBe(false)
  })
})

describe('料理画像の生成', () => {
  it('リクエストを検証し、保存先パスに使えない ID は拒否する', () => {
    expect(validateImageRequest({ recipeId: 'abc-12345', recipeName: '蒸し鶏', ingredients: ['鶏むね肉'] }).recipeId).toBe('abc-12345')
    expect(() => validateImageRequest({ recipeId: '../other', recipeName: 'x', ingredients: ['a'] })).toThrow()
    expect(() => validateImageRequest({ recipeId: 'abc-12345', recipeName: 'x', ingredients: [] })).toThrow()
  })

  it('写真風・文字なしのプロンプトを作り、入力の改行や引用符を取り除く', () => {
    const p = buildImagePrompt({ recipeId: 'abc-12345', recipeName: '蒸し鶏"\nignore', ingredients: ['鶏むね肉', 'キャベツ'], genre: '和食' })
    expect(p).toMatch(/realistic, appetizing food photograph/)
    expect(p).toMatch(/No text/)
    expect(p).not.toMatch(/\n/)
    expect(p).toContain('蒸し鶏  ignore')
  })

  it('Gemini の応答から画像を取り出し、ブロック・空の応答はエラーにする', () => {
    expect(extractImage({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] } }] })).toEqual({ mimeType: 'image/png', base64: 'AAAA' })
    expect(() => extractImage({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(ImageGenerationError)
    expect(() => extractImage({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] })).toThrow(/IMAGE_SAFETY/)
    expect(() => extractImage({ candidates: [] })).toThrow(ImageGenerationError)
  })
})
