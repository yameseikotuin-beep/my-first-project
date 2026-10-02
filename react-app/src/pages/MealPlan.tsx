import { useState } from 'react'
import { ALLERGENS, type Allergen, type Genre, type MealPlan as Plan } from '../types'
import { activeProfile, mine, settingsFor, update, useAppData } from '../store/store'
import { putWorking, setSession, toast, useSession } from '../store/session'
import { quickDailyPlan } from '../engine/quickPlan'
import { MEAL_PRESETS, achievement, generateMealPlan, type MealSlotDef } from '../engine/mealplan'
import { navigate, useRoute } from '../router'
import { Field, FoodChipsInput, Seg } from '../ui/common'
import { fmt0, fmt1, formatDate, today, useFoodDb } from '../ui/helpers'
import { RecipeCard } from '../ui/RecipeCard'

export function MealPlanPage() {
  const route = useRoute()
  const d = useAppData()
  const session = useSession()
  const id = route.path[1]
  if (id) {
    const plan = d.mealPlans.find((p) => p.id === id)
    return plan ? <PlanView plan={plan} saved /> : <p>食事プランが見つかりません。</p>
  }
  if (route.query.get('quick') && session.planDraft) return <QuickPlan plan={session.planDraft} />
  return <PlanBuilder />
}

/** ホームの「今日の献立をつくる」で作った献立。保存・作り直し・条件を細かく決める画面への移動ができる */
function QuickPlan({ plan }: { plan: Plan }) {
  const d = useAppData()
  const db = useFoodDb()
  const session = useSession()
  const saved = d.mealPlans.some((x) => x.id === plan.id)

  function remake() {
    try {
      const seed = (session.planSeed ?? 0) + 1
      const next = quickDailyPlan(db, settingsFor(d), activeProfile(d), plan.days[0].date, seed, d.activeUserId)
      setSession((ss) => ({ ...ss, planDraft: next, planSeed: seed }))
      window.scrollTo(0, 0)
    } catch {
      toast('作り直せませんでした。もう一度お試しください。')
    }
  }

  return (
    <div>
      <h1>🍱 {plan.name}</h1>
      <p className="small muted">あなたの1日の目標（{plan.daily.calories}kcal・P{plan.daily.protein}g・F{plan.daily.fat}g・C{plan.daily.carbohydrates}g）に合わせて3食を作りました。</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" disabled={saved} onClick={() => { update((dd) => ({ ...dd, mealPlans: [plan, ...dd.mealPlans] })); toast('献立を保存しました') }}>{saved ? '保存済み' : '保存'}</button>
        <button className="btn" onClick={remake}>別の献立にする</button>
        <a className="btn ghost" href="#/plan">条件を細かく決める</a>
      </div>
      <PlanView plan={plan} saved={false} />
      {saved && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn accent" onClick={() => navigate(`shopping?plan=${plan.id}`)}>この献立で買い物リストを作る</button>
        </div>
      )}
    </div>
  )
}

