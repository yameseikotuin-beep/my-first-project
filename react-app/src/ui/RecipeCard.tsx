import type { Recipe } from '../types'
import { href } from '../router'
import { fmt0, fmt1, PfcBar, StatusBadge, useFoodDb } from './common'
import { RecipeImage } from './RecipeImage'

export function RecipeCard({ recipe, extra }: { recipe: Recipe; extra?: React.ReactNode }) {
  const db = useFoodDb()
  const n = recipe.nutrition
  const added = recipe.ingredients.filter((i) => i.added)
  return (
    <div className="card tight">
      <a className="recipe-card" href={href(`recipe/${recipe.id}`)}>
        <div className="thumb"><RecipeImage recipe={recipe} size={96} categoryOf={(id) => db.get(id)?.category ?? 'その他'} /></div>
        <div>
          <h3>{recipe.recipeName}</h3>
          <div className="row small" style={{ gap: 10 }}>
            <b style={{ fontSize: '1.15rem' }}>{fmt0(n.calories)}kcal</b>
            <span>P {fmt1(n.protein)}g</span>
            <span>F {fmt1(n.fat)}g</span>
            <span>C {fmt1(n.carbohydrates)}g</span>
          </div>
          <div className="row tiny muted" style={{ gap: 8, marginTop: 2 }}>
            <StatusBadge status={recipe.validation.status} />
            <span>⏱ {recipe.cookingTime}分</span>
            {recipe.genre && <span>{recipe.genre}</span>}
            <span>{recipe.servings}人前</span>
          </div>
        </div>
      </a>
      <PfcBar ratio={recipe.pfcRatio} />
      {added.length > 0 && <div className="tiny muted" style={{ marginTop: 4 }}>追加食材: {added.map((a) => a.name).join('、')}</div>}
      {recipe.unusedFoods.length > 0 && <div className="tiny muted">使わなかった指定食材: {recipe.unusedFoods.map((u) => u.name).join('、')}</div>}
      {extra}
    </div>
  )
}
