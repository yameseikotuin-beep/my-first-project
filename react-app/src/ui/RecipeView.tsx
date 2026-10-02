import { useEffect, useState } from 'react'
import type { Food, Recipe } from '../types'
import { DIFFICULTY_LABEL } from '../types'
import { addHistory, isFavorite, saveRecipe, toggleFavorite, useAppData } from '../store/store'
import { putWorking, toast } from '../store/session'
import { adjustRecipe, ADJUST_LABEL, substituteIngredient, substituteOptions, type AdjustOp } from '../engine/adjust'
import { recalcRecipe } from '../engine/draft'
import { scaledIngredients } from '../engine/servings'
import { matchFood } from '../engine/foodDb'
import { fmt0, fmt1, PfcBar, PfcNumbers, StatusBadge, TargetCompare, useFoodDb } from './common'
import { RecipeImage } from './RecipeImage'

const OPS: AdjustOp[] = ['kcal-100', 'kcal+100', 'protein+10', 'fat-5', 'carb-10', 'lowfat', 'highprotein', 'faster']

export function RecipeView({ initial, onRegenerate }: { initial: Recipe; onRegenerate?: () => void }) {
  const d = useAppData()
  const db = useFoodDb()
  const [recipe, setRecipe] = useState(initial)
  const [prev, setPrev] = useState<Recipe | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [subIndex, setSubIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const saved = d.recipes.find((r) => r.id === recipe.id)
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify({ ...recipe, userId: saved.userId, updatedAt: saved.updatedAt })
  const fav = isFavorite(d, recipe.id)

  useEffect(() => {
    // 閲覧したレシピを履歴に残す
    addHistory(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id])

  function apply(next: Recipe, msg: string) {
    setPrev(recipe)
    setRecipe(next)
    putWorking(next)
    setMessage(msg)
  }

  function runAdjust(op: AdjustOp) {
    try {
      const r = adjustRecipe(db, recipe, op)
      if (r.recipe) apply(r.recipe, r.message)
      else setMessage(r.message)
    } catch {
      setMessage('調整中にエラーが発生しました。もう一度お試しください。')
    }
  }

  const scaled = scaledIngredients(recipe)
  const n = recipe.nutrition
  const v = recipe.validation

  return (
    <div>
      <div className="card">
        <div className="grid2" style={{ alignItems: 'center' }}>
          <RecipeImage recipe={recipe} categoryOf={(id) => db.get(id)?.category ?? 'その他'} />
          <div>
            <div className="tiny muted">1人前あたり</div>
            <div className="kcal-big">{fmt0(n.calories)}<small>kcal</small></div>
            <div className="tiny muted">目標 {recipe.targets.maxCalories}kcal以内</div>
          </div>
        </div>
        <h1 style={{ marginTop: 12 }}>{editing ? <input type="text" value={recipe.recipeName} onChange={(e) => setRecipe({ ...recipe, templateId: null, recipeName: e.target.value })} /> : recipe.recipeName}</h1>
        <p>{recipe.description}</p>
        <div className="row small muted" style={{ gap: 12 }}>
          <StatusBadge status={v.status} />
          <span>⏱ {recipe.cookingTime}分</span>
          <span>難易度: {DIFFICULTY_LABEL[recipe.difficulty]}</span>
          {recipe.genre && <span>{recipe.genre}</span>}
          {recipe.method && <span>{recipe.method}</span>}
        </div>
        <PfcNumbers n={n} />
        <PfcBar ratio={recipe.pfcRatio} />
        <div className="row small muted" style={{ marginTop: 8, gap: 14 }}>
          <span>食物繊維 {fmt1(n.fiber)}g</span>
          <span>食塩相当量 {fmt1(n.salt)}g</span>
        </div>
      </div>

      {v.status !== 'ok' && (
        <div className={`banner ${v.status}`}>
          {v.messages.map((m) => <div key={m}>{m}</div>)}
          <ul>{v.checks.filter((c) => !c.ok).map((c) => <li key={c.key}>{c.label}: {c.detail}</li>)}</ul>
        </div>
      )}
      {message && <div className="banner info small">{message}{prev && <button className="btn ghost small" onClick={() => { setRecipe(prev); putWorking(prev); setPrev(null); setMessage('元に戻しました。') }}>元に戻す</button>}</div>}

      <div className="row hide-print" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={() => { saveRecipe(recipe); toast('レシピを保存しました') }} disabled={!dirty}>{saved ? (dirty ? '変更を保存' : '保存済み') : '保存'}</button>
        <button className="btn" onClick={() => { toggleFavorite(recipe); toast(fav ? 'お気に入りから外しました' : 'お気に入りに追加しました') }} aria-pressed={fav}>{fav ? '★ お気に入り' : '☆ お気に入り'}</button>
        {onRegenerate && <button className="btn" onClick={onRegenerate}>再生成</button>}
        <button className="btn" onClick={() => {
          if (editing) setRecipe(recalcRecipe(db, { ...recipe, steps: recipe.steps.filter((x) => x.trim()) }))
          setEditing(!editing)
        }}>{editing ? '編集を終える' : '編集'}</button>
      </div>

      <div className="card">
        <h2>目標値との比較</h2>
        <TargetCompare n={n} t={recipe.targets} />
        <details style={{ marginTop: 10 }}>
          <summary className="small">検証結果（{v.checks.filter((c) => c.ok).length}/{v.checks.length}項目OK）</summary>
          <ul className="checks" style={{ marginTop: 6 }}>
            {v.checks.map((c) => (
              <li key={c.key}><span>{c.ok ? '✅' : c.level === 'soft' || c.level === 'quality' ? '⚠️' : '❌'}</span><span><b>{c.label}</b><br /><span className="muted">{c.detail}</span></span></li>
            ))}
          </ul>
        </details>
      </div>

      <div className="card hide-print">
        <h2>栄養条件の調整</h2>
        <p className="tiny muted">材料と分量を変更し、成分データから再計算します。</p>
        <div className="chips">
          {OPS.map((op) => <button key={op} className="btn small" onClick={() => runAdjust(op)}>{ADJUST_LABEL[op]}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>材料</h2>
          <label className="row small">
            人数
            <select style={{ width: 90 }} value={recipe.servings} onChange={(e) => { const r = { ...recipe, servings: Number(e.target.value) }; setRecipe(r); putWorking(r) }}>
              {[1, 2, 3, 4, 5, 6].map((k) => <option key={k} value={k}>{k}人前</option>)}
            </select>
          </label>
        </div>
        {recipe.servings > 1 && (
          <p className="small" style={{ marginTop: 6 }}>
            {recipe.servings}人前の合計: <b>{fmt0(scaled.total.calories)}kcal</b> / P {fmt1(scaled.total.protein)}g / F {fmt1(scaled.total.fat)}g / C {fmt1(scaled.total.carbohydrates)}g
            <br /><span className="muted">1人前: {fmt0(n.calories)}kcal / P {fmt1(n.protein)}g / F {fmt1(n.fat)}g / C {fmt1(n.carbohydrates)}g</span>
          </p>
        )}
        <table className="ing-table">
          <tbody>
            {scaled.items.map((ing, i) => (
              <tr key={`${ing.foodId}-${i}`} className={ing.fixed ? 'seasoning' : ''}>
                <td>
                  {ing.name}
                  {ing.added && <span className="chip warn" style={{ marginLeft: 6, padding: '0 6px' }}>追加</span>}
                  {ing.matchStatus === 'unmatched' && <span className="chip bad" style={{ marginLeft: 6, padding: '0 6px' }}>成分データなし</span>}
                  {ing.estimated && <span className="chip warn" style={{ marginLeft: 6, padding: '0 6px' }}>推定値</span>}
                  <div className="tiny muted">
                    {ing.foodState ?? ''}{ing.nutrition ? ` ・ ${fmt0(ing.nutrition.calories)}kcal P${fmt1(ing.nutrition.protein)} F${fmt1(ing.nutrition.fat)} C${fmt1(ing.nutrition.carbohydrates)}` : ''}
                  </div>
                </td>
                <td className="amt">
                  {editing ? (
                    <span className="input-suffix" style={{ width: 110 }}>
                      <input type="number" min={0} step={1} value={recipe.ingredients[i].amountG} onChange={(e) => {
                        const amount = Math.max(0, Number(e.target.value) || 0)
                        const r = recalcRecipe(db, { ...recipe, ingredients: recipe.ingredients.map((x, j) => (j === i ? { ...x, amountG: amount } : x)) })
                        setRecipe(r)
                      }} />g
                    </span>
                  ) : `${fmt1(ing.amountG)}g`}
                  {!editing && ing.foodId && <div><button className="btn ghost small hide-print" onClick={() => setSubIndex(subIndex === i ? null : i)}>置き換え</button></div>}
                  {editing && <div><button className="btn ghost small" onClick={() => setRecipe(recalcRecipe(db, { ...recipe, ingredients: recipe.ingredients.filter((_, j) => j !== i) }))}>削除</button></div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subIndex !== null && <SubstitutePanel recipe={recipe} index={subIndex} onPick={(f) => {
          const r = substituteIngredient(db, recipe, subIndex, f.id)
          setSubIndex(null)
          if (r) apply(r, `「${recipe.ingredients[subIndex].name}」を「${f.displayName}」に置き換えて再計算しました（${fmt0(r.nutrition.calories - recipe.nutrition.calories)}kcal、F ${fmt1(r.nutrition.fat - recipe.nutrition.fat)}g）。`)
          else setMessage('置き換えできませんでした。')
        }} onClose={() => setSubIndex(null)} />}
        {editing && <AddIngredient onAdd={(food, g) => setRecipe(recalcRecipe(db, { ...recipe, templateId: null, ingredients: [...recipe.ingredients, { foodId: food.id, name: food.displayName, amountG: g, foodState: food.state, role: food.role, fixed: food.category === '調味料', added: true, nutrition: null, matchStatus: 'exact', estimated: food.estimated }] }))} />}
        {scaled.notes.map((x) => <p key={x} className="tiny muted" style={{ marginTop: 6 }}>※{x}</p>)}
      </div>

      <div className="card">
        <h2>作り方</h2>
        {editing ? (
          <textarea rows={Math.max(6, recipe.steps.length + 2)} value={recipe.steps.join('\n')} onChange={(e) => setRecipe(recalcRecipe(db, { ...recipe, templateId: null, steps: e.target.value.split('\n') }))} />
        ) : (
          <ol className="steps">{recipe.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        )}
      </div>

      <div className="card">
        <h2>栄養面の特徴・ダイエットのポイント</h2>
        <ul>{recipe.points.map((p) => <li key={p}>{p}</li>)}</ul>
        {recipe.unusedFoods.length > 0 && (
          <>
            <h3>使わなかった指定食材</h3>
            <ul>{recipe.unusedFoods.map((u) => <li key={u.name}>{u.name}: {u.reason}</li>)}</ul>
          </>
        )}
      </div>

      <div className="card small">
        <h2>栄養計算の精度・注意事項</h2>
        <p>{recipe.nutritionSource}。カロリーは成分表のエネルギー値の合計、PFC比率はP・Cを4kcal/g、Fを9kcal/gとして計算しています（PFC由来のエネルギー {fmt0(recipe.pfcEnergy)}kcal）。</p>
        <ul className="muted">{recipe.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      </div>
    </div>
  )
}

function SubstitutePanel({ recipe, index, onPick, onClose }: { recipe: Recipe; index: number; onPick: (f: Food) => void; onClose: () => void }) {
  const db = useFoodDb()
  const opts = substituteOptions(db, recipe, index)
  return (
    <div className="banner info small" style={{ marginTop: 10 }}>
      <div className="row between"><b>「{recipe.ingredients[index].name}」の置き換え候補</b><button className="btn ghost small" onClick={onClose}>閉じる</button></div>
      {opts.length === 0 && <p>置き換え候補がありません。</p>}
      {opts.map((o) => (
        <div key={o.food.id} style={{ padding: '6px 0', borderTop: '1px solid #cfe0f3' }}>
          <div className="row between">
            <span><b>{o.food.displayName}</b> <span className="tiny muted">100gあたり {o.food.calories}kcal P{o.food.protein} F{o.food.fat}</span></span>
            <button className="btn small" disabled={!!o.blocked} onClick={() => onPick(o.food)}>置き換える</button>
          </div>
          <div className="tiny">{o.note}</div>
          {o.caution && <div className="tiny" style={{ color: '#9a5410' }}>注意: {o.caution}</div>}
          {o.blocked && <div className="tiny" style={{ color: 'var(--red)' }}>{o.blocked}</div>}
        </div>
      ))}
    </div>
  )
}

function AddIngredient({ onAdd }: { onAdd: (f: Food, g: number) => void }) {
  const db = useFoodDb()
  const [name, setName] = useState('')
  const [g, setG] = useState('50')
  const m = name ? matchFood(db, name) : null
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <input type="text" list="all-foods" placeholder="材料を追加（食品名）" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 2, minWidth: 140 }} />
      <datalist id="all-foods">{db.all.map((f) => <option key={f.id} value={f.displayName} />)}</datalist>
      <input type="number" value={g} min={1} onChange={(e) => setG(e.target.value)} style={{ width: 80 }} />g
      <button className="btn small" disabled={!m || m.status === 'unmatched' || !(Number(g) > 0)} onClick={() => { if (m && m.status !== 'unmatched') { onAdd(m.food, Number(g)); setName('') } }}>追加</button>
      {m && m.status === 'unmatched' && <div className="tiny err" style={{ width: '100%' }}>食品成分データにありません。{m.candidates.length ? `候補: ${m.candidates.map((c) => c.displayName).join('、')}` : ''}</div>}
    </div>
  )
}
