import { useRoute, href } from './router'
import { getSaveError, update, useAppData } from './store/store'
import { useSession } from './store/session'
import { Home } from './pages/Home'
import { GenerateForm } from './pages/GenerateForm'
import { Results } from './pages/Results'
import { RecipePage } from './pages/RecipePage'
import { Saved } from './pages/Saved'
import { Settings } from './pages/Settings'
import { Foods } from './pages/Foods'
import { Profiles } from './pages/Profiles'
import { MealPlanPage } from './pages/MealPlan'
import { Shopping } from './pages/Shopping'
import { Inventory } from './pages/Inventory'
import { Account, SyncBadge } from './pages/Account'
import { Credits } from './pages/Credits'
import { cloudConfigured } from './cloud/supabase'

const NAV = [
  { to: '', ico: '🏠', label: 'ホーム', match: [''] },
  { to: 'calorie', ico: '🔥', label: 'カロリー', match: ['calorie'] },
  { to: 'ingredients', ico: '🥬', label: '食材', match: ['ingredients'] },
  { to: 'saved', ico: '★', label: 'レシピ', match: ['saved', 'recipe', 'results'] },
  { to: 'shopping', ico: '🛒', label: '買い物', match: ['shopping', 'inventory'] },
]

export default function App() {
  const route = useRoute()
  const d = useAppData()
  const s = useSession()
  const [page, id] = route.path
  const key = d.activeUserId ?? 'guest'
  const saveError = getSaveError()

  let content
  switch (page ?? '') {
    case '': content = <Home />; break
    case 'calorie': content = <GenerateForm key={`c-${key}`} mode="calorie" />; break
    case 'ingredients': content = <GenerateForm key={`i-${key}`} mode="ingredients" />; break
    case 'results': content = <Results />; break
    case 'recipe': content = <RecipePage id={id ?? ''} />; break
    case 'saved': content = <Saved />; break
    case 'settings': content = <Settings key={key} />; break
    case 'foods': content = <Foods />; break
    case 'profiles': content = <Profiles key={key} />; break
    case 'plan': content = <MealPlanPage key={`${key}-${id ?? ''}`} />; break
    case 'shopping': content = <Shopping key={`${key}-${id ?? ''}`} />; break
    case 'inventory': content = <Inventory />; break
    case 'account': content = <Account />; break
    case 'credits': content = <Credits />; break
    default: content = <p>ページが見つかりません。<a href={href('')}>ホームへ</a></p>
  }

  return (
    <>
      <header className="app-header">
        <a className="brand" href={href('')}><img className="brand-icon" src={`${import.meta.env.BASE_URL}favicon-64.png`} alt="" width={30} height={30} />ダイエットレシピメーカー</a>
        <span className="spacer" />
        {cloudConfigured && <a href={href('account')} className="header-account" aria-label="アカウント・同期"><SyncBadge />{' '}👤</a>}
        <select aria-label="利用者" value={d.activeUserId ?? ''} onChange={(e) => update((dd) => ({ ...dd, activeUserId: e.target.value || null }))}>
          <option value="">ゲスト</option>
          {d.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </header>
      <main>
        {saveError && <div className="banner error small">{saveError}</div>}
        {content}
      </main>
      <nav className="bottom-nav" aria-label="メインメニュー">
        {NAV.map((n) => (
          <a key={n.label} href={href(n.to)} className={n.match.includes(page ?? '') ? 'active' : ''}>
            <span className="ico" aria-hidden>{n.ico}</span>{n.label}
          </a>
        ))}
      </nav>
      {s.toast && <div className="toast" role="status">{s.toast}</div>}
    </>
  )
}
