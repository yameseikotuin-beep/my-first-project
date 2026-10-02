import { useState } from 'react'
import { ALLERGENS, type ActivityLevel, type Profile, type Sex } from '../types'
import { countUserData, deleteProfile, update, useAppData } from '../store/store'
import { toast } from '../store/session'
import { ACTIVITY, calculateTargets } from '../engine/profile'
import { Field, Seg, formatDate } from '../ui/common'
import { newId } from '../util/id'

function blank(): Profile {
  const now = new Date().toISOString()
  return {
    id: newId(), name: '', age: null, sex: 'unspecified', heightCm: null, weightKg: null, targetWeightKg: null, bodyFatPercent: null,
    activityLevel: 'moderate', exerciseFrequency: '', goal: 'lose', periodWeeks: 12, allergens: [], avoidFoods: [], preferences: '',
    specialCondition: false, createdAt: now, updatedAt: now,
  }
}

export function Profiles() {
  const d = useAppData()
  const [editing, setEditing] = useState<Profile | null>(null)

  if (editing) return <ProfileEditor profile={editing} onDone={() => setEditing(null)} />
  return (
    <div>
      <h1>利用者・目標設定</h1>
      <p className="small muted">利用者ごとに身体情報と栄養目標を登録できます。選んだ利用者の目標が、レシピ生成と食事プランに使われます。データは利用者ごとに分けて保存されます。</p>
      <div className="card tight row between">
        <span>{d.activeUserId === null ? <b>✓ ゲスト（共通設定）</b> : 'ゲスト（共通設定）'}</span>
        {d.activeUserId !== null && <button className="btn small" onClick={() => update((dd) => ({ ...dd, activeUserId: null }))}>選択</button>}
      </div>
      {d.profiles.map((p) => {
        const t = calculateTargets(p)
        const s = d.settings.find((x) => x.userId === p.id)
        return (
          <div className="card tight" key={p.id}>
            <div className="row between">
              <b>{d.activeUserId === p.id ? '✓ ' : ''}{p.name}</b>
              <div className="row">
                {d.activeUserId !== p.id && <button className="btn small primary" onClick={() => update((dd) => ({ ...dd, activeUserId: p.id }))}>選択</button>}
                <button className="btn small" onClick={() => setEditing(p)}>編集</button>
                <button className="btn small danger" onClick={() => {
                  const c = countUserData(d, p.id)
                  if (confirm(`「${p.name}」を削除しますか？\n関連データ（レシピ${c.recipes}件・食事プラン${c.mealPlans}件・買い物リスト${c.shoppingLists}件・在庫${c.inventory}件・目標の履歴）も削除されます。`)) deleteProfile(p.id)
                }}>削除</button>
              </div>
            </div>
            <div className="small muted">
              {p.age ?? '-'}歳 / {p.heightCm ?? '-'}cm / {p.weightKg ?? '-'}kg → 目標 {p.targetWeightKg ?? '-'}kg
              {t.bmi && ` / BMI ${t.bmi.toFixed(1)}`}
            </div>
            {s && <div className="small">設定中の目標: {s.calorieTarget}kcal・P{s.proteinTarget}g・F{s.fatTarget}g・C{s.carbohydrateTarget}g</div>}
            <TargetHistory userId={p.id} />
          </div>
        )
      })}
      <button className="btn primary block" onClick={() => setEditing(blank())}>＋ 利用者を追加</button>
    </div>
  )
}

function TargetHistory({ userId }: { userId: string }) {
  const d = useAppData()
  const list = d.targetHistory.filter((t) => t.userId === userId)
  if (!list.length) return null
  return (
    <details className="small" style={{ marginTop: 6 }}>
      <summary>目標の変更履歴（{list.length}件）</summary>
      <ul>
        {list.map((t) => <li key={t.id}>{formatDate(t.createdAt)}: {t.calorieTarget}kcal・P{t.proteinTarget}g・F{t.fatTarget}g・C{t.carbohydrateTarget}g {t.note && `（${t.note}）`}</li>)}
      </ul>
    </details>
  )
}

