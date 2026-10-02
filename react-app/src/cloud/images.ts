import { useEffect, useState } from 'react'
import type { Recipe } from '../types'
import { functionErrorMessage, getSupabase } from './supabase'

const BUCKET = 'recipe-images'
const URL_TTL = 60 * 60
const cache = new Map<string, { url: string; expires: number }>()

/** レシピの料理写真風画像を生成し、保存先のパスを返す（ログインが必要） */
export async function generateRecipeImage(recipe: Recipe): Promise<string> {
  const sb = getSupabase()
  if (!sb) throw new Error('クラウド機能が設定されていません。')
  const { data, error } = await sb.functions.invoke<{ path: string }>('generate-image', {
    body: {
      recipeId: recipe.id.replace(/[^A-Za-z0-9_-]/g, ''),
      recipeName: recipe.recipeName.slice(0, 80),
      ingredients: recipe.ingredients.filter((i) => !i.fixed && i.amountG > 0).map((i) => i.name.slice(0, 40)).slice(0, 25),
      genre: recipe.genre ?? undefined,
      method: recipe.method ?? undefined,
    },
  })
  if (error) throw new Error(await functionErrorMessage(error))
  if (!data?.path) throw new Error('サーバーの応答が不正です。')
  cache.delete(data.path)
  return data.path
}

/** 非公開バケットの画像を表示するための一時URL（1時間有効）。取得できなければ null */
export function useImageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const c = path ? cache.get(path) : undefined
    return c && c.expires > Date.now() ? c.url : null
  })
  useEffect(() => {
    let alive = true
    const sb = getSupabase()
    if (!path || !sb) return
    const c = cache.get(path)
    if (c && c.expires > Date.now()) return
    sb.storage.from(BUCKET).createSignedUrl(path, URL_TTL).then(({ data }) => {
      if (!alive || !data?.signedUrl) return
      cache.set(path, { url: data.signedUrl, expires: Date.now() + (URL_TTL - 60) * 1000 })
      setUrl(data.signedUrl)
    })
    return () => {
      alive = false
    }
  }, [path])
  return path ? url : null
}
