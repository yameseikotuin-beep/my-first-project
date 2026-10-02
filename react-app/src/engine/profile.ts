import type { ActivityLevel, Profile } from '../types'
import { KCAL_PER_G } from './nutrition'

/** 身体活動レベル（日本人の食事摂取基準 2020年版 の区分 I〜III の代表値） */
export const ACTIVITY: Record<ActivityLevel, { label: string; pal: number; description: string }> = {
  low: { label: '低い', pal: 1.5, description: '生活の大部分が座位で、静的な活動が中心' },
  moderate: { label: 'ふつう', pal: 1.75, description: '座位中心だが、通勤・家事・軽いスポーツなどを含む' },
  high: { label: '高い', pal: 2.0, description: '立ち仕事・移動が多い、または活発な運動習慣がある' },
}

/** 1kgの体脂肪をエネルギーに換算した目安（kcal） */
export const KCAL_PER_KG_FAT = 7200

export interface TargetResult {
  ok: boolean
  bmi: number | null
  bmiCategory: string | null
  bmr: number | null
  tdee: number | null
  calories: number | null
  protein: number | null
  fat: number | null
  carbohydrates: number | null
  weeklyChangeKg: number | null
  /** 計算根拠 */
  basis: string[]
  warnings: string[]
  /** 自動で減量目標を設定しない理由（専門家への相談を促す） */
  blocked: string | null
}

export function bmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiCategory(b: number): string {
  if (b < 18.5) return '低体重'
  if (b < 25) return '普通体重'
  if (b < 30) return '肥満（1度）'
  if (b < 35) return '肥満（2度）'
  if (b < 40) return '肥満（3度）'
  return '肥満（4度）'
}

/**
 * 基礎代謝量（国立健康・栄養研究所の式, Ganpule et al. 2007）
 * (0.0481×体重 + 0.0234×身長 − 0.0138×年齢 − 定数) × 1000 / 4.186
 * 定数: 男性 0.4235、女性 0.9708
 */
export function bmrGanpule(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  const c = sex === 'male' ? 0.4235 : 0.9708
  return ((0.0481 * weightKg + 0.0234 * heightCm - 0.0138 * age - c) * 1000) / 4.186
}