function PlanBuilder() {
  const d = useAppData()
  const db = useFoodDb()
  const s = settingsFor(d)
  const profile = activeProfile(d)
  const [daily, setDaily] = useState({ calories: String(s.calorieTarget), protein: String(s.proteinTarget), fat: String(s.fatTarget), carbohydrates: String(s.carbohydrateTarget) })
  const [count, setCount] = useState<3 | 4 | 5>(3)
  const [meals, setMeals] = useState<(MealSlotDef & { eatingOut: boolean })[]>(MEAL_PRESETS[3].map((m) => ({ ...m, eatingOut: false })))
  const [days, setDays] = useState(1)
  const [genre, setGenre] = useState<Genre | ''>('')
  const [maxTime, setMaxTime] = useState(0)
  const [useFoods, setUseFoods] = useState<string[]>([])
  const [avoidFoods, setAvoidFoods] = useState<string[]>(profile?.avoidFoods ?? [])
  const [allergens, setAllergens] = useState<Allergen[]>(profile?.allergens ?? [])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shareSum = meals.reduce((a, m) => a + m.share, 0)
  const nums = Object.values(daily).map(Number)
  const valid = shareSum === 100 && nums.every((x) => Number.isFinite(x) && x > 0) && Number(daily.calories) >= 800

  function changeCount(c: 3 | 4 | 5) {
    setCount(c)
    setMeals(MEAL_PRESETS[c].map((m) => ({ ...m, eatingOut: false })))
  }

  function generate() {
    setError(null)
    try {
      const p = generateMealPlan(db, {
        name: `${today()}からの${days}日分`,
        daily: { calories: Number(daily.calories), protein: Number(daily.protein), fat: Number(daily.fat), carbohydrates: Number(daily.carbohydrates) },
        meals, days, startDate: today(),
        base: { genre: genre || undefined, maxTime: maxTime || undefined, useFoods, avoidFoods, avoidAllergens: allergens },
        userId: d.activeUserId,
      })
      setPlan(p)
    } catch (e) {
      setError(`食事プランの作成中にエラーが発生しました（${e instanceof Error ? e.message : String(e)}）。`)
    }
  }

  const saved = mine(d, d.mealPlans)
  return (
    <div>
      <h1>1日の食事プラン</h1>
      {!plan && (
        <>
          <div className="card">
            <h2>1日の目標</h2>
            {profile && <p className="tiny muted">「{profile.name}」さんの目標を初期値にしています。</p>}
            <div className="grid2">
              <Field label="カロリー kcal"><input type="number" value={daily.calories} onChange={(e) => setDaily({ ...daily, calories: e.target.value })} /></Field>
              <Field label="タンパク質 g"><input type="number" value={daily.protein} onChange={(e) => setDaily({ ...daily, protein: e.target.value })} /></Field>
              <Field label="脂質 g"><input type="number" value={daily.fat} onChange={(e) => setDaily({ ...daily, fat: e.target.value })} /></Field>
              <Field label="炭水化物 g"><input type="number" value={daily.carbohydrates} onChange={(e) => setDaily({ ...daily, carbohydrates: e.target.value })} /></Field>
            </div>
          </div>
          <div className="card">
            <div className="lbl">食事回数</div>
            <Seg value={count} options={[3, 4, 5] as (3 | 4 | 5)[]} labels={{ 3: '3食', 4: '4食', 5: '5食' }} onChange={changeCount} />
            <div className="lbl" style={{ marginTop: 12 }}>食事ごとのカロリー配分と自炊・外食</div>
            {meals.map((m, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
                <span style={{ width: 96 }}>{m.label}</span>
                <span className="input-suffix" style={{ width: 100 }}><input type="number" value={m.share} onChange={(e) => setMeals(meals.map((x, j) => (j === i ? { ...x, share: Number(e.target.value) || 0 } : x)))} />%</span>
                <select style={{ width: 96 }} value={m.eatingOut ? 'out' : 'home'} onChange={(e) => setMeals(meals.map((x, j) => (j === i ? { ...x, eatingOut: e.target.value === 'out' } : x)))}>
                  <option value="home">自炊</option>
                  <option value="out">外食</option>
                </select>
              </div>
            ))}
            {shareSum !== 100 && <div className="err">配分の合計を100%にしてください（現在 {shareSum}%）。</div>}
            <div className="lbl" style={{ marginTop: 12 }}>日数</div>
            <Seg value={days} options={[1, 3, 7]} labels={{ 1: '1日分', 3: '3日分', 7: '7日分' }} onChange={setDays} />
          </div>
          <div className="card">
            <div className="lbl">料理ジャンル</div>
            <Seg value={genre} options={['', '和食', '洋食', '中華', '韓国料理', 'エスニック'] as (Genre | '')[]} labels={{ '': '指定なし' }} onChange={setGenre} />
            <div className="lbl" style={{ marginTop: 12 }}>調理時間</div>
            <Seg value={maxTime} options={[0, 10, 15, 20, 30]} labels={{ 0: '指定なし', 10: '10分', 15: '15分', 20: '20分', 30: '30分' }} onChange={setMaxTime} />
            <Field label="使用したい食材（任意）"><FoodChipsInput value={useFoods} onChange={setUseFoods} db={db} /></Field>
            <Field label="避けたい食材（任意）"><FoodChipsInput value={avoidFoods} onChange={setAvoidFoods} db={db} /></Field>
            <div className="lbl">アレルギー・食事制限</div>
            <div className="chips">
              {ALLERGENS.map((a) => {
                const on = allergens.includes(a)
                return <button key={a} type="button" className={`chip ${on ? 'bad' : 'gray'}`} style={{ cursor: 'pointer' }} onClick={() => setAllergens(on ? allergens.filter((x) => x !== a) : [...allergens, a])}>{on ? '✕ ' : ''}{a}</button>
              })}
            </div>
          </div>
          {error && <div className="banner error">{error} <button className="btn small" onClick={generate}>再試行</button></div>}
          <button className="btn primary block" style={{ minHeight: 52 }} disabled={!valid} onClick={generate}>食事プランを作る</button>
          {!valid && shareSum === 100 && <p className="err">1日の目標は800kcal以上・各値を正の数で入力してください。</p>}

          {saved.length > 0 && (
            <>
              <h2 style={{ marginTop: 20 }}>保存した食事プラン</h2>
              {saved.map((p) => (
                <div key={p.id} className="card tight row between">
                  <a href={`#/plan/${p.id}`}>{p.name}</a>
                  <span className="tiny muted">{formatDate(p.createdAt)}</span>
                  <button className="btn danger small" onClick={() => { if (confirm('この食事プランを削除しますか？')) update((dd) => ({ ...dd, mealPlans: dd.mealPlans.filter((x) => x.id !== p.id) })) }}>削除</button>
                </div>
              ))}
            </>
          )}
        </>
      )}
      {plan && (
        <>
          <PlanView plan={plan} saved={false} />
          <div className="row">
            <button className="btn primary" onClick={() => { update((dd) => ({ ...dd, mealPlans: [plan, ...dd.mealPlans] })); toast('食事プランを保存しました'); navigate(`plan/${plan.id}`) }}>保存</button>
            <button className="btn" onClick={generate}>作り直す</button>
            <button className="btn ghost" onClick={() => setPlan(null)}>条件を変更</button>
          </div>
        </>
      )}
    </div>
  )
}

