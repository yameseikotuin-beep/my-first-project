import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../data/templates'
import { SUBSTITUTIONS } from '../data/substitutions'
import type { GenerationRequest, Recipe } from '../types'
import { createFoodDb, matchFood } from './foodDb'
import { calculateIngredients, gramsFromRatio, nutritionFor, pfcRatio, sumNutrition } from './nutrition'
import { generateRecipes } from './generator'
import { parseRecipeDraft, runPipeline } from './draft'
import { adjustRecipe, substituteIngredient, substituteOptions } from './adjust'
import { scaledIngredients } from './servings'

const db = createFoodDb()

function req(over: Partial<GenerationRequest>): GenerationRequest {
  return {
    mode: 'calorie',
    targets: { maxCalories: 400 },
    mealType: '夕食',
    servings: 1,
    useFoods: [],
    useUpFoods: [],
    avoidFoods: [],
    avoidAllergens: [],
    extraPolicy: 'allow',
    allowedSeasonings: [],
    ...over,
  }
}

/** レシピの材料から独立に栄養値を計算し直す（検算用） */
function recompute(r: Recipe) {
  return sumNutrition(r.ingredients.map((i) => nutritionFor(db.get(i.foodId)!, i.amountG)))
}

describe('食品データ・テンプレートの整合性', () => {
  it('テンプレートと置き換え表が参照する食品はすべて存在する', () => {
    for (const t of TEMPLATES) {
      for (const s of t.slots) for (const id of [...s.preferred, ...(s.accepts ?? [])]) expect(db.get(id), `${t.id}/${s.key}/${id}`).toBeDefined()
      for (const s of t.seasonings) expect(db.get(s.foodId), `${t.id}/${s.foodId}`).toBeDefined()
      for (const s of t.slots) {
        expect(s.min).toBeLessThanOrEqual(s.max)
        expect(s.default === 0 || (s.default >= s.min && s.default <= s.max), `${t.id}/${s.key} default`).toBe(true)
      }
    }
    for (const s of SUBSTITUTIONS) {
      expect(db.get(s.from)).toBeDefined()
      expect(db.get(s.to)).toBeDefined()
    }
  })

  it('食品番号は重複しない', () => {
    expect(new Set(db.all.map((f) => f.id)).size).toBe(db.all.length)
  })

  it('PFC由来のエネルギーが成分表のエネルギーから大きく外れる食品はない（転記ミスの検出）', () => {
    for (const f of db.all) {
      const pe = f.protein * 4 + f.fat * 9 + f.carbohydrates * 4
      // アルコール飲料（16群）はアルコール分のエネルギーを含むため除外
      if (f.calories < 30 || f.id.startsWith('16')) continue
      // 八訂のエネルギーは組成成分ベースのため、食物繊維が多い食品ほど差が大きくなる
      const fiberAllowance = (f.fiber ?? 0) * 4
      expect(Math.abs(pe - f.calories) <= f.calories * 0.25 + fiberAllowance + 10, `${f.displayName}: ${pe} vs ${f.calories}`).toBe(true)
    }
  })
})

describe('栄養計算エンジン', () => {
  it('栄養成分値 × 使用重量 ÷ 基準重量 で計算する', () => {
    const chicken = db.get('11220')!
    const n = nutritionFor(chicken, 150)
    expect(n.calories).toBeCloseTo(157.5, 5)
    expect(n.protein).toBeCloseTo(34.95, 5)
    expect(n.fat).toBeCloseTo(2.85, 5)
  })

  it('PFCエネルギー比率は P・C 4kcal/g、F 9kcal/g で計算し、合計100%になる', () => {
    const r = pfcRatio({ calories: 0, protein: 30, fat: 10, carbohydrates: 40, fiber: 0, salt: 0 })
    // 120 + 90 + 160 = 370
    expect(r.protein).toBeCloseTo((120 / 370) * 100, 5)
    expect(r.fat).toBeCloseTo((90 / 370) * 100, 5)
    expect(r.protein + r.fat + r.carbohydrates).toBeCloseTo(100, 5)
  })

  it('エネルギー比率からグラム数に換算する', () => {
    const g = gramsFromRatio(400, { protein: 30, fat: 20, carbohydrates: 50 })
    expect(g.protein).toBeCloseTo(30, 5)
    expect(g.fat).toBeCloseTo(8.89, 2)
    expect(g.carbohydrates).toBeCloseTo(50, 5)
  })

  it('照合できない食材は計算から除外し、missing として報告する', () => {
    const { calc } = calculateIngredients(db, [
      { foodId: '11220', name: '鶏むね肉', amountG: 100, foodState: '生', role: 'protein', fixed: false, added: false, nutrition: null, matchStatus: 'exact', estimated: false },
      { foodId: null, name: 'ドラゴンフルーツ', amountG: 100, foodState: null, role: 'fruit', fixed: false, added: false, nutrition: null, matchStatus: 'unmatched', estimated: false },
    ])
    expect(calc.total.calories).toBe(105)
    expect(calc.missing).toEqual(['ドラゴンフルーツ'])
  })
})

