import { useState } from 'react'
import type { Recipe } from '../types'
import { deleteRecipe, mine, useAppData } from '../store/store'
import { useRoute, navigate } from '../router'
import { normalizeName } from '../engine/foodDb'
import { Empty } from '../ui/common'
import { formatDate } from '../ui/helpers'
import { RecipeCard } from '../ui/RecipeCard'

type Tab = 'favorites' | 'saved' | 'history'

export function Saved() {
  const d = useAppData()
  const route = useRoute()
  const tab = (route.query.get('tab') as Tab) || 'saved'
  const [q, setQ] = useState({ name: '', food: '', kcalMax: '', proteinMin: '', fatMax: '', timeMax: '' })

  const favIds = new Set(mine(d, d.favorites).map((f) => f.recipeId))
  const saved = mine(d, d.recipes)
  const list: Recipe[] = tab === 'favorites' ? saved.filter((r) => favIds.has(r.id)) : tab === 'saved' ? saved : mine(d, d.history)

  const filtered = list.filter((r) => {
    if (q.name && !normalizeName(r.recipeName).includes(normalizeName(q.name))) return false
    if (q.food && !r.ingredients.some((i) => normalizeName(i.name).includes(normalizeName(q.food)))) return false
    if (q.kcalMax && r.nutrition.calories > Number(q.kcalMax)) return false
    if (q.proteinMin && r.nutrition.protein < Number(q.proteinMin)) return false
    if (q.fatMax && r.nutrition.fat > Number(q.fatMax)) return false
    if (q.timeMax && r.cookingTime > Number(q.timeMax)) return false
    return true
  })
  const set = (k: keyof typeof q, v: string) => setQ({ ...q, [k]: v })

  return (
    <div>
      <h1>レシピ</h1>
      <div className="tabs" role="tablist">
        {([['favorites', 'お気に入り'], ['saved', '保存済み'], ['history', '履歴']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => navigate(`saved?tab=${k}`)}>{label}</button>
        ))}
      </div>

      <details className="card tight" open={Object.values(q).some(Boolean)}>
        <summary>検索・絞り込み</summary>
        <div className="grid2" style={{ marginTop: 10 }}>
          <input type="search" placeholder="料理名" value={q.name} onChange={(e) => set('name', e.target.value)} />
          <input type="search" placeholder="食材名" value={q.food} onChange={(e) => set('food', e.target.value)} />
          <input type="number" placeholder="カロリー上限 kcal" value={q.kcalMax} onChange={(e) => set('kcalMax', e.target.value)} />
          <input type="number" placeholder="タンパク質 g以上" value={q.proteinMin} onChange={(e) => set('proteinMin', e.target.value)} />
          <input type="number" placeholder="脂質 g以下" value={q.fatMax} onChange={(e) => set('fatMax', e.target.value)} />
          <input type="number" placeholder="調理時間 分以内" value={q.timeMax} onChange={(e) => set('timeMax', e.target.value)} />
        </div>
      </details>

      {filtered.length === 0 && (
        <Empty>{list.length === 0 ? (tab === 'history' ? '閲覧したレシピがここに表示されます。' : tab === 'favorites' ? 'お気に入りに追加したレシピがここに表示されます。' : '保存したレシピがここに表示されます。') : '条件に合うレシピがありません。'}</Empty>
      )}
      {filtered.map((r) => (
        <RecipeCard
          key={r.id}
          recipe={r}
          extra={
            <div className="row between tiny muted" style={{ marginTop: 6 }}>
              <span>{tab === 'history' ? '閲覧' : '登録'}: {formatDate(r.updatedAt || r.createdAt)}</span>
              {tab !== 'history' && (
                <button className="btn danger small" onClick={() => { if (confirm(`「${r.recipeName}」を削除しますか？`)) deleteRecipe(r.id) }}>削除</button>
              )}
            </div>
          }
        />
      ))}
    </div>
  )
}
