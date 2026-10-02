import { activeProfile, mine, settingsFor, useAppData } from '../store/store'
import { href } from '../router'

const MENU = [
  { to: 'saved?tab=favorites', ico: '★', title: 'お気に入りレシピ' },
  { to: 'saved?tab=history', ico: '🕘', title: 'レシピ履歴' },
  { to: 'plan', ico: '📅', title: '1日の食事プラン' },
  { to: 'shopping', ico: '🛒', title: '買い物リスト' },
  { to: 'inventory', ico: '🧊', title: '食材の在庫' },
  { to: 'profiles', ico: '👤', title: '利用者・目標設定' },
  { to: 'settings', ico: '⚙️', title: '栄養設定' },
  { to: 'foods', ico: '📚', title: '食材データベース' },
]

export function Home() {
  const d = useAppData()
  const s = settingsFor(d)
  const p = activeProfile(d)
  return (
    <div>
      <div className="card tight small">
        <div className="row between">
          <span>{p ? <><b>{p.name}</b> さんの目標</> : <b>ゲスト（共通設定）</b>}</span>
          <a href={href(p ? 'profiles' : 'settings')} className="small">変更</a>
        </div>
        <div className="row" style={{ gap: 12, marginTop: 4 }}>
          <span>1日 <b>{s.calorieTarget}kcal</b></span>
          <span>P {s.proteinTarget}g</span>
          <span>F {s.fatTarget}g</span>
          <span>C {s.carbohydrateTarget}g</span>
          <span className="muted">1食 {s.mealCalories}kcal</span>
        </div>
      </div>

      <div className="home-hero">
        <a className="big-menu" href={href('calorie')}>
          <h2><span className="num">1</span>カロリーからレシピを考える</h2>
          <p className="small muted" style={{ margin: 0 }}>指定したカロリーとPFC目標から、栄養計算済みのレシピを自動で考えます。</p>
        </a>
        <a className="big-menu alt" href={href('ingredients')}>
          <h2><span className="num">2</span>食材からレシピを考える</h2>
          <p className="small muted" style={{ margin: 0 }}>冷蔵庫にある食材を入力すると、それを使った高タンパク・低脂質のレシピを考えます。</p>
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
        保存したレシピ {mine(d, d.recipes).length}件。データはこの端末のブラウザ内に保存されます。
        栄養値は日本食品標準成分表（八訂）に基づく計算値で、医学的な助言ではありません。
      </p>
    </div>
  )
}
