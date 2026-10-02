import { BASE_FOODS } from '../data/foods'
import type { Food } from '../types'

export interface FoodDb {
  all: Food[]
  byId: Map<string, Food>
  get(id: string | null | undefined): Food | undefined
}

export function createFoodDb(customFoods: Food[] = []): FoodDb {
  const all = [...BASE_FOODS, ...customFoods]
  const byId = new Map(all.map((f) => [f.id, f]))
  return { all, byId, get: (id) => (id ? byId.get(id) : undefined) }
}

/** 表記揺れを吸収するための正規化（カタカナ→ひらがな、空白・記号除去、全角英数→半角） */
export function normalizeName(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[\s　・,，、()（）［］[\]「」]/g, '')
    .toLowerCase()
}

export type MatchResult =
  | { status: 'exact' | 'alias'; food: Food }
  | { status: 'unmatched'; candidates: Food[] }

/**
 * 食材名を食品成分データと照合する。
 * 完全一致・別名一致のみを「照合済み」とし、部分一致は候補として返すだけで
 * 自動的に同一食品として扱わない（似た食品の取り違えを防ぐため）。
 */
export function matchFood(db: FoodDb, input: string): MatchResult {
  const q = normalizeName(input)
  if (!q) return { status: 'unmatched', candidates: [] }
  for (const food of db.all) {
    if (normalizeName(food.displayName) === q || normalizeName(food.name) === q) {
      return { status: 'exact', food }
    }
  }
  for (const food of db.all) {
    if (food.aliases.some((a) => normalizeName(a) === q)) return { status: 'alias', food }
  }
  const candidates = db.all
    .map((food) => ({ food, score: similarity(q, food) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.food)
  return { status: 'unmatched', candidates }
}

function similarity(q: string, food: Food): number {
  const names = [food.displayName, ...food.aliases].map(normalizeName)
  let best = 0
  for (const n of names) {
    if (n.includes(q) || q.includes(n)) best = Math.max(best, Math.min(n.length, q.length) / Math.max(n.length, q.length) + 0.5)
    else {
      const common = [...new Set(q)].filter((ch) => n.includes(ch)).length
      const ratio = common / Math.max(q.length, n.length)
      if (ratio >= 0.5) best = Math.max(best, ratio * 0.5)
    }
  }
  return best
}
