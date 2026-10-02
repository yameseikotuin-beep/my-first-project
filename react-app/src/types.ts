// ---- 食品成分データ（foods テーブル相当） ----

export type FoodCategory =
  | '肉類'
  | '魚介類'
  | '卵・乳製品'
  | '野菜'
  | 'きのこ類'
  | '豆類・大豆製品'
  | '穀類・主食'
  | '果物'
  | '調味料'
  | 'その他'

/** レシピ構成上の役割 */
export type FoodRole = 'protein' | 'veg' | 'carb' | 'fruit' | 'dairy' | 'seasoning' | 'fat'

export type FoodState = '生' | 'ゆで' | '焼き' | 'めし' | '乾' | '加工品'

export type Allergen =
  | '卵'
  | '乳'
  | '小麦'
  | 'えび'
  | 'かに'
  | 'そば'
  | '落花生'
  | '大豆'
  | 'ごま'
  | 'いか'
  | '鶏肉'
  | '豚肉'
  | '牛肉'

export const ALLERGENS: Allergen[] = ['卵', '乳', '小麦', 'えび', 'かに', 'そば', '落花生', '大豆', 'ごま', 'いか', '鶏肉', '豚肉', '牛肉']

export interface Food {
  /** 食品番号（成分表）または 'custom-xxx' */
  id: string
  /** 成分表上の食品名 */
  name: string
  /** 画面表示用の名前 */
  displayName: string
  aliases: string[]
  category: FoodCategory
  role: FoodRole
  state: FoodState
  /** 栄養値の基準重量（g） */
  referenceWeight: number
  calories: number
  protein: number
  fat: number
  carbohydrates: number
  fiber: number | null
  salt: number | null
  allergens: Allergen[]
  /** 買い物リストの目安単位 */
  unit?: { name: string; grams: number }
  source: string
  sourceVersion: string
  updatedAt: string
  /**
   * verified: 公式ファイルと照合済み
   * transcribed: 成分表の値を手入力（公式ファイル未照合）
   * user: ユーザーが登録
   */
  verification: 'verified' | 'transcribed' | 'user'
  /** 推定値（成分表に該当データがない） */
  estimated: boolean
}

// ---- 栄養値 ----

export interface Nutrition {
  calories: number
  protein: number
  fat: number
  carbohydrates: number
  fiber: number
  salt: number
}

export interface PfcRatio {
  protein: number
  fat: number
  carbohydrates: number
}

// ---- 条件 ----

export type ConstraintMode = 'min' | 'max' | 'target'

export interface NutrientConstraint {
  value: number
  mode: ConstraintMode
}

export interface NutritionTargets {
  /** カロリー上限（kcal）。1人前あたり */
  maxCalories: number
  /** 目安カロリー（指定がなければ上限の95%を目指す） */
  targetCalories?: number
  protein?: NutrientConstraint
  fat?: NutrientConstraint
  carbohydrates?: NutrientConstraint
}

export type MealType = '朝食' | '昼食' | '夕食' | '間食'
export type Genre = '和食' | '洋食' | '中華' | '韓国料理' | 'エスニック'
export type CookMethod = '焼く' | '蒸す' | '煮る' | '炒める' | '電子レンジ' | '加熱なし'
export type Difficulty = 'easy' | 'normal' | 'advanced'
export type ExtraPolicy = 'allow' | 'minimal' | 'forbid'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '簡単', normal: '普通', advanced: '本格的' }

export interface GenerationRequest {
  mode: 'calorie' | 'ingredients'
  targets: NutritionTargets
  mealType: MealType
  genre?: Genre
  method?: CookMethod
  maxTime?: number
  difficulty?: Difficulty
  servings: number
  /** 使いたい食材（入力文字列） */
  useFoods: string[]
  /** 使い切りたい食材 */
  useUpFoods: string[]
  avoidFoods: string[]
  avoidAllergens: Allergen[]
  extraPolicy: ExtraPolicy
  /** 使用可能な調味料（空なら制限なし） */
  allowedSeasonings: string[]
  /** 多様性のためのオフセット（再生成・食事プランで使う） */
  variation?: number
  /** 使わないテンプレート */
  excludeTemplates?: string[]
  /** 1食の量が多い場合に分量の上限を広げる倍率（1〜1.5。食事プランで使う） */
  portionScale?: number
}

// ---- レシピ ----

export interface RecipeIngredient {
  /** 照合済みの食品ID。照合できなかった場合は null */
  foodId: string | null
  name: string
  /** 1人前の重量（g） */
  amountG: number
  foodState: FoodState | null
  role: FoodRole
  /** テンプレートのスロット（再最適化用） */
  slot?: string
  bounds?: { min: number; max: number; step: number }
  /** 調整対象外（調味料など） */
  fixed: boolean
  /** ユーザー指定以外で追加した食材 */
  added: boolean
  /** 1人前の栄養値（計算エンジンが算出） */
  nutrition: Nutrition | null
  matchStatus: 'exact' | 'alias' | 'unmatched'
  estimated: boolean
}