function ProfileEditor({ profile, onDone }: { profile: Profile; onDone: () => void }) {
  const d = useAppData()
  const [p, setP] = useState<Profile>(profile)
  const [avoidText, setAvoidText] = useState(profile.avoidFoods.join('、'))
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v })
  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const t = calculateTargets(p)
  const exists = d.profiles.some((x) => x.id === p.id)

  function save(applyTargets: boolean) {
    if (!p.name.trim()) return
    const now = new Date().toISOString()
    const saved: Profile = { ...p, name: p.name.trim(), avoidFoods: avoidText.split(/[,、，\s]+/).filter(Boolean), updatedAt: now }
    update((dd) => {
      let next = { ...dd, profiles: exists ? dd.profiles.map((x) => (x.id === saved.id ? saved : x)) : [...dd.profiles, saved] }
      if (!exists) next.activeUserId = saved.id
      if (applyTargets && t.ok && t.calories && t.protein !== null && t.fat !== null && t.carbohydrates !== null) {
        const prev = dd.settings.find((s) => s.userId === saved.id)
        const kcal = t.calories
        next = {
          ...next,
          settings: [
            ...next.settings.filter((s) => s.userId !== saved.id),
            {
              userId: saved.id, calorieTarget: kcal, proteinTarget: t.protein, fatTarget: t.fat, carbohydrateTarget: t.carbohydrates,
              pfcRatio: prev?.pfcRatio ?? { protein: 30, fat: 20, carbohydrates: 50 },
              mealCalories: Math.round(kcal / 3 / 10) * 10,
              updatedAt: now,
            },
          ],
          targetHistory: [
            { id: newId(), userId: saved.id, calorieTarget: kcal, proteinTarget: t.protein, fatTarget: t.fat, carbohydrateTarget: t.carbohydrates, note: `体重${saved.weightKg}kg・目標${saved.targetWeightKg ?? '-'}kg`, createdAt: now },
            ...next.targetHistory,
          ],
        }
      }
      return next
    })
    toast(applyTargets ? '保存して目標を設定しました' : '保存しました')
    onDone()
  }

  return (
    <div>
      <h1>{exists ? '利用者を編集' : '利用者を追加'}</h1>
      <div className="card">
        <Field label="氏名またはニックネーム" error={!p.name.trim() ? '入力してください' : null}><input type="text" value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid2">
          <Field label="年齢"><input type="number" value={p.age ?? ''} onChange={(e) => set('age', num(e.target.value))} /></Field>
          <Field label="性別（計算に使用）">
            <select value={p.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
              <option value="unspecified">指定しない</option>
              <option value="female">女性</option>
              <option value="male">男性</option>
            </select>
          </Field>
          <Field label="身長 cm"><input type="number" value={p.heightCm ?? ''} onChange={(e) => set('heightCm', num(e.target.value))} /></Field>
          <Field label="現在体重 kg"><input type="number" value={p.weightKg ?? ''} onChange={(e) => set('weightKg', num(e.target.value))} /></Field>
          <Field label="目標体重 kg"><input type="number" value={p.targetWeightKg ?? ''} onChange={(e) => set('targetWeightKg', num(e.target.value))} /></Field>
          <Field label="体脂肪率 %（任意）"><input type="number" value={p.bodyFatPercent ?? ''} onChange={(e) => set('bodyFatPercent', num(e.target.value))} /></Field>
          <Field label="目標達成期間（週）"><input type="number" value={p.periodWeeks ?? ''} onChange={(e) => set('periodWeeks', num(e.target.value))} /></Field>
          <Field label="運動頻度"><input type="text" placeholder="例: 週2回の筋トレ" value={p.exerciseFrequency} onChange={(e) => set('exerciseFrequency', e.target.value)} /></Field>
        </div>
        <div className="lbl">活動レベル</div>
        <Seg value={p.activityLevel} options={['low', 'moderate', 'high'] as ActivityLevel[]} labels={{ low: '低い', moderate: 'ふつう', high: '高い' }} onChange={(v) => set('activityLevel', v)} />
        <p className="tiny muted">{ACTIVITY[p.activityLevel].description}</p>
        <div className="lbl">ダイエット目的</div>
        <Seg value={p.goal} options={['lose', 'maintain', 'gain'] as Profile['goal'][]} labels={{ lose: '減量', maintain: '維持', gain: '増量' }} onChange={(v) => set('goal', v)} />
      </div>

      <div className="card">
        <div className="lbl">食物アレルギー・食事制限</div>
        <div className="chips">
          {ALLERGENS.map((a) => {
            const on = p.allergens.includes(a)
            return <button key={a} type="button" className={`chip ${on ? 'bad' : 'gray'}`} style={{ cursor: 'pointer' }} aria-pressed={on} onClick={() => set('allergens', on ? p.allergens.filter((x) => x !== a) : [...p.allergens, a])}>{on ? '✕ ' : ''}{a}</button>
          })}
        </div>
        <Field label="避けたい食材" hint="「、」区切り"><input type="text" value={avoidText} onChange={(e) => setAvoidText(e.target.value)} /></Field>
        <Field label="その他の食事上の希望"><textarea value={p.preferences} onChange={(e) => set('preferences', e.target.value)} /></Field>
        <label className="row small"><input type="checkbox" checked={p.specialCondition} onChange={(e) => set('specialCondition', e.target.checked)} /> 妊娠中・授乳中、または持病や服薬がある</label>
      </div>

      <div className="card">
        <h2>推定される栄養目標</h2>
        {t.blocked && <div className="banner failed small">{t.blocked}</div>}
        {t.calories !== null && (
          <>
            <div className="grid3 small">
              <div>BMI<br /><b>{t.bmi?.toFixed(1)}</b> <span className="tiny">{t.bmiCategory}</span></div>
              <div>基礎代謝量<br /><b>{Math.round(t.bmr!)}kcal</b></div>
              <div>推定消費量<br /><b>{Math.round(t.tdee!)}kcal</b></div>
            </div>
            <div className="kcal-big" style={{ marginTop: 10 }}>{t.calories}<small>kcal/日</small></div>
            <div className="row small" style={{ gap: 12 }}>
              <span>P {t.protein}g</span><span>F {t.fat}g</span><span>C {t.carbohydrates}g</span>
              {t.weeklyChangeKg !== null && <span className="muted">週あたり {t.weeklyChangeKg > 0 ? '+' : ''}{t.weeklyChangeKg.toFixed(2)}kg の見込み</span>}
            </div>
            <details style={{ marginTop: 8 }}>
              <summary className="small">計算根拠</summary>
              <ul className="small">{t.basis.map((b) => <li key={b}>{b}</li>)}</ul>
            </details>
          </>
        )}
        <ul className="small muted">{t.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      </div>

      <div className="row">
        <button className="btn primary" disabled={!p.name.trim() || !t.ok} onClick={() => save(true)}>保存して目標に設定</button>
        <button className="btn" disabled={!p.name.trim()} onClick={() => save(false)}>保存のみ</button>
        <button className="btn ghost" onClick={onDone}>キャンセル</button>
      </div>
    </div>
  )
}
