import { useMemo, useState } from 'react'
import { ALLERGENS, type Allergen, type ConstraintMode, type CookMethod, type Difficulty, type ExtraPolicy, type GenerationRequest, type Genre, type MealType, type NutrientConstraint } from '../types'
import { activeProfile, settingsFor, useAppData } from '../store/store'
import { setSession, useSession } from '../store/session'
import { matchFood } from '../engine/foodDb'
import { generateRecipes } from '../engine/generator'
import { gramsFromRatio, round1 } from '../engine/nutrition'
import { navigate } from '../router'
import { Field, FoodChipsInput, Seg, useFoodDb } from '../ui/common'

type NutKey = 'protein' | 'fat' | 'carbohydrates'
type ModeOrNone = ConstraintMode | 'none'

export interface FormState {
  kcal: string
  mealType: MealType
  pfc: Record<NutKey, { value: string; mode: ModeOrNone }>
  time: number
  genre: Genre | ''
  difficulty: Difficulty | ''
  servings: number
  method: CookMethod | ''
  useFoods: string[]
  useUpFoods: string[]
  avoidFoods: string[]
  allergens: Allergen[]
  extraPolicy: ExtraPolicy
  seasonings: string[]
}

const GENRES: (Genre | '')[] = ['', '和食', '洋食', '中華', '韓国料理', 'エスニック']
const METHODS: (CookMethod | '')[] = ['', '焼く', '蒸す', '煮る', '炒める', '電子レンジ']
const TIMES = [10, 15, 20, 30, 0]
const NUT_LABEL: Record<NutKey, string> = { protein: 'タンパク質', fat: '脂質', carbohydrates: '炭水化物' }
const QUICK_FOODS = ['鶏むね肉', '鶏ささみ', '豚ヒレ肉', '鮭', 'たら', 'えび', 'ツナ缶', '卵', '木綿豆腐', 'キャベツ', '玉ねぎ', 'ブロッコリー', 'にんじん', 'もやし', 'しめじ', 'トマト', 'ほうれん草', '白菜', 'ピーマン', 'ごはん']
const SEASONING_IDS = ['17007', '17012', '03003', '16025', '16001', '17045', '17110', '17015', '17028', '17093', '17027', '17031', '17036', '17004', '17107', '02034', '01015', '14006', '14001', '14002', '06223', '06103', '07156', '05018']

export function initialForm(mode: 'calorie' | 'ingredients', mealCalories: number, avoidFoods: string[], allergens: Allergen[]): FormState {
  return {
    kcal: String(mealCalories),
    mealType: '夕食',
    pfc: {
      protein: { value: '', mode: 'min' },
      fat: { value: '', mode: 'max' },
      carbohydrates: { value: '', mode: mode === 'calorie' ? 'target' : 'max' },
    },
    time: 0,
    genre: '',
    difficulty: '',
    servings: 1,
    method: '',
    useFoods: [],
    useUpFoods: [],
    avoidFoods,
    allergens,
    extraPolicy: 'allow',
    seasonings: [],
  }
}

