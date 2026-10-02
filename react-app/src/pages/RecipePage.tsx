import { useAppData } from '../store/store'
import { useSession } from '../store/session'
import { href, navigate } from '../router'
import { Empty } from '../ui/common'
import { RecipeView } from '../ui/RecipeView'

export function RecipePage({ id }: { id: string }) {
  const d = useAppData()
  const s = useSession()
  const recipe = s.working[id] ?? d.recipes.find((r) => r.id === id) ?? d.history.find((r) => r.id === id)
  if (!recipe) return <Empty>レシピが見つかりません。<br /><a href={href('')}>ホームに戻る</a></Empty>
  const fromResults = s.result?.recipes.some((r) => r.id === id)
  return (
    <div>
      <a className="small hide-print" href={fromResults ? href('results') : href('saved')} onClick={(e) => { if (window.history.length > 1) { e.preventDefault(); window.history.back() } }}>← 戻る</a>
      <RecipeView key={recipe.id} initial={recipe} onRegenerate={fromResults ? () => navigate('results') : undefined} />
    </div>
  )
}
