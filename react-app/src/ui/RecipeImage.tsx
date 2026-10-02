import type { FoodCategory, Recipe } from '../types'
import { useState } from 'react'
import { useImageUrl } from '../cloud/images'
import { dishPhotoFor, dishPhotoUrl } from '../data/dishPhotos'

const CATEGORY_COLOR: Record<FoodCategory, string> = {
  肉類: '#e8a17a',
  魚介類: '#f2a38f',
  '卵・乳製品': '#f7d774',
  野菜: '#7cc576',
  きのこ類: '#c9a27e',
  '豆類・大豆製品': '#efe4c8',
  '穀類・主食': '#fbfaf3',
  果物: '#f48fb1',
  調味料: '#b98b5e',
  その他: '#cccccc',
}

/**
 * 完成イメージ（材料の種類と量から自動で描く図）。写真ではない。
 * 皿の上に材料の分類ごとの色を量に比例して配置する。
 */
function RecipeIllustration({ recipe, size = 220, categoryOf }: { recipe: Recipe; size?: number; categoryOf: (foodId: string | null) => FoodCategory }) {
  const items = recipe.ingredients.filter((i) => !i.fixed && i.amountG > 0)
  const carb = items.filter((i) => categoryOf(i.foodId) === '穀類・主食')
  const main = items.filter((i) => categoryOf(i.foodId) !== '穀類・主食')
  const total = main.reduce((s, i) => s + i.amountG, 0) || 1
  const isSoup = recipe.recipeName.includes('スープ') || recipe.recipeName.includes('汁')
  const isBowl = isSoup || recipe.recipeName.includes('丼') || recipe.recipeName.includes('ライス') || recipe.recipeName.includes('ボウル')

  // 材料ごとのかたまり（決定的な配置）
  let seed = [...recipe.recipeName].reduce((s, ch) => s + ch.charCodeAt(0), 0)
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }
  const blobs: { x: number; y: number; r: number; color: string }[] = []
  for (const ing of main) {
    const color = CATEGORY_COLOR[categoryOf(ing.foodId)]
    const count = Math.max(2, Math.round((ing.amountG / total) * 14))
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2
      const d = Math.sqrt(rand()) * 52
      blobs.push({ x: 110 + Math.cos(a) * d, y: 110 + Math.sin(a) * d * 0.8, r: 9 + rand() * 9, color })
    }
  }
  return (
    <svg viewBox="0 0 220 220" width={size} height={size} role="img" aria-label={`${recipe.recipeName}のイメージ図`} style={{ display: 'block', maxWidth: '100%', height: 'auto', background: '#fffaf2', borderRadius: 14 }}>
      {carb.length > 0 && !isBowl && <ellipse cx="178" cy="52" rx="30" ry="24" fill="#f6f1e6" stroke="#e2d9c4" strokeWidth="2" />}
      {carb.length > 0 && !isBowl && <ellipse cx="178" cy="48" rx="20" ry="13" fill="#fdfcf7" />}
      <ellipse cx="110" cy="118" rx="96" ry="84" fill={isBowl ? '#5b8fa8' : '#ffffff'} stroke="#e6e2d8" strokeWidth="3" />
      <ellipse cx="110" cy="114" rx="80" ry="68" fill={isSoup ? '#f3d9a6' : isBowl ? '#fdfcf7' : '#fbfbf9'} />
      {blobs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill={b.color} opacity="0.92" stroke="#ffffff" strokeWidth="1.5" />)}
      <text x="12" y="210" fontSize="10" fill="#9a9a9a">イメージ図（自動描画）</text>
    </svg>
  )
}

/**
 * 料理の画像。優先順位:
 * 1. AIで生成した写真風の画像（ログイン時に作成したもの）
 * 2. 料理の種類ごとのイメージ写真（Unsplash）
 * 3. 写真が読み込めない場合は、材料から描くイメージ図
 */
export function RecipeImage({ recipe, size = 220, categoryOf }: { recipe: Recipe; size?: number; categoryOf: (foodId: string | null) => FoodCategory }) {
  const aiUrl = useImageUrl(recipe.imagePath)
  const main = recipe.ingredients.find((i) => i.role === 'protein' && !i.fixed)
  const mainIsFish = main ? categoryOf(main.foodId) === '魚介類' : false
  const stockUrl = dishPhotoUrl(dishPhotoFor(recipe, mainIsFish))
  const [failed, setFailed] = useState<string | null>(null)
  const url = aiUrl ?? (failed === stockUrl ? null : stockUrl)
  if (!url) return <RecipeIllustration recipe={recipe} size={size} categoryOf={categoryOf} />
  const caption = aiUrl ? 'AI生成イメージ' : '写真はイメージです'
  return (
    <figure style={{ margin: 0, position: 'relative' }}>
      <img
        src={url}
        alt={aiUrl ? `${recipe.recipeName}のAI生成イメージ` : `${recipe.recipeName}のイメージ写真`}
        width={size}
        height={size}
        loading="lazy"
        onError={() => { if (!aiUrl) setFailed(stockUrl) }}
        style={{ display: 'block', width: '100%', maxWidth: size, height: 'auto', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: size >= 160 ? 14 : 12, background: '#f1efe8' }}
      />
      {size >= 160 && <figcaption className="tiny" style={{ position: 'absolute', left: 8, bottom: 6, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{caption}</figcaption>}
    </figure>
  )
}