describe('テスト1: カロリー指定（400kcal以内・P35g以上・F10g以下）', () => {
  const result = generateRecipes(db, req({
    targets: { maxCalories: 400, protein: { mode: 'min', value: 35 }, fat: { mode: 'max', value: 10 } },
    genre: '和食',
    maxTime: 20,
  }))

  it('条件を満たすレシピを生成する', () => {
    expect(result.status).not.toBe('infeasible')
    expect(result.recipes.length).toBeGreaterThan(0)
  })

  it('すべてのレシピが条件を満たし、値が材料から再計算した値と一致する', () => {
    for (const r of result.recipes) {
      const n = recompute(r)
      expect(n.calories, r.recipeName).toBeLessThanOrEqual(400)
      expect(n.protein, r.recipeName).toBeGreaterThanOrEqual(35)
      expect(n.fat, r.recipeName).toBeLessThanOrEqual(10)
      expect(r.nutrition.calories).toBeCloseTo(n.calories, 6)
      expect(r.genre).toBe('和食')
      expect(r.cookingTime).toBeLessThanOrEqual(20)
    }
  })

  it('すべての食材と調味料が計算に含まれている', () => {
    for (const r of result.recipes) {
      expect(r.ingredients.every((i) => i.foodId && i.nutrition)).toBe(true)
      expect(r.ingredients.some((i) => i.role === 'seasoning')).toBe(true)
      expect(r.validation.checks.find((c) => c.key === 'coverage')?.ok).toBe(true)
    }
  })
})

describe('テスト2: 食材指定（鶏むね肉・キャベツ・玉ねぎ・卵）', () => {
  const result = generateRecipes(db, req({
    mode: 'ingredients',
    useFoods: ['鶏むね肉', 'キャベツ', '玉ねぎ', '卵'],
    targets: { maxCalories: 400, protein: { mode: 'min', value: 35 }, fat: { mode: 'max', value: 12 }, carbohydrates: { mode: 'max', value: 35 } },
    maxTime: 20,
  }))

  it('指定食材を優先して複数パターンのレシピを生成する', () => {
    expect(result.recipes.length).toBeGreaterThanOrEqual(3)
    for (const r of result.recipes) {
      expect(r.ingredients.some((i) => i.foodId === '11220'), r.recipeName).toBe(true)
    }
    expect(new Set(result.recipes.map((r) => r.templateId)).size).toBe(result.recipes.length)
    // 卵とじでは4つすべてを使う
    const all4 = result.recipes.find((r) => ['11220', '06061', '06153', '12004'].every((id) => r.ingredients.some((i) => i.foodId === id)))
    expect(all4, '4食材すべてを使うレシピ').toBeDefined()
  })

  it('各食材の分量が表示され、条件が検証されている', () => {
    for (const r of result.recipes) {
      expect(r.ingredients.every((i) => i.amountG > 0)).toBe(true)
      const n = recompute(r)
      expect(n.calories).toBeLessThanOrEqual(400)
      expect(n.protein).toBeGreaterThanOrEqual(35)
      expect(n.fat).toBeLessThanOrEqual(12)
      expect(n.carbohydrates).toBeLessThanOrEqual(35)
    }
  })

  it('追加食材は明記され、使わなかった指定食材は理由を示す', () => {
    for (const r of result.recipes) {
      const userIds = ['11220', '06061', '06153', '12004']
      for (const i of r.ingredients.filter((x) => !x.fixed && db.get(x.foodId)?.category !== '調味料')) {
        expect(i.added, `${r.recipeName} ${i.name}`).toBe(!userIds.includes(i.foodId!))
      }
      for (const u of r.unusedFoods) expect(u.reason.length).toBeGreaterThan(0)
    }
  })

  it('追加食材を禁止すると、指定食材と調味料だけで作る', () => {
    const r = generateRecipes(db, req({ mode: 'ingredients', useFoods: ['鶏むね肉', 'キャベツ', '玉ねぎ', '卵'], extraPolicy: 'forbid', targets: { maxCalories: 500 } }))
    expect(r.recipes.length).toBeGreaterThan(0)
    for (const rec of r.recipes) expect(rec.ingredients.filter((i) => !i.fixed && db.get(i.foodId)?.category !== '調味料').every((i) => !i.added)).toBe(true)
  })
})

