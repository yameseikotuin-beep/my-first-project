import { activeProfile, mine, settingsFor, useAppData } from '../store/store'
import { href } from '../router'
import { greeting, photoBg, today, useFoodDb } from '../ui/helpers'
import { navigate } from '../router'
import { setSession, toast } from '../store/session'
import { quickDailyPlan, seedFor } from '../engine/quickPlan'

/** 朝・昼・夕を表す3枚の料理写真を横に並べた背景（下側を暗くして文字を読みやすくする） */
function quickPlanBg() {
  const url = (name: string) => `url("${import.meta.env.BASE_URL}dishes/${name}.jpg")`
  return {
    backgroundImage: ['linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.8))', url('egg'), url('bowl'), url('grill'), 'linear-gradient(135deg, #f08a24, #f5b14a)'].join(', '),
  }
}

const MENU = [
  { to: 'saved?tab=favorites', ico: '★', title: 'お気に入りレシピ' },
  { to: 'saved?tab=history', ico: '🕘', title: 'レシピ履歴' },
  { to: 'plan', ico: '📅', title: '1日の食事プラン' },
  { to: 'shopping', ico: '🛒', title: '買い物リスト' },
  { to: 'inventory', ico: '🧊', title: '食材の在庫' },
  { to: 'profiles', ico: '👤', title: '利用者・目標設定' },
  { to: 'settings', ico: '⚙️', title: '栄養設定' },
  { to: 'foods', ico: '📚', title: '食材データベース' },
  { to: 'account', ico: '☁️', title: 'アカウント・同期' },
]

export function Home() {
  const d = useAppData()
  const s = settingsFor(d)
  const p = activeProfile(d)
  const db = useFoodDb()

  function makeTodayPlan() {
    try {
      const date = today()
      const seed = seedFor(date)
      const plan = quickDailyPlan(db, s, p, date, seed, d.activeUserId)
      setSession((ss) => ({ ...ss, planDraft: plan, planSeed: seed }))
      navigate('plan?quick=1')
    } catch {
      toast('献立を作れませんでした。もう一度お試しください。')
    }
  }

  return (
    <div>
      <section className="home-banner" style={photoBg('hero')}>
        <div className="home-banner-inner">
          <p className="home-greeting">{greeting()}</p>
          <h1>今日も、おいしく<br />高タンパク・低脂質。</h1>
          <a className="home-goal" href={href(p ? 'profiles' : 'settings')}>
            <span>{p ? `${p.name}さんの目標` : '1日の目標'}</span>
            <b>{s.calorieTarget}kcal</b>
            <span>P{s.proteinTarget} F{s.fatTarget} C{s.carbohydrateTarget}</span>
          </a>
        </div>
      </section>

      <button type="button" className="quick-plan" onClick={makeTodayPlan} style={quickPlanBg()}>
        <span className="quick-plan-meals" aria-hidden><span data-l="朝" /><span data-l="昼" /><span data-l="夕" /></span>
        <span className="quick-plan-text">
          <b>🍱 今日の献立をつくる</b>
          <span className="quick-plan-sub">朝・昼・夕の3食をボタンひとつで（1日 {s.calorieTarget}kcal）</span>
        </span>
        <span className="quick-plan-arrow" aria-hidden>›</span>
      </button>

      <div className="home-hero">
        <a className="photo-menu" href={href('calorie')} style={photoBg('calorie')}>
          <span className="photo-menu-label"><span className="num">1</span><span>カロリーから<wbr />考える</span></span>
          <span className="photo-menu-sub">目標カロリーとPFCに合うレシピを自動で作成</span>
        </a>
        <a className="photo-menu alt" href={href('ingredients')} style={photoBg('ingredients')}>
          <span className="photo-menu-label"><span className="num">2</span><span>食材から<wbr />考える</span></span>
          <span className="photo-menu-sub">冷蔵庫の食材で高タンパク・低脂質レシピ</span>
        </a>
      </div>

      <h2 style={{ marginTop: 22 }}>メニュー</h2>
      <div className="menu-grid">
        {MENU.map((m) => (
          <a key={m.to} className="menu-tile" href={href(m.to)}>
            <span className="ico" aria-hidden>{m.ico}</span>
            <strong>{m.title}</strong>
          </a>
        ))}
      </div>

      <p className="tiny muted" style={{ marginTop: 20 }}>
        写真: Unsplash（Unsplash License）。レシピの写真は料理の種類ごとのイメージです。
        保存したレシピ {mine(d, d.recipes).length}件。データはこの端末のブラウザ内に保存されます。
        栄養値は日本食品標準成分表（八訂）に基づく計算値で、医学的な助言ではありません。
      </p>
    </div>
  )
}
