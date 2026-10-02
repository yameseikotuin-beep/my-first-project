import { useId, useMemo, useState, type ReactNode } from 'react'
import type { ConstraintMode, Nutrition, NutritionTargets, PfcRatio, RecipeStatus } from '../types'
import { useAppData } from '../store/store'
import { createFoodDb, type FoodDb } from '../engine/foodDb'
import { round1 } from '../engine/nutrition'

export function useFoodDb(): FoodDb {
  const d = useAppData()
  return useMemo(() => createFoodDb(d.customFoods), [d.customFoods])
}

export const fmt1 = (x: number) => round1(x).toFixed(1)
export const fmt0 = (x: number) => String(Math.round(x))

export function Seg<T extends string | number>({ value, options, onChange, labels }: { value: T | undefined; options: T[]; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button key={String(o)} type="button" role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>
          {labels?.[o] ?? String(o)}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string | null }) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      {children}
      {hint && <div className="tiny muted">{hint}</div>}
      {error && <div className="err">{error}</div>}
    </label>
  )
}

export function StatusBadge({ status }: { status: RecipeStatus }) {
  const label = status === 'ok' ? '条件達成' : status === 'partial' ? '必須条件は達成・目標値に差あり' : '条件未達'
  return <span className={`badge ${status}`}>{label}</span>
}

export function PfcBar({ ratio }: { ratio: PfcRatio }) {
  return (
    <>
      <div className="pfcbar" role="img" aria-label={`PFC比率 P${Math.round(ratio.protein)}% F${Math.round(ratio.fat)}% C${Math.round(ratio.carbohydrates)}%`}>
        <span style={{ width: `${ratio.protein}%`, background: 'var(--p)' }} />
        <span style={{ width: `${ratio.fat}%`, background: 'var(--f)' }} />
        <span style={{ width: `${ratio.carbohydrates}%`, background: 'var(--c)' }} />
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--p)' }} />P {Math.round(ratio.protein)}%</span>
        <span><i style={{ background: 'var(--f)' }} />F {Math.round(ratio.fat)}%</span>
        <span><i style={{ background: 'var(--c)' }} />C {Math.round(ratio.carbohydrates)}%</span>
      </div>
    </>
  )
}

export function PfcNumbers({ n }: { n: Nutrition }) {
  return (
    <div className="pfc-nums">
      <div className="p"><span className="tiny muted">タンパク質</span><b>{fmt1(n.protein)}g</b></div>
      <div className="f"><span className="tiny muted">脂質</span><b>{fmt1(n.fat)}g</b></div>
      <div className="c"><span className="tiny muted">炭水化物</span><b>{fmt1(n.carbohydrates)}g</b></div>
    </div>
  )
}

const MODE_LABEL: Record<ConstraintMode, string> = { min: '以上', max: '以下', target: '目安' }

/** 目標値と計算値の比較表 */
export function TargetCompare({ n, t }: { n: Nutrition; t: NutritionTargets }) {
  const rows: { label: string; actual: number; target: number; mode: ConstraintMode | 'max-kcal'; unit: string }[] = [
    { label: 'カロリー', actual: n.calories, target: t.maxCalories, mode: 'max-kcal', unit: 'kcal' },
  ]
  for (const [key, label] of [['protein', 'タンパク質'], ['fat', '脂質'], ['carbohydrates', '炭水化物']] as const) {
    const c = t[key]
    if (c) rows.push({ label, actual: n[key], target: c.value, mode: c.mode, unit: 'g' })
  }
  return (
    <table className="compare">
      <thead>
        <tr><th>項目</th><th>目標</th><th>計算値</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const pct = r.target > 0 ? (r.actual / r.target) * 100 : 0
          const over = (r.mode === 'max-kcal' || r.mode === 'max') && r.actual > r.target
          const under = r.mode === 'min' && r.actual < r.target
          return (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="small">{r.unit === 'kcal' ? fmt0(r.target) : fmt1(r.target)}{r.unit} {r.mode === 'max-kcal' ? '以内' : MODE_LABEL[r.mode]}</td>
              <td>
                <b style={{ color: over || under ? 'var(--red)' : undefined }}>{r.unit === 'kcal' ? fmt0(r.actual) : fmt1(r.actual)}{r.unit}</b>
                <div className="bar"><span className={over || under ? 'over' : ''} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** 食材名の入力（チップ形式）。データベースの候補をサジェストする */
export function FoodChipsInput({ value, onChange, placeholder, db, quick }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; db: FoodDb; quick?: string[] }) {
  const [text, setText] = useState('')
  const listId = `foods-${useId().replace(/:/g, '')}`
  const add = (s: string) => {
    const parts = s.split(/[,、，\n]/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) return
    onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setText('')
  }
  return (
    <div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input
          type="text" list={listId} value={text} placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add(text)
            }
          }}
        />
        <button type="button" className="btn small" onClick={() => add(text)}>追加</button>
      </div>
      <datalist id={listId}>
        {db.all.filter((f) => f.category !== '調味料').map((f) => <option key={f.id} value={f.displayName} />)}
      </datalist>
      {quick && (
        <div className="chips" style={{ marginTop: 6 }}>
          {quick.filter((q) => !value.includes(q)).map((q) => (
            <button key={q} type="button" className="chip gray" style={{ cursor: 'pointer' }} onClick={() => onChange([...value, q])}>＋{q}</button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="chips" style={{ marginTop: 8 }}>
          {value.map((v) => (
            <span key={v} className="chip">
              {v}
              <button type="button" aria-label={`${v}を削除`} onClick={() => onChange(value.filter((x) => x !== v))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card muted small" style={{ textAlign: 'center' }}>{children}</div>
}

export function formatDate(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
