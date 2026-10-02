import type { FoodCategory, InventoryItem, Recipe, ShoppingItem } from '../types'
import type { FoodDb } from './foodDb'
import { matchFood, normalizeName } from './foodDb'

export const CATEGORY_ORDER: FoodCategory[] = ['肉類', '魚介類', '卵・乳製品', '野菜', 'きのこ類', '豆類・大豆製品', '穀類・主食', '果物', '調味料', 'その他']

/** 在庫の単位をグラムに換算する。換算できない場合は null */
export function inventoryGrams(db: FoodDb, item: InventoryItem): number | null {
  if (item.unit === 'g' || item.unit === 'ml') return item.amount
  const food = db.get(item.foodId)
  if (food?.unit) return item.amount * food.unit.grams
  return null
}

export function isExpired(item: InventoryItem, today: string): boolean {
  return !!item.expiry && item.expiry < today
}

/** 目安単位での表示（例: 約2個）。販売単位とは別に表示する */
export function unitLabel(db: FoodDb, foodId: string | null, grams: number): string | null {
  const food = db.get(foodId)
  if (!food?.unit || grams <= 0) return null
  const n = grams / food.unit.grams
  const name = food.unit.name
  if (n < 1) {
    const fr = [[0.125, '1/8'], [0.25, '1/4'], [0.5, '1/2'], [0.75, '3/4'], [1, '1']] as const
    const f = fr.find(([v]) => n <= v + 1e-9)!
    return `約${f[1]}${name}`
  }
  const rounded = Math.ceil(n * 2) / 2
  return `約${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}${name}`
}

export interface ShoppingSource {
  recipe: Recipe
  /** レシピの何人前分を作るか */
  servings: number
}

/**
 * 複数レシピの材料を合算する。同じ食品（食品番号・状態が同じ）は1行にまとめ、
 * 状態が違えば別の行にする。在庫（期限切れを除く）を差し引いた量を購入量とする。
 */
export function buildShoppingItems(db: FoodDb, sources: ShoppingSource[], inventory: InventoryItem[], today: string): { items: ShoppingItem[]; notes: string[] } {
  const map = new Map<string, ShoppingItem>()
  const notes: string[] = []
  for (const { recipe, servings } of sources) {
    for (const ing of recipe.ingredients) {
      const food = db.get(ing.foodId)
      const key = food ? `${food.id}|${ing.foodState ?? food.state}` : `name|${normalizeName(ing.name)}`
      const grams = ing.amountG * servings
      const prev = map.get(key)
      if (prev) prev.requiredG += grams
      else {
        map.set(key, {
          key,
          foodId: food?.id ?? null,
          name: food?.displayName ?? ing.name,
          category: food?.category ?? 'その他',
          state: ing.foodState ?? food?.state ?? null,
          requiredG: grams,
          stockG: 0,
          buyG: 0,
          unitLabel: null,
          isSeasoning: food?.category === '調味料' || ing.fixed,
          checked: false,
          manual: false,
        })
      }
    }
  }

  // 在庫を差し引く
  const stockUsed = new Set<string>()
  for (const item of map.values()) {
    const stocks = inventory.filter((inv) => inv.foodId ? inv.foodId === item.foodId : normalizeName(inv.name) === normalizeName(item.name))
    for (const inv of stocks) {
      if (isExpired(inv, today)) {
        notes.push(`在庫の「${inv.name}」は期限切れのため、在庫として差し引いていません。`)
        continue
      }
      const g = inventoryGrams(db, inv)
      if (g === null) {
        notes.push(`在庫の「${inv.name}」（${inv.amount}${inv.unit}）はグラムに換算できないため、差し引いていません。`)
        continue
      }
      item.stockG += g
      stockUsed.add(inv.id)
    }
  }
  for (const item of map.values()) {
    item.requiredG = Math.round(item.requiredG * 10) / 10
    item.buyG = Math.max(0, Math.round((item.requiredG - item.stockG) * 10) / 10)
    item.unitLabel = item.isSeasoning ? null : unitLabel(db, item.foodId, item.buyG)
  }
  const items = [...map.values()].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name, 'ja'))
  return { items, notes: [...new Set(notes)] }
}

export function formatAmount(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2)}kg` : `${Math.round(g * 10) / 10}g`
}

/** テキスト形式（コピー用） */
export function shoppingText(name: string, items: ShoppingItem[]): string {
  const lines = [`【${name}】`]
  for (const cat of CATEGORY_ORDER) {
    const list = items.filter((i) => i.category === cat && (i.buyG > 0 || i.manual))
    if (!list.length) continue
    lines.push('', `■${cat}`)
    for (const i of list) {
      const amount = i.isSeasoning ? `必要量（${formatAmount(i.buyG)}）` : `${formatAmount(i.buyG)}${i.unitLabel ? `（${i.unitLabel}）` : ''}`
      lines.push(`${i.checked ? '☑' : '☐'} ${i.name}：${amount}`)
    }
  }
  return lines.join('\n')
}

/** 在庫を名前から食品データに照合する（照合できなければ null） */
export function matchInventoryFood(db: FoodDb, name: string): string | null {
  const r = matchFood(db, name)
  return r.status === 'unmatched' ? null : r.food.id
}

/** 期限の近い順（期限切れは除外）に並べた、使い切り候補 */
export function useUpCandidates(items: InventoryItem[], today: string): { usable: InventoryItem[]; expired: InventoryItem[] } {
  const expired = items.filter((i) => isExpired(i, today))
  const usable = items
    .filter((i) => !isExpired(i, today))
    .sort((a, b) => (a.expiry ?? '9999') .localeCompare(b.expiry ?? '9999'))
  return { usable, expired }
}

export function daysUntil(expiry: string, today: string): number {
  return Math.round((new Date(`${expiry}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
}
