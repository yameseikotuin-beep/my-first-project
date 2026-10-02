import { useState } from 'react'
import type { InventoryItem, InventoryUnit } from '../types'
import { mine, update, useAppData } from '../store/store'
import { setSession, toast } from '../store/session'
import { daysUntil, isExpired, matchInventoryFood, useUpCandidates } from '../engine/shopping'
import { navigate } from '../router'
import { Empty, Field, today, useFoodDb } from '../ui/common'
import { initialForm } from './GenerateForm'
import { activeProfile, settingsFor } from '../store/store'
import { newId } from '../util/id'

const UNITS: InventoryUnit[] = ['g', 'ml', '個', '本', 'パック', '袋', '枚', '切れ', '束', '玉', '缶']

export function Inventory() {
  const d = useAppData()
  const db = useFoodDb()
  const items = mine(d, d.inventory)
  const t = today()
  const [f, setF] = useState({ name: '', amount: '', unit: 'g' as InventoryUnit, expiry: '' })
  const { usable, expired } = useUpCandidates(items, t)

  function add() {
    const amount = Number(f.amount)
    if (!f.name.trim() || !(amount > 0)) return
    const item: InventoryItem = { id: newId(), userId: d.activeUserId, name: f.name.trim(), foodId: matchInventoryFood(db, f.name), amount, unit: f.unit, expiry: f.expiry || null, createdAt: new Date().toISOString() }
    update((dd) => ({ ...dd, inventory: [...dd.inventory, item] }))
    setF({ name: '', amount: '', unit: 'g', expiry: '' })
  }

  function suggest() {
    // 期限の近い順に最大3品を「使い切りたい食材」、残りを「使いたい食材」として食材指定に渡す
    const withFood = usable.filter((i) => i.foodId)
    const useUp = withFood.slice(0, 3).map((i) => db.get(i.foodId)!.displayName)
    const use = withFood.slice(3, 8).map((i) => db.get(i.foodId)!.displayName)
    const profile = activeProfile(d)
    const form = { ...initialForm('ingredients', settingsFor(d).mealCalories, profile?.avoidFoods ?? [], profile?.allergens ?? []), useUpFoods: useUp, useFoods: use }
    setSession((s) => ({ ...s, drafts: { ...s.drafts, 'form-ingredients': form } }))
    if (expired.length) toast(`期限切れの${expired.length}品は提案に使っていません`)
    navigate('ingredients')
  }

  return (
    <div>
      <h1>食材の在庫</h1>
      <p className="small muted">自宅にある食材を登録すると、買い物リストで在庫を差し引き、期限の近い食材を使ったレシピを提案できます。</p>
      <div className="card">
        <Field label="食材名"><input type="text" list="inv-foods" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <datalist id="inv-foods">{db.all.map((x) => <option key={x.id} value={x.displayName} />)}</datalist>
        <div className="grid3">
          <Field label="保有量"><input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="単位">
            <select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as InventoryUnit })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </Field>
          <Field label="期限（任意）"><input type="date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></Field>
        </div>
        {f.name && !matchInventoryFood(db, f.name) && <p className="tiny" style={{ color: '#9a5410' }}>食品成分データにない名前です。登録はできますが、レシピ提案や在庫の差し引きには使われません。</p>}
        <button className="btn primary" disabled={!f.name.trim() || !(Number(f.amount) > 0)} onClick={add}>登録</button>
      </div>

      {usable.some((i) => i.foodId) && <button className="btn accent block" style={{ marginBottom: 14 }} onClick={suggest}>期限の近い食材を使い切るレシピを提案</button>}
      {expired.length > 0 && <div className="banner failed small">期限切れの食材が{expired.length}品あります。安全性は保証できないため、レシピ提案には使いません。</div>}

      {items.length === 0 && <Empty>登録された在庫はありません。</Empty>}
      {[...usable, ...expired].map((i) => {
        const days = i.expiry ? daysUntil(i.expiry, t) : null
        const exp = isExpired(i, t)
        return (
          <div key={i.id} className="card tight row between">
            <span>
              <b>{i.name}</b> {i.amount}{i.unit}
              {!i.foodId && <span className="chip gray" style={{ marginLeft: 6 }}>未照合</span>}
              <div className="tiny">
                {i.expiry ? (exp ? <span className="chip bad">期限切れ（{i.expiry}）</span> : days !== null && days <= 2 ? <span className="chip warn">あと{days}日（{i.expiry}）</span> : <span className="muted">期限 {i.expiry}</span>) : <span className="muted">期限未登録</span>}
                <span className="muted">・登録 {i.createdAt.slice(0, 10)}</span>
              </div>
            </span>
            <span className="row">
              <input type="number" style={{ width: 80 }} value={i.amount} min={0} onChange={(e) => update((dd) => ({ ...dd, inventory: dd.inventory.map((x) => (x.id === i.id ? { ...x, amount: Math.max(0, Number(e.target.value) || 0) } : x)) }))} aria-label={`${i.name}の保有量`} />
              <button className="btn danger small" onClick={() => update((dd) => ({ ...dd, inventory: dd.inventory.filter((x) => x.id !== i.id) }))}>削除</button>
            </span>
          </div>
        )
      })}
    </div>
  )
}
