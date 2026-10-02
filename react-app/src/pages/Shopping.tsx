import { useState } from 'react'
import type { FoodCategory, Recipe, ShoppingItem, ShoppingList } from '../types'
import { mine, update, useAppData } from '../store/store'
import { toast } from '../store/session'
import { buildShoppingItems, CATEGORY_ORDER, formatAmount, shoppingText, unitLabel } from '../engine/shopping'
import { useRoute, navigate } from '../router'
import { Empty, formatDate, today, useFoodDb } from '../ui/common'
import { UNIT_BASIS } from '../data/foods'
import { newId } from '../util/id'

export function Shopping() {
  const route = useRoute()
  const d = useAppData()
  const id = route.path[1]
  if (id) {
    const list = d.shoppingLists.find((l) => l.id === id)
    return list ? <ListView list={list} /> : <p>買い物リストが見つかりません。</p>
  }
  return <ListBuilder initialPlan={route.query.get('plan')} />
}

function ListBuilder({ initialPlan }: { initialPlan: string | null }) {
  const d = useAppData()
  const db = useFoodDb()
  const recipes = mine(d, d.recipes)
  const plans = mine(d, d.mealPlans)
  const [selRecipes, setSelRecipes] = useState<Record<string, number>>({})
  const [selPlans, setSelPlans] = useState<string[]>(initialPlan ? [initialPlan] : [])
  const [useInventory, setUseInventory] = useState(true)

  function create() {
    const sources: { recipe: Recipe; servings: number }[] = []
    const names: string[] = []
    for (const [rid, servings] of Object.entries(selRecipes)) {
      const r = recipes.find((x) => x.id === rid)
      if (r && servings > 0) {
        sources.push({ recipe: r, servings })
        names.push(`${r.recipeName}（${servings}人前）`)
      }
    }
    for (const pid of selPlans) {
      const p = plans.find((x) => x.id === pid)
      if (!p) continue
      names.push(p.name)
      for (const day of p.days) for (const m of day.meals) if (m.recipe) sources.push({ recipe: m.recipe, servings: m.recipe.servings })
    }
    if (!sources.length) return
    const { items, notes } = buildShoppingItems(db, sources, useInventory ? mine(d, d.inventory) : [], today())
    const now = new Date().toISOString()
    const list: ShoppingList = { id: newId(), userId: d.activeUserId, name: `${today()} の買い物`, sources: [...names, ...notes.map((n) => `※${n}`)], items, createdAt: now, updatedAt: now }
    update((dd) => ({ ...dd, shoppingLists: [list, ...dd.shoppingLists] }))
    navigate(`shopping/${list.id}`)
  }

  const lists = mine(d, d.shoppingLists)
  return (
    <div>
      <h1>買い物リスト</h1>
      {lists.length > 0 && (
        <div className="card tight">
          <h2>保存したリスト</h2>
          {lists.map((l) => (
            <div key={l.id} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <a href={`#/shopping/${l.id}`}>{l.name}</a>
              <span className="tiny muted">{l.items.filter((i) => i.checked).length}/{l.items.length} 購入済み・{formatDate(l.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <h2>新しく作る</h2>
      <div className="card">
        <h3>食事プランから</h3>
        {plans.length === 0 && <p className="small muted">保存した食事プランがありません。<a href="#/plan">食事プランを作る</a></p>}
        {plans.map((p) => (
          <label key={p.id} className="row small" style={{ padding: '4px 0' }}>
            <input type="checkbox" checked={selPlans.includes(p.id)} onChange={(e) => setSelPlans(e.target.checked ? [...selPlans, p.id] : selPlans.filter((x) => x !== p.id))} />
            {p.name}（{p.days.length}日分）
          </label>
        ))}
      </div>
      <div className="card">
        <h3>保存したレシピから</h3>
        {recipes.length === 0 && <p className="small muted">保存したレシピがありません。</p>}
        {recipes.map((r) => (
          <div key={r.id} className="row between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ flex: 1 }}>{r.recipeName}</span>
            <select style={{ width: 100 }} value={selRecipes[r.id] ?? 0} onChange={(e) => setSelRecipes({ ...selRecipes, [r.id]: Number(e.target.value) })}>
              <option value={0}>使わない</option>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}人前</option>)}
            </select>
          </div>
        ))}
      </div>
      <label className="row small" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={useInventory} onChange={(e) => setUseInventory(e.target.checked)} />
        在庫を差し引いて、不足分だけ表示する（<a href="#/inventory">在庫 {mine(d, d.inventory).length}件</a>）
      </label>
      <button className="btn primary block" disabled={!selPlans.length && !Object.values(selRecipes).some((v) => v > 0)} onClick={create}>買い物リストを作る</button>
    </div>
  )
}

function ListView({ list }: { list: ShoppingList }) {
  const db = useFoodDb()
  const [newItem, setNewItem] = useState({ name: '', g: '' })
  const save = (items: ShoppingItem[], extra: Partial<ShoppingList> = {}) =>
    update((d) => ({ ...d, shoppingLists: d.shoppingLists.map((l) => (l.id === list.id ? { ...l, ...extra, items, updatedAt: new Date().toISOString() } : l)) }))
  const setItem = (key: string, patch: Partial<ShoppingItem>) => save(list.items.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  const visible = list.items.filter((i) => i.buyG > 0 || i.manual)
  const covered = list.items.filter((i) => i.buyG === 0 && !i.manual)

  async function copy() {
    try {
      await navigator.clipboard.writeText(shoppingText(list.name, list.items))
      toast('テキストをコピーしました')
    } catch {
      toast('コピーできませんでした（ブラウザの権限を確認してください）')
    }
  }

  return (
    <div>
      <div className="row between hide-print">
        <a href="#/shopping" className="small">← 買い物リスト一覧</a>
        <div className="row">
          <button className="btn small" onClick={copy}>テキストをコピー</button>
          <button className="btn small" onClick={() => window.print()}>印刷</button>
          <button className="btn small danger" onClick={() => { if (confirm('この買い物リストを削除しますか？')) { update((d) => ({ ...d, shoppingLists: d.shoppingLists.filter((l) => l.id !== list.id) })); navigate('shopping') } }}>削除</button>
        </div>
      </div>
      <h1 style={{ marginTop: 10 }}>
        <input type="text" className="hide-print" value={list.name} onChange={(e) => save(list.items, { name: e.target.value })} style={{ fontWeight: 700 }} />
        <span style={{ display: 'none' }} className="print-only">{list.name}</span>
      </h1>
      <details className="small muted hide-print"><summary>元にしたレシピ・注意</summary><ul>{list.sources.map((s) => <li key={s}>{s}</li>)}</ul></details>

      {CATEGORY_ORDER.map((cat) => {
        const items = visible.filter((i) => i.category === cat)
        if (!items.length) return null
        return (
          <div className="card tight" key={cat}>
            <h3>【{cat}】</h3>
            {items.map((i) => (
              <div key={i.key} className={`shop-item ${i.checked ? 'done' : ''}`}>
                <input type="checkbox" checked={i.checked} onChange={(e) => setItem(i.key, { checked: e.target.checked })} aria-label={`${i.name}を購入済みにする`} />
                <span className="name">
                  {i.name}{i.state && i.state !== '加工品' && <span className="tiny muted">（{i.state}）</span>}
                  <div className="tiny muted">
                    {i.isSeasoning ? '必要量' : '必要量'} {formatAmount(i.requiredG)}
                    {i.stockG > 0 && ` − 在庫 ${formatAmount(i.stockG)}`}
                  </div>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span className="input-suffix hide-print" style={{ width: 110 }}>
                    <input type="number" min={0} value={Math.round(i.buyG)} onChange={(e) => {
                      const g = Math.max(0, Number(e.target.value) || 0)
                      setItem(i.key, { buyG: g, unitLabel: i.isSeasoning ? null : unitLabel(db, i.foodId, g) })
                    }} />g
                  </span>
                  <div className="tiny">{i.isSeasoning ? '（調味料：必要量）' : i.unitLabel ?? ''}</div>
                </span>
                <button className="btn ghost small hide-print" aria-label={`${i.name}を削除`} onClick={() => save(list.items.filter((x) => x.key !== i.key))}>×</button>
              </div>
            ))}
          </div>
        )
      })}

      {covered.length > 0 && <p className="small muted">在庫で足りる食材: {covered.map((i) => i.name).join('、')}</p>}
      <p className="tiny muted">「約○個」などは目安です。{UNIT_BASIS} 実際の販売単位（パック・袋など）は店舗で確認してください。</p>

      <div className="card tight hide-print">
        <h3>品目を追加</h3>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input type="text" placeholder="品名" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
          <input type="number" placeholder="g" style={{ width: 90 }} value={newItem.g} onChange={(e) => setNewItem({ ...newItem, g: e.target.value })} />
          <button className="btn small" disabled={!newItem.name.trim()} onClick={() => {
            const g = Number(newItem.g) || 0
            const cat: FoodCategory = 'その他'
            save([...list.items, { key: `manual|${newId()}`, foodId: null, name: newItem.name.trim(), category: cat, state: null, requiredG: g, stockG: 0, buyG: g, unitLabel: null, isSeasoning: false, checked: false, manual: true }])
            setNewItem({ name: '', g: '' })
          }}>追加</button>
        </div>
      </div>
    </div>
  )
}

export { Empty }
