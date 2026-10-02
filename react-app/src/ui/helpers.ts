import { useMemo } from 'react'
import { useAppData } from '../store/store'
import { createFoodDb, type FoodDb } from '../engine/foodDb'
import { round1 } from '../engine/nutrition'

export function useFoodDb(): FoodDb {
  const d = useAppData()
  return useMemo(() => createFoodDb(d.customFoods), [d.customFoods])
}

export const fmt1 = (x: number) => round1(x).toFixed(1)
export const fmt0 = (x: number) => String(Math.round(x))

export function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 時間帯のあいさつ */
export function greeting(): string {
  const h = new Date().getHours()
  return h < 5 ? 'こんばんは' : h < 11 ? 'おはようございます' : h < 17 ? 'こんにちは' : 'こんばんは'
}

/**
 * ホーム画面の写真（public/home/*.jpg）を背景にするスタイル。
 * 写真が読み込めない場合は、CSS の背景グラデーションがそのまま見える。
 */
const FALLBACK: Record<string, string> = {
  hero: 'linear-gradient(135deg, #2e9d6a 0%, #7cc576 55%, #f6c453 100%)',
  calorie: 'linear-gradient(135deg, #1f7a51 0%, #46b37b 100%)',
  ingredients: 'linear-gradient(135deg, #e0701a 0%, #f5a94a 100%)',
}

export function photoBg(name: string): { backgroundImage: string } {
  return {
    backgroundImage: [
      'linear-gradient(180deg, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.62))',
      `url("${import.meta.env.BASE_URL}home/${name}.jpg")`,
      FALLBACK[name] ?? FALLBACK.hero,
    ].join(', '),
  }
}
