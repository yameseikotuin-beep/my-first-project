import { activeProfile, mine, settingsFor, useAppData } from '../store/store'
import { href } from '../router'
import { greeting, photoBg, today, useFoodDb } from '../ui/helpers'
import { navigate } from '../router'
import { setSession, toast } from '../store/session'
import { quickDailyPlan, seedFor } from '../engine/quickPlan'
import { daysUntil } from '../engine/shopping'

/** 朝・昼・夕を表す3枚の料理写真を横に並べた背景（下側を暗くして文字を読みやすくする） */
function quickPlanBg() {
  const url = (name: string) => `url("${import.meta.env.BASE_URL}dishes/${name}.jpg")`
  return {
    backgroundImage: ['linear-gradient(180deg, rgba(0,0,0,0) 20%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.8))', url('egg'), url('bowl'), url('grill'), 'linear-gradient(135deg, #f08a24, #f5b14a)'].join(', '),
  }
}

export function Home() {
  const d = useAppData()
  const s = settingsFor(d)
  const p = activeProfile(d)
  const db = useFoodDb()
  const t = today()
  const inventory = mine(d, d.inventory)
  const expiring = inventory.filter((i) => i.expiry && daysUntil(i.expiry, t) <= 2).length

  const features = [
    { to: 'saved?tab=favorites', ico: '★', title: 'お気に入り', sub: 'また作りたいレシピ', tone: 'yellow', count: mine(d, d.favorites).length, unit: '件' },
    { to: 'saved?tab=history', ico: '🕘', title: 'レシピ履歴', sub: '最近見たレシピ', tone: 'blue', count: mine(d, d.history).length, unit: '件' },
    { to: 'plan', ico: '📅', title: '食事プラン', sub: '数日分の献立を計画', tone: 'green', count: mine(d, d.mealPlans).length, unit: '件' },
    { to: 'shopping', ico: '🛒', title: '買い物リスト', sub: '献立の食材をまとめる', tone: 'orange', count: mine(d, d.shoppingLists).length, unit: '件' },
  ]
  const settingsMenu = [
    { to: 'inventory', ico: '🧊', color: '#e3f1fb', title: '食材の在庫', sub: inventory.length > 0 ? `${inventory.length}品を登録中` : '冷蔵庫の食材と期限を管理', alert: expiring > 0 ? `期限間近 ${expiring}` : '' },
    { to: 'profiles', ico: '👤', color: 'var(--green-soft)', title: '利用者・目標設定', sub: p ? `${p.name}さん（${d.profiles.length}人登録）` : '体重・目標から栄養目標を計算', alert: '' },
    { to: 'settings', ico: '⚙️', color: '#efeaf8', title: '栄養設定', sub: `1日 ${s.calorieTarget}kcal・PFCの目標`, alert: '' },
    { to: 'foods', ico: '📚', color: 'var(--orange-soft)', title: '食材データベース', sub: '食品成分表の栄養値を確認', alert: '' },
    { to: 'account', ico: '☁️', color: '#e8eef6', title: 'アカウント・同期', sub: 'ログインして別の端末と同期', alert: '' },
  ]

  function makeTodayPlan() {
    try {
      const date = t
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

      <h2 className="home-section">レシピと献立</h2>
      <div className="feature-grid">
        {features.map((m) => (
          <a key={m.to} className={`feature-tile ${m.tone}`} href={href(m.to)}>
            <span className="feature-top">
              <span className="feature-ico" aria-hidden>{m.ico}</span>
              {m.count > 0 && <span className="feature-count">{m.count}{m.unit}</span>}
            </span>
            <strong>{m.title}</strong>
            <span className="feature-sub">{m.sub}</span>
            <span className="feature-arrow" aria-hidden>›</span>
          </a>
        ))}
      </div>

      <h2 className="home-section">管理・設定</h2>
      <div className="setting-list">
        {settingsMenu.map((m) => (
          <a key={m.to} className="setting-row" href={href(m.to)}>
            <span className="setting-ico" style={{ background: m.color }} aria-hidden>{m.ico}</span>
            <span className="setting-text">
              <strong>{m.title}</strong>
              <span className="setting-sub">{m.sub}</span>
            </span>
            {m.alert && <span className="setting-alert">{m.alert}</span>}
            <span className="setting-chevron" aria-hidden>›</span>
          </a>
        ))}
      </div>

      <p className="tiny muted" style={{ marginTop: 20 }}>
        レシピの写真は料理の種類ごとのイメージです（<a href={href('credits')}>写真の出典</a>）。
        保存したレシピ {mine(d, d.recipes).length}件。データはこの端末のブラウザ内に保存されます。
        栄養値は日本食品標準成分表（八訂）に基づく計算値で、医学的な助言ではありません。
      </p>
    </div>
  )
}