export function GenerateForm({ mode }: { mode: 'calorie' | 'ingredients' }) {
  const d = useAppData()
  const db = useFoodDb()
  const session = useSession()
  const settings = settingsFor(d)
  const profile = activeProfile(d)
  const draftKey = `form-${mode}`
  const [form, setFormState] = useState<FormState>(
    () => (session.drafts[draftKey] as FormState | undefined) ?? initialForm(mode, settings.mealCalories, profile?.avoidFoods ?? [], profile?.allergens ?? []),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [runError, setRunError] = useState<string | null>(null)
  const setForm = (f: FormState) => {
    setFormState(f)
    setSession((s) => ({ ...s, drafts: { ...s.drafts, [draftKey]: f } }))
  }
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v })

  const kcalNum = Number(form.kcal)
  const pfcEmpty = (['protein', 'fat', 'carbohydrates'] as NutKey[]).every((k) => form.pfc[k].mode === 'none' || form.pfc[k].value.trim() === '')
  const defaultGrams = kcalNum > 0 ? gramsFromRatio(kcalNum, settings.pfcRatio) : null

  const matches = useMemo(
    () => [...form.useFoods, ...form.useUpFoods].map((name) => ({ name, m: matchFood(db, name) })),
    [form.useFoods, form.useUpFoods, db],
  )

  function fillFromSettings() {
    if (!defaultGrams) return
    setForm({
      ...form,
      pfc: {
        protein: { value: String(Math.round(defaultGrams.protein)), mode: 'min' },
        fat: { value: String(Math.round(defaultGrams.fat)), mode: 'max' },
        carbohydrates: { value: String(Math.round(defaultGrams.carbohydrates)), mode: 'target' },
      },
    })
  }

  function buildRequest(): GenerationRequest | null {
    const e: Record<string, string> = {}
    if (!(kcalNum >= 50 && kcalNum <= 3000)) e.kcal = '50〜3000kcalの範囲で入力してください。'
    const cons: Partial<Record<NutKey, NutrientConstraint>> = {}
    for (const k of ['protein', 'fat', 'carbohydrates'] as NutKey[]) {
      const { value, mode: m } = form.pfc[k]
      if (m === 'none' || value.trim() === '') continue
      const v = Number(value)
      if (!Number.isFinite(v) || v < 0 || v > 500) e[k] = '0〜500gの範囲で入力してください。'
      else cons[k] = { value: v, mode: m }
    }
    if (mode === 'ingredients' && form.useFoods.length + form.useUpFoods.length === 0) e.useFoods = '食材を1つ以上入力してください。'
    setErrors(e)
    if (Object.keys(e).length) return null
    if (pfcEmpty && defaultGrams) {
      // 未指定の場合は栄養設定の比率（エネルギー比）を目安として使う
      cons.protein = { value: round1(defaultGrams.protein), mode: 'target' }
      cons.fat = { value: round1(defaultGrams.fat), mode: 'target' }
      cons.carbohydrates = { value: round1(defaultGrams.carbohydrates), mode: 'target' }
    }
    return {
      mode,
      targets: { maxCalories: kcalNum, ...cons },
      mealType: form.mealType,
      genre: form.genre || undefined,
      method: form.method || undefined,
      maxTime: form.time || undefined,
      difficulty: form.difficulty || undefined,
      servings: form.servings,
      useFoods: form.useFoods,
      useUpFoods: form.useUpFoods,
      avoidFoods: form.avoidFoods,
      avoidAllergens: form.allergens,
      extraPolicy: form.extraPolicy,
      allowedSeasonings: form.seasonings,
      variation: 0,
    }
  }

  function submit() {
    setRunError(null)
    const req = buildRequest()
    if (!req) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    try {
      const result = generateRecipes(db, req)
      const working = Object.fromEntries(result.recipes.concat(result.rejected).map((r) => [r.id, r]))
      setSession((s) => ({ ...s, request: req, result, working: { ...s.working, ...working } }))
      navigate('results')
    } catch (err) {
      setRunError(`レシピの生成中にエラーが発生しました（${err instanceof Error ? err.message : String(err)}）。もう一度お試しください。`)
    }
  }

  const title = mode === 'calorie' ? 'カロリーからレシピを考える' : '食材からレシピを考える'
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted small">
        {mode === 'calorie'
          ? '目標カロリーとPFCを指定すると、食品成分データで栄養計算したレシピを考えます。'
          : '冷蔵庫にある食材を入力すると、その食材を優先して使うレシピを考えます。'}
      </p>
      {profile && (form.avoidFoods.length > 0 || form.allergens.length > 0) && (
        <div className="banner info small">「{profile.name}」さんのプロフィールから、避けたい食材・アレルギーを反映しています。</div>
      )}

      {mode === 'ingredients' && (
        <div className="card">
          <Field label="使用したい食材" error={errors.useFoods}>
            <FoodChipsInput value={form.useFoods} onChange={(v) => set('useFoods', v)} db={db} placeholder="例: 鶏むね肉（Enterで追加）" quick={QUICK_FOODS} />
          </Field>
          <Field label="使い切りたい食材（任意）" hint="最優先で使います。">
            <FoodChipsInput value={form.useUpFoods} onChange={(v) => set('useUpFoods', v)} db={db} placeholder="例: キャベツ" />
          </Field>
          <MatchList matches={matches} onReplace={(from, to) => setForm({ ...form, useFoods: form.useFoods.map((x) => (x === from ? to : x)), useUpFoods: form.useUpFoods.map((x) => (x === from ? to : x)) })} onRemove={(name) => setForm({ ...form, useFoods: form.useFoods.filter((x) => x !== name), useUpFoods: form.useUpFoods.filter((x) => x !== name) })} />
          <div className="lbl">追加食材の使用</div>
          <Seg value={form.extraPolicy} options={['allow', 'minimal', 'forbid'] as ExtraPolicy[]} labels={{ allow: '許可', minimal: '最小限', forbid: '禁止' }} onChange={(v) => set('extraPolicy', v)} />
          <p className="tiny muted" style={{ marginTop: 4 }}>禁止にすると、指定食材と調味料だけで作ります（栄養条件を満たしにくくなります）。</p>
        </div>
      )}

      <div className="card">
        <div className="grid2">
          <Field label={mode === 'calorie' ? '目標カロリー（1人前）' : '目標カロリー（1人前・任意）'} error={errors.kcal}>
            <div className="input-suffix">
              <input type="number" inputMode="numeric" min={50} max={3000} value={form.kcal} onChange={(e) => set('kcal', e.target.value)} />
              <span>kcal以内</span>
            </div>
          </Field>
          <Field label="食事人数">
            <select value={form.servings} onChange={(e) => set('servings', Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}人</option>)}
            </select>
          </Field>
        </div>
        <div className="lbl">食事区分</div>
        <Seg value={form.mealType} options={['朝食', '昼食', '夕食', '間食'] as MealType[]} onChange={(v) => set('mealType', v)} />
      </div>

      <div className="card">
        <div className="row between">
          <h2 style={{ margin: 0 }}>PFC目標（1人前）</h2>
          <button type="button" className="btn small" onClick={fillFromSettings} disabled={!defaultGrams}>設定の比率から入力</button>
        </div>
        {pfcEmpty && defaultGrams && (
          <p className="small muted" style={{ marginTop: 8 }}>
            未指定のため、栄養設定の比率（P{settings.pfcRatio.protein}% / F{settings.pfcRatio.fat}% / C{settings.pfcRatio.carbohydrates}%）から
            P {Math.round(defaultGrams.protein)}g・F {Math.round(defaultGrams.fat)}g・C {Math.round(defaultGrams.carbohydrates)}g を目安にします。
          </p>
        )}
        {(['protein', 'fat', 'carbohydrates'] as NutKey[]).map((k) => (
          <div key={k} style={{ marginTop: 10 }}>
            <div className="lbl">{NUT_LABEL[k]}</div>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <div className="input-suffix" style={{ flex: 1 }}>
                <input type="number" inputMode="decimal" min={0} max={500} placeholder="指定なし" value={form.pfc[k].value} onChange={(e) => setForm({ ...form, pfc: { ...form.pfc, [k]: { ...form.pfc[k], value: e.target.value } } })} />
                <span>g</span>
              </div>
              <select style={{ width: 110 }} value={form.pfc[k].mode} onChange={(e) => setForm({ ...form, pfc: { ...form.pfc, [k]: { ...form.pfc[k], mode: e.target.value as ModeOrNone } } })}>
                <option value="min">以上</option>
                <option value="max">以下</option>
                <option value="target">目安</option>
                <option value="none">指定なし</option>
              </select>
            </div>
            {errors[k] && <div className="err">{errors[k]}</div>}
          </div>
        ))}
        <p className="tiny muted" style={{ marginTop: 8 }}>「目安」は±10%（最低±3g）以内を目標にします。「以上」「以下」は必ず守る条件として扱います。</p>
      </div>

      <div className="card">
        <div className="lbl">調理時間</div>
        <Seg value={form.time} options={TIMES} labels={{ 0: '指定なし', 10: '10分', 15: '15分', 20: '20分', 30: '30分' }} onChange={(v) => set('time', v)} />
        <div className="lbl" style={{ marginTop: 12 }}>料理ジャンル</div>
        <Seg value={form.genre} options={GENRES} labels={{ '': '指定なし' }} onChange={(v) => set('genre', v)} />
        <div className="lbl" style={{ marginTop: 12 }}>調理方法</div>
        <Seg value={form.method} options={METHODS} labels={{ '': '指定なし' }} onChange={(v) => set('method', v)} />
        <div className="lbl" style={{ marginTop: 12 }}>調理難易度</div>
        <Seg value={form.difficulty} options={['', 'easy', 'normal', 'advanced'] as (Difficulty | '')[]} labels={{ '': '指定なし', easy: '簡単', normal: '普通まで', advanced: '本格的も含む' }} onChange={(v) => set('difficulty', v)} />
      </div>

      <div className="card">
        {mode === 'calorie' && (
          <Field label="使用したい食材（任意）">
            <FoodChipsInput value={form.useFoods} onChange={(v) => set('useFoods', v)} db={db} placeholder="例: 鶏むね肉" />
          </Field>
        )}
        {mode === 'calorie' && <MatchList matches={matches} onReplace={(from, to) => set('useFoods', form.useFoods.map((x) => (x === from ? to : x)))} onRemove={(name) => set('useFoods', form.useFoods.filter((x) => x !== name))} />}
        <Field label="避けたい食材（任意）" hint="名前の一部が一致する食品もすべて避けます。">
          <FoodChipsInput value={form.avoidFoods} onChange={(v) => set('avoidFoods', v)} db={db} placeholder="例: えび" />
        </Field>
        <div className="lbl">アレルギー・食事制限</div>
        <div className="chips">
          {ALLERGENS.map((a) => {
            const on = form.allergens.includes(a)
            return (
              <button key={a} type="button" className={`chip ${on ? 'bad' : 'gray'}`} style={{ cursor: 'pointer' }} aria-pressed={on} onClick={() => set('allergens', on ? form.allergens.filter((x) => x !== a) : [...form.allergens, a])}>
                {on ? '✕ ' : ''}{a}
              </button>
            )
          })}
        </div>
        {mode === 'ingredients' && (
          <details style={{ marginTop: 12 }}>
            <summary>使用可能な調味料を限定する（任意）</summary>
            <p className="tiny muted">選んだ調味料だけを使うレシピに絞ります。何も選ばなければ制限しません。</p>
            <div className="chips">
              {SEASONING_IDS.map((id) => db.get(id)).filter((f) => !!f).map((f) => {
                const on = form.seasonings.includes(f!.displayName)
                return (
                  <button key={f!.id} type="button" className={`chip ${on ? '' : 'gray'}`} style={{ cursor: 'pointer' }} aria-pressed={on} onClick={() => set('seasonings', on ? form.seasonings.filter((x) => x !== f!.displayName) : [...form.seasonings, f!.displayName])}>
                    {on ? '✓ ' : ''}{f!.displayName}
                  </button>
                )
              })}
            </div>
          </details>
        )}
      </div>

      {runError && (
        <div className="banner error">
          {runError}
          <div style={{ marginTop: 8 }}><button className="btn small" onClick={submit}>再試行</button></div>
        </div>
      )}
      <button className="btn primary block" style={{ minHeight: 52, fontSize: '1.05rem' }} onClick={submit}>レシピを考える</button>
      <p className="tiny muted" style={{ marginTop: 10 }}>レシピは端末内で生成し、入力内容を外部に送信しません。</p>
    </div>
  )
}

