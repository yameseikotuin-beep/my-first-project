import { useState } from 'react'
import type { Food, FoodCategory, FoodRole } from '../types'
import { update, useAppData } from '../store/store'
import { toast } from '../store/session'
import { normalizeName } from '../engine/foodDb'
import { CATEGORY_ORDER } from '../engine/shopping'
import { FOOD_SOURCE } from '../data/foods'
import { Field, useFoodDb } from '../ui/common'
import { newId } from '../util/id'

const ROLE_BY_CATEGORY: Record<FoodCategory, FoodRole> = {
  肉類: 'protein', 魚介類: 'protein', '卵・乳製品': 'protein', 野菜: 'veg', きのこ類: 'veg', '豆類・大豆製品': 'protein',
  '穀類・主食': 'carb', 果物: 'fruit', 調味料: 'seasoning', その他: 'veg',
}

export function Foods() {
  const db = useFoodDb()
  const d = useAppData()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FoodCategory | ''>('')
  const list = db.all.filter((f) => (!cat || f.category === cat) && (!q || [f.displayName, f.name, ...f.aliases].some((n) => normalizeName(n).includes(normalizeName(q)))))

  return (
    <div>
      <h1>食材データベース</h1>
      <div className="banner info small">
        出典: {FOOD_SOURCE}（可食部100gあたり）。カロリーは成分表の「エネルギー(kcal)」、炭水化物は「炭水化物」の値です。
        <br />現在の値は成分表から手入力したもので、公式ファイルとの機械照合はまだ行っていません（「未照合」表示）。
      </div>
      <div className="grid2">
        <input type="search" placeholder="食品名で検索" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={cat} onChange={(e) => setCat(e.target.value as FoodCategory | '')}>
          <option value="">すべての分類</option>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="tiny muted">{list.length}件</p>
      <div className="card tight scroll-x">
        <table className="compare" style={{ minWidth: 560 }}>
          <thead>
            <tr><th>食品</th><th>kcal</th><th>P</th><th>F</th><th>C</th><th>繊維</th><th>塩</th></tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id}>
                <td>
                  <b>{f.displayName}</b>
                  <div className="tiny muted">{f.id.startsWith('custom') ? '' : `${f.id} `}{f.name}（{f.state}）</div>
                  <div className="tiny">
                    {f.estimated ? <span className="chip warn">推定値</span> : f.verification === 'verified' ? <span className="chip">照合済み</span> : f.verification === 'user' ? <span className="chip gray">ユーザー登録</span> : <span className="chip gray">未照合</span>}
                    {f.allergens.length > 0 && <span className="muted"> アレルゲン: {f.allergens.join('・')}</span>}
                  </div>
                  {f.id.startsWith('custom') && (
                    <button className="btn danger small" style={{ marginTop: 4 }} onClick={() => { if (confirm(`「${f.displayName}」を削除しますか？`)) update((dd) => ({ ...dd, customFoods: dd.customFoods.filter((x) => x.id !== f.id) })) }}>削除</button>
                  )}
                </td>
                <td>{f.calories}</td><td>{f.protein}</td><td>{f.fat}</td><td>{f.carbohydrates}</td><td>{f.fiber ?? '-'}</td><td>{f.salt ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddCustomFood existing={d.customFoods} />
    </div>
  )
}

function AddCustomFood({ existing }: { existing: Food[] }) {
  const [f, setF] = useState({ name: '', category: '野菜' as FoodCategory, kcal: '', p: '', fat: '', c: '', fiber: '', salt: '', source: '' })
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })
  const nums = [f.kcal, f.p, f.fat, f.c].map(Number)
  const valid = f.name.trim() && f.source.trim() && [f.kcal, f.p, f.fat, f.c].every((x) => x !== '') && nums.every((x) => Number.isFinite(x) && x >= 0) && nums[1] + nums[2] + nums[3] <= 100

  function add() {
    if (!valid) return
    const food: Food = {
      id: `custom-${newId()}`,
      name: f.name.trim(),
      displayName: f.name.trim(),
      aliases: [],
      category: f.category,
      role: ROLE_BY_CATEGORY[f.category],
      state: '生',
      referenceWeight: 100,
      calories: Number(f.kcal), protein: Number(f.p), fat: Number(f.fat), carbohydrates: Number(f.c),
      fiber: f.fiber === '' ? null : Number(f.fiber),
      salt: f.salt === '' ? null : Number(f.salt),
      allergens: [],
      source: `ユーザー入力（推定値）: ${f.source.trim()}`,
      sourceVersion: '-',
      updatedAt: new Date().toISOString().slice(0, 10),
      verification: 'user',
      estimated: true,
    }
    update((d) => ({ ...d, customFoods: [...d.customFoods, food] }))
    toast(`「${food.displayName}」を推定値として登録しました`)
    setF({ ...f, name: '', kcal: '', p: '', fat: '', c: '', fiber: '', salt: '', source: '' })
  }

  return (
    <details className="card" style={{ marginTop: 14 }}>
      <summary>成分表にない食材を登録する（推定値）</summary>
      <p className="tiny muted">商品の栄養成分表示などから可食部100gあたりの値を入力します。登録した食材を使ったレシピには「推定値を含む」と表示し、確定値としては扱いません。登録済み: {existing.length}件</p>
      <Field label="食品名"><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
      <Field label="分類">
        <select value={f.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <div className="grid3">
        <Field label="エネルギー kcal"><input type="number" value={f.kcal} onChange={(e) => set('kcal', e.target.value)} /></Field>
        <Field label="タンパク質 g"><input type="number" value={f.p} onChange={(e) => set('p', e.target.value)} /></Field>
        <Field label="脂質 g"><input type="number" value={f.fat} onChange={(e) => set('fat', e.target.value)} /></Field>
        <Field label="炭水化物 g"><input type="number" value={f.c} onChange={(e) => set('c', e.target.value)} /></Field>
        <Field label="食物繊維 g（任意）"><input type="number" value={f.fiber} onChange={(e) => set('fiber', e.target.value)} /></Field>
        <Field label="食塩相当量 g（任意）"><input type="number" value={f.salt} onChange={(e) => set('salt', e.target.value)} /></Field>
      </div>
      <Field label="値の根拠" hint="例: 商品パッケージの栄養成分表示"><input type="text" value={f.source} onChange={(e) => set('source', e.target.value)} /></Field>
      <button className="btn primary" disabled={!valid} onClick={add}>推定値として登録</button>
    </details>
  )
}