export function calculateTargets(p: Profile): TargetResult {
  const r: TargetResult = {
    ok: false, bmi: null, bmiCategory: null, bmr: null, tdee: null, calories: null, protein: null, fat: null, carbohydrates: null, weeklyChangeKg: null,
    basis: [], warnings: [], blocked: null,
  }
  if (!p.heightCm || !p.weightKg || !p.age) {
    r.warnings.push('年齢・身長・体重を入力すると目標を計算できます。')
    return r
  }
  if (p.heightCm < 100 || p.heightCm > 230 || p.weightKg < 25 || p.weightKg > 250 || p.age < 1 || p.age > 110) {
    r.warnings.push('身長・体重・年齢の値が範囲外です。入力を確認してください。')
    return r
  }

  r.bmi = bmi(p.heightCm, p.weightKg)
  r.bmiCategory = bmiCategory(r.bmi)
  r.basis.push(`BMI = 体重(kg) ÷ 身長(m)² = ${r.bmi.toFixed(1)}（日本肥満学会の判定: ${r.bmiCategory}）`)

  if (p.sex === 'unspecified') {
    r.bmr = (bmrGanpule(p.weightKg, p.heightCm, p.age, 'male') + bmrGanpule(p.weightKg, p.heightCm, p.age, 'female')) / 2
    r.basis.push(`基礎代謝量 ${Math.round(r.bmr)}kcal（国立健康・栄養研究所の式。性別未指定のため男女の式の平均）`)
    r.warnings.push('性別を指定しない場合、基礎代謝量は男女の式の平均で計算しています。誤差が大きくなる場合があります。')
  } else {
    r.bmr = bmrGanpule(p.weightKg, p.heightCm, p.age, p.sex)
    r.basis.push(`基礎代謝量 ${Math.round(r.bmr)}kcal（国立健康・栄養研究所の式）`)
  }
  const act = ACTIVITY[p.activityLevel]
  r.tdee = r.bmr * act.pal
  r.basis.push(`推定エネルギー消費量 = 基礎代謝量 × 身体活動レベル ${act.pal}（${act.label}）= ${Math.round(r.tdee)}kcal`)

  // 一般式をそのまま適用できない条件
  if (p.specialCondition) r.blocked = '妊娠・授乳中、持病や服薬がある場合は、一般的な計算式をそのまま適用できません。医師・管理栄養士に相談のうえ目標を決めてください。'
  else if (p.age < 18) r.blocked = '18歳未満は成長に必要なエネルギーが加わるため、減量を目的とした目標は自動設定しません。医師・管理栄養士に相談してください。'
  else if (p.age >= 75 && p.goal === 'lose') r.blocked = '75歳以上の方の減量は、筋肉量の低下（フレイル）の心配があるため自動設定しません。医師・管理栄養士に相談してください。'
  else if (r.bmi < 18.5 && p.goal === 'lose') r.blocked = 'BMIが18.5未満（低体重）のため、減量目標は設定しません。体重を維持するか、専門家に相談してください。'

  let calories = r.tdee
  if (p.goal === 'lose' && !r.blocked) {
    if (!p.targetWeightKg || !p.periodWeeks) {
      r.warnings.push('目標体重と目標期間を入力すると、減量のためのカロリーを計算します。いまは維持カロリーを表示しています。')
    } else if (p.targetWeightKg >= p.weightKg) {
      r.warnings.push('目標体重が現在の体重以上です。目的を「維持」または「増量」にしてください。')
    } else {
      const targetBmi = bmi(p.heightCm, p.targetWeightKg)
      if (targetBmi < 18.5) r.warnings.push(`目標体重のBMIは${targetBmi.toFixed(1)}で低体重の範囲です。健康を損なうおそれがあるため、目標体重の見直しをおすすめします。`)
      const loss = p.weightKg - p.targetWeightKg
      const wanted = (loss * KCAL_PER_KG_FAT) / (p.periodWeeks * 7)
      // 1日の不足分は推定消費量の25%・750kcalまで、摂取量は基礎代謝量を下回らない
      const cap = Math.min(r.tdee * 0.25, 750, r.tdee - r.bmr)
      const deficit = Math.min(wanted, cap)
      if (wanted > cap) {
        const weeks = Math.ceil((loss * KCAL_PER_KG_FAT) / (cap * 7))
        r.warnings.push(`目標期間（${p.periodWeeks}週）では1日あたり約${Math.round(wanted)}kcalの不足が必要になり、過度な制限になります。安全な範囲に抑えたため、目標達成には約${weeks}週かかる見込みです。`)
      }
      calories = r.tdee - deficit
      r.weeklyChangeKg = -(deficit * 7) / KCAL_PER_KG_FAT
      r.basis.push(`減量: 体脂肪1kg ≈ ${KCAL_PER_KG_FAT}kcal として、1日 ${Math.round(deficit)}kcal 少なくする（週あたり約${Math.abs(r.weeklyChangeKg).toFixed(2)}kg）。不足分は推定消費量の25%・750kcalまで、摂取量は基礎代謝量以上に制限`)
    }
  } else if (p.goal === 'gain' && !r.blocked) {
    calories = r.tdee + 250
    r.weeklyChangeKg = (250 * 7) / KCAL_PER_KG_FAT
    r.basis.push('増量: 推定消費量 + 250kcal')
  } else if (r.blocked) {
    r.basis.push('目標は自動設定せず、参考として推定エネルギー消費量（維持）を表示しています。')
  }

  calories = Math.round(calories / 10) * 10
  // たんぱく質: 体重1kgあたり1.4g を目安に、エネルギー比15〜30%の範囲に収める
  let protein = p.weightKg * 1.4
  protein = Math.min(Math.max(protein, (calories * 0.15) / KCAL_PER_G.protein), (calories * 0.3) / KCAL_PER_G.protein)
  // 脂質: 食事摂取基準の目標量（20〜30%）の下限 20%
  const fat = (calories * 0.2) / KCAL_PER_G.fat
  const carbohydrates = (calories - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbohydrates
  r.basis.push('タンパク質: 体重1kgあたり1.4g（エネルギー比15〜30%の範囲内）')
  r.basis.push('脂質: エネルギー比20%（日本人の食事摂取基準の目標量 20〜30% の下限）')
  r.basis.push('炭水化物: 残りのエネルギー')
  const cRatio = (carbohydrates * 4 * 100) / calories
  if (cRatio < 50) r.warnings.push(`炭水化物のエネルギー比が${Math.round(cRatio)}%で、食事摂取基準の目標量（50〜65%）を下回ります。`)

  r.calories = calories
  r.protein = Math.round(protein)
  r.fat = Math.round(fat)
  r.carbohydrates = Math.round(carbohydrates)
  r.ok = !r.blocked
  r.warnings.push('この目標は一般的な推定式による目安で、医学的な診断や治療の代わりにはなりません。')
  return r
}