export interface CheckResult {
  key: string
  label: string
  ok: boolean
  /** hard: 必須条件, soft: 目標値, quality: 品質チェック */
  level: 'hard' | 'soft' | 'quality'
  detail: string
}

export type RecipeStatus = 'ok' | 'partial' | 'failed'

export interface Validation {
  status: RecipeStatus
  checks: CheckResult[]
  messages: string[]
}

export interface Recipe {
  id: string
  userId: string | null
  templateId: string | null
  recipeName: string
  description: string
  genre: Genre | null
  method: CookMethod | null
  mealType: MealType | null
  servings: number
  cookingTime: number
  difficulty: Difficulty
  ingredients: RecipeIngredient[]
  steps: string[]
  /** 1人前あたり */
  nutrition: Nutrition
  pfcRatio: PfcRatio
  /** PFCから計算したエネルギー（比率算出用） */
  pfcEnergy: number
  nutritionSource: string
  targets: NutritionTargets
  validation: Validation
  points: string[]
  warnings: string[]
  /** 指定されたが使わなかった食材とその理由 */
  unusedFoods: { name: string; reason: string }[]
  /** 分量上限の倍率（生成時の値。調整で同じ範囲を使うため保持） */
  portionScale?: number
  /** 作成方法: テンプレート（料理の型）または AI による考案 */
  source?: 'template' | 'ai'
  /** AIで生成した料理画像（Storage のパス） */
  imagePath?: string | null
  createdAt: string
  updatedAt: string
}

// ---- 利用者・設定 ----

export type Sex = 'male' | 'female' | 'unspecified'
export type ActivityLevel = 'low' | 'moderate' | 'high'

export interface Profile {
  id: string
  name: string
  age: number | null
  sex: Sex
  heightCm: number | null
  weightKg: number | null
  targetWeightKg: number | null
  bodyFatPercent: number | null
  activityLevel: ActivityLevel
  exerciseFrequency: string
  goal: 'lose' | 'maintain' | 'gain'
  periodWeeks: number | null
  allergens: Allergen[]
  avoidFoods: string[]
  preferences: string
  /** 妊娠・授乳中、持病・服薬あり（一般式の適用外として扱う） */
  specialCondition: boolean
  createdAt: string
  updatedAt: string
}

export interface NutritionSettings {
  userId: string | null
  calorieTarget: number
  proteinTarget: number
  fatTarget: number
  carbohydrateTarget: number
  /** 既定のPFCエネルギー比率（%） */
  pfcRatio: PfcRatio
  /** 1食あたりの既定カロリー */
  mealCalories: number
  updatedAt: string
}

export interface TargetHistoryEntry {
  id: string
  userId: string
  calorieTarget: number
  proteinTarget: number
  fatTarget: number
  carbohydrateTarget: number
  note: string
  createdAt: string
}

// ---- 食事プラン ----

export interface PlannedMeal {
  mealType: MealType
  label: string
  share: number
  eatingOut: boolean
  budget: { calories: number; protein: number; fat: number; carbohydrates: number }
  recipe: Recipe | null
  error: string | null
}

export interface MealPlanDay {
  date: string
  meals: PlannedMeal[]
  totals: Nutrition
}

export interface MealPlan {
  id: string
  userId: string | null
  name: string
  daily: { calories: number; protein: number; fat: number; carbohydrates: number }
  days: MealPlanDay[]
  createdAt: string
}

// ---- 買い物リスト・在庫 ----

export interface ShoppingItem {
  key: string
  foodId: string | null
  name: string
  category: FoodCategory
  state: FoodState | null
  requiredG: number
  stockG: number
  buyG: number
  /** 目安単位での表示 */
  unitLabel: string | null
  isSeasoning: boolean
  checked: boolean
  manual: boolean
}

export interface ShoppingList {
  id: string
  userId: string | null
  name: string
  sources: string[]
  items: ShoppingItem[]
  createdAt: string
  updatedAt: string
}

export type InventoryUnit = 'g' | 'ml' | '個' | '本' | 'パック' | '袋' | '枚' | '切れ' | '束' | '玉' | '缶'

export interface InventoryItem {
  id: string
  userId: string | null
  name: string
  foodId: string | null
  amount: number
  unit: InventoryUnit
  expiry: string | null
  createdAt: string
}

export interface Favorite {
  id: string
  userId: string | null
  recipeId: string
  createdAt: string
}
