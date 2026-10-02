import { useState } from 'react'
import { setSession, toast, useSession } from '../store/session'
import { generateAiRecipes } from '../cloud/ai'
import { generateRecipes } from '../engine/generator'
import { href, navigate } from '../router'
import { Empty } from '../ui/common'
import { useFoodDb } from '../ui/helpers'
import { RecipeCard } from '../ui/RecipeCard'

export function Results() {
  const s = useSession()
  const db = useFoodDb()
  const { request, result } = s
  const [busy, setBusy] = useState(false)
  if (!request || !result) return <Empty>まだレシピを生成していません。<br /><a href={href('')}>ホームに戻る</a></Empty>

  const back = request.mode === 'calorie' ? 'calorie' : 'ingredients'
  async function regenerate() {
    if (!request || busy) return
    setBusy(true)
    try {
      const next = { ...request, variation: (request.variation ?? 0) + 1 }
      const r = s.ai ? await generateAiRecipes(db, next, s.ai.note) : generateRecipes(db, next)
      const working = Object.fromEntries(r.recipes.concat(r.rejected).map((x) => [x.id, x]))
      setSession((ss) => ({ ...ss, request: next, result: r, working: { ...ss.working, ...working } }))
    } catch (e) {
      toast(`再生成に失敗しました（${e instanceof Error ? e.message : String(e)}）。もう一度お試しください。`)
    } finally {
      setBusy(false)
    }
  }

  const t = request.targets
  const cond = [
    `${t.maxCalories}kcal以内`,
    t.protein && `P ${t.protein.value}g${t.protein.mode === 'min' ? '以上' : t.protein.mode === 'max' ? '以下' : '目安'}`,
    t.fat && `F ${t.fat.value}g${t.fat.mode === 'min' ? '以上' : t.fat.mode === 'max' ? '以下' : '目安'}`,
    t.carbohydrates && `C ${t.carbohydrates.value}g${t.carbohydrates.mode === 'min' ? '以上' : t.carbohydrates.mode === 'max' ? '以下' : '目安'}`,
    request.genre, request.method, request.maxTime && `${request.maxTime}分以内`, `${request.servings}人前`,
  ].filter(Boolean).join(' / ')

  return (
    <div>
      <div className="row between">
        <h1 style={{ margin: 0 }}>レシピ候補</h1>
        <a className="btn small" href={href(back)}>条件を変更</a>
      </div>
      <p className="small muted">{cond}{s.ai && <span className="badge info" style={{ marginLeft: 6 }}>AI考案</span>}</p>

      {result.unmatched.length > 0 && (
        <div className="banner warn small">
          食品成分データに見つからないため、使っていない食材: {result.unmatched.map((u) => u.input).join('、')}
          {result.unmatched.some((u) => u.candidates.length) && (
            <div className="tiny">候補: {result.unmatched.map((u) => u.candidates.slice(0, 3).map((c) => c.displayName).join('・')).filter(Boolean).join(' / ')}（条件変更画面で選び直せます）</div>
          )}
        </div>
      )}

      {(result.status === 'infeasible' || result.status === 'failed') && (
        <div className="banner failed">
          <b>{result.status === 'infeasible' ? 'この条件ではレシピを作成できません' : '指定された条件をすべて満たすレシピを作成できませんでした'}</b>
          <ul>{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          {result.suggestions.length > 0 && (
            <>
              <div style={{ marginTop: 8, fontWeight: 600 }}>条件に合うレシピを提案できる可能性がある調整案</div>
              <ul>{result.suggestions.map((r) => <li key={r}>{r}</li>)}</ul>
            </>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary small" onClick={() => navigate(back)}>条件を変更する</button>
          </div>
        </div>
      )}

      {result.status === 'partial' && <div className="banner partial small">必須条件（上限・下限）はすべて満たしていますが、「目安」の値との差が大きいレシピがあります。</div>}

      {result.recipes.map((r) => <RecipeCard key={r.id} recipe={r} />)}

      {result.recipes.length > 0 && (
        <button className="btn block" onClick={() => void regenerate()} disabled={busy} aria-busy={busy}>{busy ? (s.ai ? 'AIが考案中…' : '生成中…') : s.ai ? 'AIに別のレシピを考えてもらう' : '別のレシピを生成する'}</button>
      )}

      {result.rejected.length > 0 && (
        <details className="card" style={{ marginTop: 14 }}>
          <summary>条件を満たせなかった候補（参考）</summary>
          <p className="tiny muted">以下は条件未達のレシピです。条件達成のレシピとしては扱いません。</p>
          {result.rejected.map((r) => <RecipeCard key={r.id} recipe={r} />)}
        </details>
      )}
    </div>
  )
}
