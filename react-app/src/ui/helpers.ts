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
