import type { Allergen, ConstraintMode, CookMethod, Difficulty, ExtraPolicy, Genre, MealType } from '../types'

export type NutKey = 'protein' | 'fat' | 'carbohydrates'
export type ModeOrNone = ConstraintMode | 'none'

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
