import type { Recipe } from '../types'

/**
 * 料理の種類ごとのイメージ写真（public/dishes/*.jpg）。
 * 実際のレシピの完成写真ではなく、料理の種類を表す代表的な写真。
 * 出典とライセンスは photoCredits.ts にまとめ、「写真の出典」画面に表示する。
 */
export type DishPhoto =
  // 料理の種類ごとの汎用写真（Unsplash）
  | 'steam' | 'grill' | 'grill-meat' | 'simmer' | 'bowl' | 'salad' | 'soup' | 'tomato-soup' | 'stirfry' | 'rice' | 'pasta' | 'egg' | 'fruit-bowl'
  // 料理の型ごとの写真（Openverse 経由の CC ライセンス写真）
  | 'jp-steam' | 'jp-teriyaki' | 'jp-teriyaki-fish' | 'jp-tojitamago' | 'jp-foil' | 'jp-miso-soup' | 'jp-natto-rice'
  | 'cn-steam-fish' | 'cn-oyster' | 'cn-mabo' | 'west-lemon' | 'west-lemon-fish' | 'west-soup' | 'west-pasta'
  | 'west-omelet' | 'west-yogurt' | 'kr-bibimbap' | 'kr-sundubu' | 'kr-kimchi' | 'eth-gapao' | 'eth-yum' | 'eth-soup'

/** 主なたんぱく質源が魚介類か肉・その他かで写真を変える料理 */
type ByProtein = { fish: DishPhoto; meat: DishPhoto }

const BY_TEMPLATE: Record<string, DishPhoto | ByProtein> = {
  'jp-steam': { fish: 'cn-steam-fish', meat: 'jp-steam' },
  'cn-steam': { fish: 'cn-steam-fish', meat: 'jp-steam' },
  'jp-foil': { fish: 'jp-foil', meat: 'jp-steam' },
  'jp-teriyaki': { fish: 'jp-teriyaki-fish', meat: 'jp-teriyaki' },
  'west-lemon': { fish: 'west-lemon-fish', meat: 'west-lemon' },
  'jp-ankake': { fish: 'simmer', meat: 'steam' },
  'jp-mizore': { fish: 'simmer', meat: 'steam' },
  'jp-tojitamago': 'jp-tojitamago',
  'jp-natto-rice': 'jp-natto-rice',
  'jp-salad': 'salad',
  'jp-miso-soup': 'jp-miso-soup',
  'cn-oyster': 'cn-oyster',
  'cn-shio': 'stirfry',
  'cn-chinjao': 'stirfry',
  'cn-mabo': 'cn-mabo',
  'west-tomato': 'tomato-soup',
  'west-soup': 'west-soup',
  'west-pasta': 'west-pasta',
  'west-omelet': 'west-omelet',
  'west-yogurt': 'west-yogurt',
  'kr-kimchi': 'kr-kimchi',
  'kr-bibimbap': 'kr-bibimbap',
  'kr-sundubu': 'kr-sundubu',
  'eth-gapao': 'eth-gapao',
  'eth-yum': 'eth-yum',
  'eth-soup': 'eth-soup',
}

/** 料理名に含まれる言葉から選ぶ（AIが考案したレシピなど、料理の型がない場合） */
const BY_NAME: [RegExp, DishPhoto | ByProtein][] = [
  [/麻婆/, 'cn-mabo'],
  [/ビビンバ/, 'kr-bibimbap'],
  [/スンドゥブ|チゲ/, 'kr-sundubu'],
  [/キムチ|プルコギ|ジェユク/, 'kr-kimchi'],
  [/ガパオ/, 'eth-gapao'],
  [/ヤムウンセン|春雨.*サラダ/, 'eth-yum'],
  [/春雨.*スープ|フォー/, 'eth-soup'],
  [/味噌汁|みそ汁|豚汁|けんちん汁/, 'jp-miso-soup'],
  [/納豆/, 'jp-natto-rice'],
  [/卵とじ|親子丼|他人丼/, 'jp-tojitamago'],
  [/オムレツ|卵焼き|スクランブル/, 'west-omelet'],
  [/オーツ|オートミール|グラノーラ/, 'west-yogurt'],
  [/オイスター/, 'cn-oyster'],
  [/パスタ|スパゲッティ|ペンネ/, 'west-pasta'],
  [/ミネストローネ|野菜スープ|具だくさんスープ/, 'west-soup'],
  [/トマトスープ|トマト煮|ポタージュ/, 'tomato-soup'],
  [/スープ|汁|鍋/, 'soup'],
  [/サラダ|和え|マリネ/, 'salad'],
  [/照り焼き|照焼/, { fish: 'jp-teriyaki-fish', meat: 'jp-teriyaki' }],
  [/レモン/, { fish: 'west-lemon-fish', meat: 'west-lemon' }],
  [/ホイル/, { fish: 'jp-foil', meat: 'jp-steam' }],
  [/炒め|チャンプルー|青椒肉絲|回鍋肉/, 'stirfry'],
  [/チャーハン|ピラフ|ライス|炒飯/, 'rice'],
  [/丼|ごはん/, 'bowl'],
  [/トースト/, 'egg'],
  [/ヨーグルト|フルーツ|スムージー/, 'fruit-bowl'],
  [/煮|あんかけ|シチュー|カレー/, { fish: 'simmer', meat: 'steam' }],
  [/蒸し/, { fish: 'cn-steam-fish', meat: 'jp-steam' }],
  [/焼き|ソテー|グリル|ステーキ/, { fish: 'grill', meat: 'grill-meat' }],
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
  const pick = (p: DishPhoto | ByProtein): DishPhoto => (typeof p === 'string' ? p : mainIsFish ? p.fish : p.meat)
  const byTemplate = recipe.templateId ? BY_TEMPLATE[recipe.templateId] : undefined
  if (byTemplate) return pick(byTemplate)
  for (const [re, p] of BY_NAME) if (re.test(recipe.recipeName)) return pick(p)
  const byMethod = (recipe.method && BY_METHOD[recipe.method]) || 'steam'
  if (!mainIsFish && byMethod === 'grill') return 'grill-meat'
  if (!mainIsFish && byMethod === 'simmer') return 'steam'
  return byMethod
}

export function dishPhotoUrl(photo: DishPhoto): string {
  return `${import.meta.env.BASE_URL}dishes/${photo}.jpg`
}
