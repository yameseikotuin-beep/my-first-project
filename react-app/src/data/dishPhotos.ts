import type { Recipe } from '../types'

/**
 * 料理の種類ごとのイメージ写真（public/dishes/*.jpg）。
 * 実際のレシピの完成写真ではなく、料理の種類を表す代表的な写真。
 * 出典: Unsplash（Unsplash License）。ファイル名と写真IDの対応:
 *   steam 1547496502-affa22d38842 / grill 1519708227418-c8fd9a32b7a2 / simmer 1574484284002-952d92456975
 *   bowl 1569718212165-3a8278d5f624 / salad 1546793665-c74683f339c1 / soup 1617093727343-374698b1b08d
 *   tomato-soup 1547592166-23ac45744acd / stirfry 1604908176997-125f25cc6f3d / rice 1512058564366-18510be2db19
 *   pasta 1621996346565-e3dbc646d9a9 / egg 1525351484163-7529414344d8 / fruit-bowl 1490474418585-ba9bad8fd0ea
 *   grill-meat 1532550907401-a500c9a57435
 */
export type DishPhoto =
  | 'steam' | 'grill' | 'grill-meat' | 'simmer' | 'bowl' | 'salad' | 'soup' | 'tomato-soup' | 'stirfry' | 'rice' | 'pasta' | 'egg' | 'fruit-bowl'

const BY_TEMPLATE: Record<string, DishPhoto> = {
  'jp-steam': 'steam',
  'jp-foil': 'steam',
  'cn-steam': 'steam',
  'jp-teriyaki': 'grill',
  'west-lemon': 'grill',
  'jp-ankake': 'simmer',
  'jp-mizore': 'simmer',
  'cn-mabo': 'stirfry',
  'west-tomato': 'tomato-soup',
  'jp-tojitamago': 'bowl',
  'kr-bibimbap': 'bowl',
  'jp-natto-rice': 'bowl',
  'jp-salad': 'salad',
  'eth-yum': 'salad',
  'jp-miso-soup': 'soup',
  'kr-sundubu': 'soup',
  'eth-soup': 'soup',
  'west-soup': 'tomato-soup',
  'cn-oyster': 'stirfry',
  'cn-shio': 'stirfry',
  'cn-chinjao': 'stirfry',
  'kr-kimchi': 'stirfry',
  'eth-gapao': 'rice',
  'west-pasta': 'pasta',
  'west-omelet': 'egg',
  'west-yogurt': 'fruit-bowl',
}

/** 料理名に含まれる言葉から選ぶ（AIが考案したレシピなど、料理の型がない場合） */
const BY_NAME: [RegExp, DishPhoto][] = [
  [/パスタ|スパゲッティ|ペンネ/, 'pasta'],
  [/トマトスープ|ミネストローネ|ポタージュ/, 'tomato-soup'],
  [/スープ|汁|鍋|スンドゥブ/, 'soup'],
  [/サラダ|和え|マリネ|ヤム/, 'salad'],
  [/炒め|チャンプルー|青椒肉絲|回鍋肉/, 'stirfry'],
  [/チャーハン|ガパオ|ピラフ|ライス|炒飯/, 'rice'],
  [/丼|ごはん|ビビンバ|卵とじ/, 'bowl'],
  [/オムレツ|卵焼き|スクランブル|トースト/, 'egg'],
  [/ヨーグルト|オーツ|フルーツ|スムージー/, 'fruit-bowl'],
  [/煮|あんかけ|麻婆|シチュー|カレー/, 'simmer'],
  [/蒸し|ホイル/, 'steam'],
  [/焼き|ソテー|グリル|照り|ステーキ/, 'grill'],
]

const BY_METHOD: Record<string, DishPhoto> = {
  焼く: 'grill',
  蒸す: 'steam',
  煮る: 'simmer',
  炒める: 'stirfry',
  電子レンジ: 'steam',
  加熱なし: 'salad',
}

/**
 * レシピに合うイメージ写真を選ぶ。mainIsFish は主なたんぱく質源が魚介類かどうか
 * （焼き物・煮物は、魚の写真を肉の料理に使わないよう切り替える）。
 */
export function dishPhotoFor(recipe: Pick<Recipe, 'templateId' | 'recipeName' | 'method'>, mainIsFish = true): DishPhoto {
  let photo: DishPhoto | undefined = recipe.templateId ? BY_TEMPLATE[recipe.templateId] : undefined
  if (!photo) for (const [re, p] of BY_NAME) if (re.test(recipe.recipeName)) { photo = p; break }
  photo ??= (recipe.method && BY_METHOD[recipe.method]) || 'steam'
  if (!mainIsFish && photo === 'grill') return 'grill-meat'
  if (!mainIsFish && photo === 'simmer') return 'steam'
  return photo
}

export function dishPhotoUrl(photo: DishPhoto): string {
  return `${import.meta.env.BASE_URL}dishes/${photo}.jpg`
}
