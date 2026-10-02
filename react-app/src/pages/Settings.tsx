import { useState } from 'react'
import { activeProfile, DEFAULT_SETTINGS, settingsFor, update, useAppData } from '../store/store'
import { toast } from '../store/session'
import { gramsFromRatio } from '../engine/nutrition'
import { Field } from '../ui/common'
import { href } from '../router'

export function Settings() {
  const d = useAppData()
  const s = settingsFor(d)
  const p = activeProfile(d)
  const [f, setF] = useState({
    calorieTarget: String(s.calorieTarget), proteinTarget: String(s.proteinTarget), fatTarget: String(s.fatTarget), carbohydrateTarget: String(s.carbohydrateTarget),
    p: String(s.pfcRatio.protein), fat: String(s.pfcRatio.fat), c: String(s.pfcRatio.carbohydrates), mealCalories: String(s.mealCalories),
  })
  const sum = Number(f.p) + Number(f.fat) + Number(f.c)
  const nums = Object.values(f).map(Number)
  const valid = sum === 100 && nums.every((x) => Number.isFinite(x) && x >= 0) && Number(f.calorieTarget) >= 800 && Number(f.mealCalories) >= 100
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v })

  function save() {
    if (!valid) return
    update((dd) => ({
      ...dd,
      settings: [
        ...dd.settings.filter((x) => x.userId !== dd.activeUserId),
        {
          userId: dd.activeUserId,
          calorieTarget: Number(f.calorieTarget), proteinTarget: Number(f.proteinTarget), fatTarget: Number(f.fatTarget), carbohydrateTarget: Number(f.carbohydrateTarget),
          pfcRatio: { protein: Number(f.p), fat: Number(f.fat), carbohydrates: Number(f.c) },
          mealCalories: Number(f.mealCalories),
          updatedAt: new Date().toISOString(),
        },
      ],
    }))
    toast('栄養設定を保存しました')
  }

  function fromRatio() {
    const g = gramsFromRatio(Number(f.calorieTarget), { protein: Number(f.p), fat: Number(f.fat), carbohydrates: Number(f.c) })
    setF({ ...f, proteinTarget: String(Math.round(g.protein)), fatTarget: String(Math.round(g.fat)), carbohydrateTarget: String(Math.round(g.carbohydrates)) })
  }

  return (
    <div>
      <h1>栄養設定</h1>
      <p className="small muted">{p ? `「${p.name}」さんの設定です。` : 'ゲスト（共通）の設定です。'}身体情報から目標を計算するには<a href={href('profiles')}>利用者・目標設定</a>を使います。</p>

      <div className="card">
        <h2>PFCバランス（エネルギー比率）</h2>
        <p className="tiny muted">レシピ生成でPFCを指定しなかったときに使います。初期値は P30% / F20% / C50% です。</p>
        <div className="grid3">
          <Field label="タンパク質 %"><input type="number" value={f.p} onChange={(e) => set('p', e.target.value)} /></Field>
          <Field label="脂質 %"><input type="number" value={f.fat} onChange={(e) => set('fat', e.target.value)} /></Field>
          <Field label="炭水化物 %"><input type="number" value={f.c} onChange={(e) => set('c', e.target.value)} /></Field>
        </div>
        {sum !== 100 && <div className="err">合計が100%になるようにしてください（現在 {sum}%）。</div>}
        <Field label="1食あたりの既定カロリー" hint="レシピ生成画面の初期値になります。">
          <div className="input-suffix"><input type="number" value={f.mealCalories} onChange={(e) => set('mealCalories', e.target.value)} />kcal</div>
        </Field>
      </div>

      <div className="card">
        <h2>1日の目標</h2>
        <Field label="目標カロリー"><div className="input-suffix"><input type="number" value={f.calorieTarget} onChange={(e) => set('calorieTarget', e.target.value)} />kcal</div></Field>
        <div className="grid3">
          <Field label="タンパク質 g"><input type="number" value={f.proteinTarget} onChange={(e) => set('proteinTarget', e.target.value)} /></Field>
          <Field label="脂質 g"><input type="number" value={f.fatTarget} onChange={(e) => set('fatTarget', e.target.value)} /></Field>
          <Field label="炭水化物 g"><input type="number" value={f.carbohydrateTarget} onChange={(e) => set('carbohydrateTarget', e.target.value)} /></Field>
        </div>
        <button className="btn small" onClick={fromRatio} disabled={sum !== 100}>上の比率からグラム数を計算</button>
        <p className="tiny muted" style={{ marginTop: 6 }}>グラム換算: タンパク質・炭水化物 4kcal/g、脂質 9kcal/g</p>
      </div>

      <div className="row">
        <button className="btn primary" disabled={!valid} onClick={save}>保存</button>
        <button className="btn" onClick={() => setF({
          calorieTarget: String(DEFAULT_SETTINGS.calorieTarget), proteinTarget: String(DEFAULT_SETTINGS.proteinTarget), fatTarget: String(DEFAULT_SETTINGS.fatTarget), carbohydrateTarget: String(DEFAULT_SETTINGS.carbohydrateTarget),
          p: '30', fat: '20', c: '50', mealCalories: String(DEFAULT_SETTINGS.mealCalories),
        })}>初期値に戻す</button>
      </div>
      {!valid && sum === 100 && <p className="err">1日の目標は800kcal以上、1食は100kcal以上で入力してください。</p>}
    </div>
  )
}
