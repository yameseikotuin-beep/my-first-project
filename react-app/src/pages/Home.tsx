import { activeProfile, mine, settingsFor, useAppData } from '../store/store'
import { href } from '../router'
import { greeting, photoBg } from '../ui/helpers'

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

      <div className="home-hero">
        <a className="photo-menu" href={href('calorie')} style={photoBg('calorie')}>
          <span className="photo-menu-label"><span className="num">1</span>カロリーから考える</span>
          <span className="photo-menu-sub">目標カロリーとPFCに合うレシピを自動で作成</span>
        </a>
        <a className="photo-menu alt" href={href('ingredients')} style={photoBg('ingredients')}>
          <span className="photo-menu-label"><span className="num">2</span>食材から考える</span>
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