function MatchList({ matches, onReplace, onRemove }: { matches: { name: string; m: ReturnType<typeof matchFood> }[]; onReplace: (from: string, to: string) => void; onRemove: (name: string) => void }) {
  const bad = matches.filter((x) => x.m.status === 'unmatched')
  if (!bad.length) return null
  return (
    <div className="banner warn small" style={{ marginTop: 4 }}>
      <b>食品成分データに見つからない食材があります</b>
      <p className="tiny" style={{ margin: '4px 0' }}>似た食品を自動で同じものとして扱うことはしません。候補から選ぶか、食材データベースに推定値として登録してください。このままでは計算に含められません。</p>
      {bad.map(({ name, m }) => (
        <div key={name} style={{ marginTop: 6 }}>
          「{name}」→
          {m.status === 'unmatched' && m.candidates.length > 0 ? (
            <span className="chips" style={{ display: 'inline-flex', marginLeft: 4 }}>
              {m.candidates.slice(0, 4).map((c) => (
                <button key={c.id} type="button" className="chip" style={{ cursor: 'pointer' }} onClick={() => onReplace(name, c.displayName)}>{c.displayName}</button>
              ))}
            </span>
          ) : <span className="muted"> 候補なし</span>}
          <button type="button" className="btn ghost small" onClick={() => onRemove(name)}>削除</button>
        </div>
      ))}
    </div>
  )
}
