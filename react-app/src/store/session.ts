import { useSyncExternalStore } from 'react'
import type { GenerationRequest, MealPlan, Recipe } from '../types'
import type { GenerationResult } from '../engine/generator'

/** 生成結果など、保存しない一時的な状態（タブを閉じると消える） */
export interface Session {
  request: GenerationRequest | null
  /** AIで考案した結果か（再生成もAIで行う）。note は利用者の希望 */
  ai: { note?: string } | null
  result: GenerationResult | null
  /** 生成結果・調整後のレシピ（ID→レシピ） */
  working: Record<string, Recipe>
  /** 入力フォームの下書き */
  drafts: Record<string, unknown>
  toast: string | null
  /** ホームの「今日の献立」で作った、まだ保存していない献立 */
  planDraft?: MealPlan | null
  /** 「作り直す」で使う、献立の組み合わせの番号 */
  planSeed?: number
}

const KEY = 'diet-recipe-maker:session'
let state: Session = load()
const listeners = new Set<() => void>()

function load(): Session {
  const empty: Session = { request: null, ai: null, result: null, working: {}, drafts: {}, toast: null }
  try {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(KEY) : null
    return raw ? { ...empty, ...(JSON.parse(raw) as Session), toast: null } : empty
  } catch {
    return empty
  }
}

export function setSession(fn: (s: Session) => Session) {
  state = fn(state)
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...state, toast: null }))
  } catch {
    // 保存できなくても画面上は動作する
  }
  listeners.forEach((l) => l())
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(message: string) {
  setSession((s) => ({ ...s, toast: message }))
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => setSession((s) => ({ ...s, toast: null })), 3500)
}

export function putWorking(r: Recipe) {
  setSession((s) => ({ ...s, working: { ...s.working, [r.id]: r } }))
}