function PlanView({ plan, saved }: { plan: Plan; saved: boolean }) {
  return (
    <div>
      {saved && <h2>{plan.name}</h2>}
      {plan.days.map((day) => {
        const ach = achievement(plan.daily, day.totals)
        const hasOut = day.meals.some((m) => m.eatingOut)
        return (
          <div key={day.date}>
            <h2 style={{ marginTop: 16 }}>{formatDay(day.date)}</h2>
            <div className="plan-summary" aria-label="1日の合計と達成率">
              {ach.map((a) => {
                const off = Math.abs(a.percent - 100) > 10
                const label = a.key === 'calories' ? '合計' : a.key === 'protein' ? 'P' : a.key === 'fat' ? 'F' : 'C'
                return (
                  <span key={a.key} className={`plan-chip ${off ? 'off' : ''}`}>
                    {label} <b>{a.key === 'calories' ? `${fmt0(a.actual)}kcal` : `${fmt0(a.actual)}g`}</b> <span>{Math.round(a.percent)}%</span>
                  </span>
                )
              })}
            </div>
            {hasOut && <p className="tiny muted">外食分を除く、自炊分の合計です。</p>}
            {day.meals.map((m, i) => (
              <div key={i}>
                <div className="row between small" style={{ margin: '10px 2px 4px' }}>
                  <b>{m.label}</b>
                  <span className="muted">目安 {fmt0(m.budget.calories)}kcal</span>
                </div>
                {m.eatingOut && <div className="card tight small">🍽 外食: 目安 {fmt0(m.budget.calories)}kcal・P {fmt0(m.budget.protein)}g・F {fmt0(m.budget.fat)}g・C {fmt0(m.budget.carbohydrates)}g 程度を選ぶと目標に近づきます（栄養計算の対象外）。</div>}
                {m.recipe && <RecipeCard recipe={m.recipe} extra={<button className="btn ghost small" onClick={() => { putWorking(m.recipe!); navigate(`recipe/${m.recipe!.id}`) }}>詳細・調整</button>} />}
                {!m.eatingOut && !m.recipe && <div className="banner failed small">この食事のレシピを作成できませんでした。{m.error}</div>}
              </div>
            ))}
            <details className="card tight">
              <summary>1日の目標との比較（詳しく）</summary>
              <table className="compare compact" style={{ marginTop: 8 }}>
                <thead><tr><th>項目</th><th>目標</th><th>計算値</th><th>達成率</th><th>過不足</th></tr></thead>
                <tbody>
                  {ach.map((a) => {
                    const unit = a.key === 'calories' ? 'kcal' : 'g'
                    const f = a.key === 'calories' ? fmt0 : fmt1
                    return (
                      <tr key={a.key}>
                        <td>{a.label}</td>
                        <td>{f(a.target)}{unit}</td>
                        <td><b>{f(a.actual)}{unit}</b></td>
                        <td style={{ color: Math.abs(a.percent - 100) > 10 ? 'var(--red)' : undefined }}>{Math.round(a.percent)}%</td>
                        <td>{a.diff >= 0 ? '+' : ''}{f(a.diff)}{unit}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="tiny muted" style={{ marginTop: 6 }}>達成率が90〜110%の範囲外の項目は赤で表示しています。</p>
            </details>
          </div>
        )
      })}
      {saved && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn accent" onClick={() => navigate(`shopping?plan=${plan.id}`)}>この食事プランで買い物リストを作る</button>
        </div>
      )}
    </div>
  )
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}