describe('テスト3: 実現困難な条件（100kcal以内・P50g以上・脂質0g）', () => {
  const result = generateRecipes(db, req({
    targets: { maxCalories: 100, protein: { mode: 'min', value: 50 }, fat: { mode: 'max', value: 0 } },
    mealType: '間食',
  }))

  it('生成成功と表示せず、理由と具体的な調整案を返す', () => {
    expect(result.status).toBe('infeasible')
    expect(result.recipes).toHaveLength(0)
    expect(result.reasons.join()).toMatch(/タンパク質50g/)
    expect(result.reasons.join()).toMatch(/脂質を0g/)
    expect(result.suggestions.some((s) => /カロリー上限を\d+kcal以上/.test(s))).toBe(true)
    expect(result.suggestions.some((s) => /タンパク質の目標を\d+g以下/.test(s))).toBe(true)
  })

  it('事前判定を通っても最適化で満たせない場合は failed として返す', () => {
    // 理論上は可能だが、テンプレートの分量範囲では満たせない条件
    const r = generateRecipes(db, req({ targets: { maxCalories: 180, protein: { mode: 'min', value: 38 } }, genre: '中華' }))
    if (r.status === 'failed') {
      expect(r.recipes).toHaveLength(0)
      expect(r.suggestions.length).toBeGreaterThan(0)
      for (const x of r.rejected) expect(x.validation.status).toBe('failed')
    } else {
      for (const x of r.recipes) expect(recompute(x).protein).toBeGreaterThanOrEqual(38)
    }
  })
})

describe('テスト4: 食品データにない食材', () => {
  it('類似食品を同一食品として扱わない', () => {
    const m = matchFood(db, '鶏むね肉の燻製')
    expect(m.status).toBe('unmatched')
    if (m.status === 'unmatched') expect(m.candidates.some((c) => c.id === '11220')).toBe(true)
  })

  it('食材指定で未登録の食材は unmatched として報告し、計算には含めない', () => {
    const r = generateRecipes(db, req({ mode: 'ingredients', useFoods: ['鶏むね肉', 'ドラゴンフルーツ'] }))
    expect(r.unmatched.map((u) => u.input)).toEqual(['ドラゴンフルーツ'])
    for (const rec of r.recipes) expect(rec.ingredients.some((i) => i.name.includes('ドラゴン'))).toBe(false)
  })

  it('AIの構成案に未登録の食材があると、計算に含めず条件達成としない', () => {
    const draft = parseRecipeDraft({
      recipe_name: 'テスト',
      description: '',
      servings: 1,
      cooking_time_minutes: 10,
      difficulty: 'easy',
      ingredients: [
        { name: '鶏むね肉（皮なし）', amount_g: 150, food_state: '生' },
        { name: '謎の高級きのこ', amount_g: 50, food_state: '生' },
      ],
      seasonings: [{ name: 'しょうゆ', amount_g: 6 }],
      steps: ['切る', '焼いて中心まで火を通す'],
      nutrition: { calories_kcal: 999 },
    })
    expect(draft.warnings.join()).toMatch(/再計算/)
    const r = runPipeline(db, draft, null, { maxCalories: 500 }, { optimize: false })
    expect(r.validation.status).toBe('failed')
    expect(r.validation.checks.find((c) => c.key === 'coverage')?.ok).toBe(false)
    expect(r.nutrition.calories).toBeCloseTo(157.5 + 0.77 * 6, 5)
    expect(r.warnings.join()).toMatch(/謎の高級きのこ/)
  })

  it('不正な構造のAI出力は拒否する', () => {
    expect(() => parseRecipeDraft({ recipe_name: 'x' })).toThrow()
    expect(() => parseRecipeDraft({ recipe_name: 'x', servings: 1, cooking_time_minutes: 10, difficulty: 'easy', ingredients: [{ name: 'a', amount_g: -1 }], steps: [] })).toThrow()
  })

  it('食品の状態がデータと異なる場合は条件達成としない', () => {
    const draft = parseRecipeDraft({
      recipe_name: 'テスト', servings: 1, cooking_time_minutes: 10, difficulty: 'easy',
      ingredients: [{ name: '鶏むね肉（皮なし）', amount_g: 150, food_state: '焼き' }],
      steps: ['切る', '焼く'],
    })
    const r = runPipeline(db, draft, null, { maxCalories: 500 }, { optimize: false })
    expect(r.validation.checks.find((c) => c.key === 'state')?.ok).toBe(false)
    expect(r.validation.status).toBe('failed')
  })
})

