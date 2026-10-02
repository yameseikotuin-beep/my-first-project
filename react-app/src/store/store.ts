import { useSyncExternalStore } from 'react'
import type {
  Favorite, Food, InventoryItem, MealPlan, NutritionSettings, Profile, Recipe, ShoppingList, TargetHistoryEntry,
} from '../types'
import { newId } from '../util/id'

/**
 * ブラウザ内（localStorage）の保存データ。テーブル構成は開発指示書のDB設計に対応する。
 * すべてのレコードに userId を持たせ、利用者ごとに分離する（null はゲスト）。
 */
export interface AppData {
  version: 1
  activeUserId: string | null
  profiles: Profile[]
  settings: NutritionSettings[]
  recipes: Recipe[]
  history: Recipe[]
  favorites: Favorite[]
  mealPlans: MealPlan[]
  shoppingLists: ShoppingList[]
  inventory: InventoryItem[]
  customFoods: Food[]
  targetHistory: TargetHistoryEntry[]
}

const KEY = 'diet-recipe-maker:v1'
const HISTORY_LIMIT = 50

export const DEFAULT_SETTINGS: Omit<NutritionSettings, 'userId' | 'updatedAt'> = {
  calorieTarget: 1800,
  proteinTarget: 135,
  fatTarget: 40,
  carbohydrateTarget: 225,
  pfcRatio: { protein: 30, fat: 20, carbohydrates: 50 },
  mealCalories: 500,
}

function empty(): AppData {
  return {
    version: 1, activeUserId: null, profiles: [], settings: [], recipes: [], history: [], favorites: [],
    mealPlans: [], shoppingLists: [], inventory: [], customFoods: [], targetHistory: [],
  }
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Partial<AppData>
    return { ...empty(), ...parsed, version: 1 }
  } catch {
    return empty()
  }
}

let state: AppData = typeof localStorage === 'undefined' ? empty() : load()
let saveError: string | null = null
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
    saveError = null
  } catch (e) {
    saveError = e instanceof DOMException && e.name === 'QuotaExceededError'
      ? '保存容量の上限に達しました。古い履歴や不要なレシピを削除してください。'
      : 'データを保存できませんでした（プライベートブラウズ等で保存が無効になっている可能性があります）。'
  }
}

export function update(fn: (d: AppData) => AppData) {
  state = fn(state)
  persist()
  listeners.forEach((l) => l())
}

export function getState() {
  return state
}

export function getSaveError() {
  return saveError
}

export function useAppData(): AppData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

// ---- 利用者ごとの参照 ----

export const mine = <T extends { userId: string | null }>(d: AppData, list: T[]) => list.filter((x) => x.userId === d.activeUserId)

export function settingsFor(d: AppData): NutritionSettings {
  return d.settings.find((s) => s.userId === d.activeUserId) ?? { ...DEFAULT_SETTINGS, userId: d.activeUserId, updatedAt: '' }
}

export function activeProfile(d: AppData): Profile | null {
  return d.profiles.find((p) => p.id === d.activeUserId) ?? null
}

// ---- 操作 ----

export function saveRecipe(r: Recipe) {
  update((d) => {
    const rec = { ...r, userId: d.activeUserId, updatedAt: new Date().toISOString() }
    const exists = d.recipes.some((x) => x.id === r.id)
    return { ...d, recipes: exists ? d.recipes.map((x) => (x.id === r.id ? rec : x)) : [rec, ...d.recipes] }
  })
}

export function deleteRecipe(id: string) {
  update((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id), favorites: d.favorites.filter((f) => f.recipeId !== id) }))
}

export function addHistory(r: Recipe) {
  update((d) => {
    const rec = { ...r, userId: d.activeUserId }
    const rest = d.history.filter((x) => x.id !== r.id)
    const mineCount = rest.filter((x) => x.userId === d.activeUserId)
    // 利用者ごとに最新 HISTORY_LIMIT 件まで
    const drop = new Set(mineCount.slice(HISTORY_LIMIT - 1).map((x) => x.id))
    return { ...d, history: [rec, ...rest.filter((x) => !drop.has(x.id))] }
  })
}

export function toggleFavorite(r: Recipe) {
  update((d) => {
    const fav = d.favorites.find((f) => f.recipeId === r.id && f.userId === d.activeUserId)
    if (fav) return { ...d, favorites: d.favorites.filter((f) => f !== fav) }
    // お気に入りにしたレシピは保存もする
    const saved = d.recipes.some((x) => x.id === r.id) ? d.recipes : [{ ...r, userId: d.activeUserId }, ...d.recipes]
    return { ...d, recipes: saved, favorites: [{ id: newId(), userId: d.activeUserId, recipeId: r.id, createdAt: new Date().toISOString() }, ...d.favorites] }
  })
}

export function isFavorite(d: AppData, recipeId: string) {
  return d.favorites.some((f) => f.recipeId === recipeId && f.userId === d.activeUserId)
}

/** 利用者を削除し、関連データもすべて削除する（整合性の維持） */
export function deleteProfile(id: string) {
  update((d) => {
    const keep = <T extends { userId: string | null }>(list: T[]) => list.filter((x) => x.userId !== id)
    return {
      ...d,
      activeUserId: d.activeUserId === id ? null : d.activeUserId,
      profiles: d.profiles.filter((p) => p.id !== id),
      settings: keep(d.settings),
      recipes: keep(d.recipes),
      history: keep(d.history),
      favorites: keep(d.favorites),
      mealPlans: keep(d.mealPlans),
      shoppingLists: keep(d.shoppingLists),
      inventory: keep(d.inventory),
      targetHistory: d.targetHistory.filter((t) => t.userId !== id),
    }
  })
}

export function countUserData(d: AppData, id: string) {
  const n = <T extends { userId: string | null }>(list: T[]) => list.filter((x) => x.userId === id).length
  return { recipes: n(d.recipes), mealPlans: n(d.mealPlans), shoppingLists: n(d.shoppingLists), inventory: n(d.inventory) }
}