describe('テスト5: 人数変更（1人前→2人前）', () => {
  const r = generateRecipes(db, req({ targets: { maxCalories: 450 } })).recipes[0]

  it('材料を人数分に変更し、総栄養価と1人前の栄養価を両方出す', () => {
    const two = scaledIngredients({ ...r, servings: 2 })
    r.ingredients.forEach((ing, i) => expect(two.items[i].amountG).toBeCloseTo(ing.amountG * 2, 5))
    expect(two.total.calories).toBeCloseTo(r.nutrition.calories * 2, 5)
    expect(two.perServing.calories).toBeCloseTo(r.nutrition.calories, 5)
    expect(two.notes.length).toBeGreaterThan(0)
  })
})

describe('レシピの自動調整', () => {
  const base = generateRecipes(db, req({ targets: { maxCalories: 500 } })).recipes[0]

  it('カロリー-100kcalは材料の分量を変えて再計算する', () => {
    const { recipe } = adjustRecipe(db, base, 'kcal-100')
    expect(recipe).not.toBeNull()
    const n = recompute(recipe!)
    expect(n.calories).toBeLessThanOrEqual(base.nutrition.calories - 100 + 0.001)
    expect(recipe!.nutrition.calories).toBeCloseTo(n.calories, 6)
    expect(recipe!.ingredients.map((i) => i.amountG)).not.toEqual(base.ingredients.map((i) => i.amountG))
  })

  it('タンパク質+10gは実際の材料でタンパク質が増える', () => {
    const { recipe } = adjustRecipe(db, base, 'protein+10')
    expect(recompute(recipe!).protein).toBeGreaterThanOrEqual(base.nutrition.protein + 9.99)
  })

  it('脂質-5g・低脂質は脂質が減る', () => {
    const a = adjustRecipe(db, base, 'fat-5').recipe!
    expect(recompute(a).fat).toBeLessThan(base.nutrition.fat)
    const b = adjustRecipe(db, base, 'lowfat').recipe!
    expect(recompute(b).fat).toBeLessThan(base.nutrition.fat)
  })

  it('食材の置き換え後は栄養価を再計算する', () => {
    const idx = base.ingredients.findIndex((i) => i.role === 'protein')
    const opts = substituteOptions(db, base, idx).filter((o) => !o.blocked)
    expect(opts.length).toBeGreaterThan(0)
    const replaced = substituteIngredient(db, base, idx, opts[0].food.id)!
    expect(replaced.ingredients.some((i) => i.foodId === opts[0].food.id)).toBe(true)
    expect(replaced.nutrition.calories).toBeCloseTo(recompute(replaced).calories, 6)
    expect(replaced.recipeName).not.toBe('')
  })
})
