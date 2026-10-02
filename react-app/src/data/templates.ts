import type { CookMethod, Difficulty, FoodRole, Genre, MealType } from '../types'

/**
 * レシピ構成テンプレート。
 * 「どの食材をどう組み合わせ、どう調理するか」だけを持ち、分量は計算エンジンが
 * 栄養条件に合わせて決める。栄養値は一切持たない。
 */

export interface TemplateSlot {
  key: string
  role: FoodRole
  /** 既定で使う食品（食品番号）。先頭から優先 */
  preferred: string[]
  /** 受け入れる食品を限定する場合（未指定なら role が一致する食品を受け入れる） */
  accepts?: string[]
  /** 1人前の重量（g）の範囲と刻み */
  min: number
  max: number
  step: number
  default: number
  /** 0g（使わない）にできる */
  optional?: boolean
}

export interface TemplateStep {
  text: string
  /** このスロットが使われている場合だけ表示 */
  needs?: string
}

export interface TemplateSeasoning {
  foodId: string
  /** 1人前（g） */
  grams: number
}

export interface RecipeTemplate {
  id: string
  /** {スロット名} を食材名で置き換える */
  name: string
  description: string
  genre: Genre
  methods: CookMethod[]
  time: number
  /** 調理方法ごとの調理時間 */
  methodTime?: Partial<Record<CookMethod, number>>
  difficulty: Difficulty
  mealTypes: MealType[]
  slots: TemplateSlot[]
  seasonings: TemplateSeasoning[]
  steps: TemplateStep[]
  methodSteps?: Partial<Record<CookMethod, TemplateStep[]>>
  points: string[]
  /** 加熱が必要な主菜（安全確認の手順を必ず含める） */
  heated: boolean
}

const MAIN_MEALS: MealType[] = ['昼食', '夕食']
const ALL_MEALS: MealType[] = ['朝食', '昼食', '夕食']

const CHICKEN = '11220'
const SASAMI = '11227'
const PORK_FILLET = '11140'
const BEEF = '11049'
const SALMON = '10134'
const COD = '10205'
const SHRIMP = '10329'
const SQUID = '10345'
const TUNA = '10260'
const EGG = '12004'
const TOFU = '04032'
const SILKEN = '04033'
const RICE = '01088'

const protein = (preferred: string[], d = 150, min = 60, max = 250, accepts?: string[]): TemplateSlot => ({
  key: 'protein', role: 'protein', preferred, accepts, min, max, step: 10, default: d,
})
const veg = (key: string, preferred: string[], d = 80, min = 30, max = 200, optional = false): TemplateSlot => ({
  key, role: 'veg', preferred, min, max, step: 10, default: d, optional,
})
const rice = (d = 150, optional = true, min = 80, max = 250): TemplateSlot => ({
  key: 'carb', role: 'carb', preferred: [RICE, '01168'], accepts: [RICE, '01168'], min, max, step: 10, default: d, optional,
})

export const TEMPLATES: RecipeTemplate[] = [
  {
    id: 'jp-steam',
    name: '{protein}と{veg1}の和風蒸し',
    description: 'ポン酢でさっぱり食べる、油を使わない蒸し料理。',
    genre: '和食', methods: ['蒸す', '電子レンジ'], time: 20, methodTime: { 電子レンジ: 15 }, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, COD, SALMON]), veg('veg1', ['06061', '06233', '06291']), veg('veg2', ['08016', '08001', '08039'], 50, 0, 120, true), veg('veg3', ['06153', '06226'], 40, 0, 100, true), rice()],
    seasonings: [{ foodId: '17110', grams: 15 }, { foodId: '16001', grams: 5 }],
    steps: [
      { text: '{protein}を一口大のそぎ切りにする。' },
      { text: '{veg1}はざく切りにする。', needs: 'veg1' },
      { text: '{veg2}は石づきを取ってほぐす。', needs: 'veg2' },
      { text: '{veg3}は薄切りにする。', needs: 'veg3' },
      { text: 'フライパンに野菜を敷き、{protein}をのせて酒をふる。' },
      { text: 'ふたをして中火で8〜10分蒸し焼きにする。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認し、ポン酢をかける。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    methodSteps: {
      電子レンジ: [
        { text: '{protein}を一口大のそぎ切りにする。' },
        { text: '{veg1}はざく切りにする。', needs: 'veg1' },
        { text: '{veg2}は石づきを取ってほぐす。', needs: 'veg2' },
        { text: '{veg3}は薄切りにする。', needs: 'veg3' },
        { text: '耐熱容器に野菜を敷き、{protein}を重ならないようにのせて酒をふる。' },
        { text: 'ふんわりラップをして600Wで5〜6分加熱する。' },
        { text: '{protein}の中心まで十分に火が通っていることを確認し（足りなければ30秒ずつ追加加熱）、ポン酢をかける。' },
        { text: '{carb}を添える。', needs: 'carb' },
      ],
    },
    points: ['油を使わず蒸すことで脂質を抑えられる', '野菜ときのこでかさ増しし、食物繊維も補える'],
    heated: true,
  },
  {
    id: 'jp-teriyaki',
    name: '{protein}の照り焼き {veg1}添え',
    description: '甘辛いたれで満足感のある定番の主菜。',
    genre: '和食', methods: ['焼く'], time: 20, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, SALMON, PORK_FILLET]), veg('veg1', ['06263', '06007', '06245'], 80), veg('veg2', ['06312', '06061'], 40, 0, 100, true), rice()],
    seasonings: [{ foodId: '17007', grams: 9 }, { foodId: '16025', grams: 9 }, { foodId: '03003', grams: 2 }, { foodId: '14006', grams: 2 }],
    steps: [
      { text: '{protein}は厚みを均一にし、フォークで数か所穴をあける。' },
      { text: '{veg1}は食べやすく切り、耐熱容器に入れてラップをし、電子レンジ（600W）で1分30秒〜2分加熱する。', needs: 'veg1' },
      { text: '{veg2}はせん切りにする。', needs: 'veg2' },
      { text: 'フライパンに油を薄くひき、{protein}を中火で両面焼く。ふたをして弱火で5分ほど火を通す。' },
      { text: 'しょうゆ・みりん・砂糖を加え、煮からめて照りを出す。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認し、野菜と盛り付ける。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['皮なしの部位を使い脂質を抑えている', '甘辛い味付けで満足感を出しつつ、油は最小限'],
    heated: true,
  },
  {
    id: 'jp-ankake',
    name: '{protein}と{veg1}の和風あんかけ',
    description: 'だしのとろみで食べ応えを出した、体が温まる一品。',
    genre: '和食', methods: ['煮る'], time: 20, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, COD, TOFU]), veg('veg1', ['06233', '06061', '06086']), veg('veg2', ['08039', '08016'], 50, 0, 120, true), veg('veg3', ['06214'], 30, 0, 80, true), rice()],
    seasonings: [{ foodId: '17028', grams: 1.5 }, { foodId: '17007', grams: 6 }, { foodId: '16025', grams: 6 }, { foodId: '02034', grams: 4 }],
    steps: [
      { text: '{protein}を一口大に切る。' },
      { text: '{veg1}はざく切り、{veg2}は薄切りにする。' },
      { text: '{veg3}は短冊切りにする。', needs: 'veg3' },
      { text: '鍋に水200ml（分量外）と和風だしを入れて煮立て、{protein}と野菜を入れて8分ほど煮る。' },
      { text: 'しょうゆ・みりんで味を調え、同量の水で溶いた片栗粉を回し入れてとろみをつける。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認して器に盛る。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['油を使わず煮ることで脂質を抑えられる', 'とろみで冷めにくく、満腹感が続きやすい'],
    heated: true,
  },
  {
    id: 'jp-tojitamago',
    name: '{protein}と{veg1}の卵とじ',
    description: 'だしの香るやさしい味。ごはんにのせて丼にもできる。',
    genre: '和食', methods: ['煮る'], time: 15, difficulty: 'easy', mealTypes: ALL_MEALS,
    slots: [protein([CHICKEN, SASAMI, PORK_FILLET], 100, 50, 200), { key: 'egg', role: 'protein', preferred: [EGG], accepts: [EGG], min: 50, max: 100, step: 50, default: 50 }, veg('veg1', ['06153', '06061', '06226']), veg('veg2', ['06086', '08016'], 40, 0, 100, true), rice(150)],
    seasonings: [{ foodId: '17028', grams: 1 }, { foodId: '17007', grams: 8 }, { foodId: '16025', grams: 8 }],
    steps: [
      { text: '{protein}は小さめのそぎ切り、{veg1}は薄切りにする。' },
      { text: '{veg2}は食べやすく切る。', needs: 'veg2' },
      { text: '小鍋に水100ml（分量外）と和風だし・しょうゆ・みりんを入れて煮立てる。' },
      { text: '{protein}と野菜を入れ、ふたをして中火で5〜6分煮る。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '溶いた{egg}を回し入れ、ふたをして好みのかたさになるまで加熱する。' },
      { text: '{carb}にのせるか、添える。', needs: 'carb' },
    ],
    points: ['卵と肉の2種類のたんぱく質源を組み合わせている', '油を使わない調理で脂質を抑えている'],
    heated: true,
  },
  {
    id: 'jp-foil',
    name: '{protein}と{veg1}のホイル焼き',
    description: '包んで焼くだけ。素材のうま味を閉じ込める。',
    genre: '和食', methods: ['焼く'], time: 20, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([SALMON, COD, CHICKEN], 100, 60, 200), veg('veg1', ['08016', '08001', '08028']), veg('veg2', ['06153', '06061'], 50, 0, 120, true), rice()],
    seasonings: [{ foodId: '17007', grams: 5 }, { foodId: '07156', grams: 5 }, { foodId: '16001', grams: 5 }],
    steps: [
      { text: '{veg1}はほぐし、{veg2}は薄切りにする。' },
      { text: 'アルミホイルに野菜を敷き、{protein}をのせて酒をふり、口を閉じる。' },
      { text: 'フライパンに入れ、ふたをして中火で12〜15分蒸し焼きにする。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: 'しょうゆとレモン果汁をかける。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['油を使わず素材の水分で蒸し焼きにする', 'きのこでかさ増しし、食物繊維をプラス'],
    heated: true,
  },
  {
    id: 'jp-mizore',
    name: '{protein}のみぞれ煮',
    description: '大根おろしでさっぱり。消化にもやさしい煮物。',
    genre: '和食', methods: ['煮る'], time: 20, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [protein([COD, CHICKEN, SALMON], 120, 60, 220), { key: 'veg1', role: 'veg', preferred: ['06134'], accepts: ['06134'], min: 50, max: 200, step: 10, default: 100 }, veg('veg2', ['06226', '06086'], 30, 0, 80, true), rice()],
    seasonings: [{ foodId: '17028', grams: 1 }, { foodId: '17007', grams: 8 }, { foodId: '16025', grams: 8 }],
    steps: [
      { text: '{veg1}をすりおろし、軽く水気をきる。' },
      { text: '{protein}は食べやすく切る。{veg2}は斜め切りにする。' },
      { text: '鍋に水150ml（分量外）・和風だし・しょうゆ・みりんを煮立て、{protein}を入れて弱めの中火で6〜8分煮る。' },
      { text: '大根おろしと{veg2}を加えてひと煮立ちさせる。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認して器に盛る。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['揚げずに煮ることで脂質を大幅に抑えている', '大根おろしでボリュームを出している'],
    heated: true,
  },
  {
    id: 'jp-salad',
    name: '{protein}と{veg1}のさっぱりサラダ',
    description: 'レンジで加熱した主菜を野菜とポン酢で和える、火を使わない一品。',
    genre: '和食', methods: ['電子レンジ'], time: 10, difficulty: 'easy', mealTypes: ALL_MEALS,
    slots: [protein([SASAMI, CHICKEN, TUNA, TOFU], 100, 50, 200), veg('veg1', ['06312', '06065', '06182']), veg('veg2', ['06182', '06065'], 60, 0, 150, true), rice(120)],
    seasonings: [{ foodId: '17110', grams: 15 }, { foodId: '05018', grams: 1 }, { foodId: '16001', grams: 5 }],
    steps: [
      { text: '{protein}を耐熱皿にのせ、酒をふってふんわりラップをする。' },
      { text: '600Wで2分30秒〜3分加熱し、中心まで十分に火が通っていることを確認する（足りなければ30秒ずつ追加）。そのまま冷ましてほぐす。' },
      { text: '{veg1}は食べやすくちぎるか切る。' },
      { text: '{veg2}も食べやすく切る。', needs: 'veg2' },
      { text: '器に盛り、ポン酢と白ごまをかける。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['火を使わず10分で作れる', '脂質の少ない部位を使った高たんぱくなサラダ'],
    heated: true,
  },
  {
    id: 'jp-miso-soup',
    name: '{protein}と{veg1}の具だくさん味噌汁',
    description: '具をたっぷり入れて主菜にもなる汁物。',
    genre: '和食', methods: ['煮る'], time: 15, difficulty: 'easy', mealTypes: ALL_MEALS,
    slots: [protein([TOFU, CHICKEN, PORK_FILLET], 120, 60, 250), veg('veg1', ['06233', '06061', '06134']), veg('veg2', ['08016', '08001', '06226'], 40, 0, 100, true), { key: 'egg', role: 'protein', preferred: [EGG], accepts: [EGG], min: 0, max: 50, step: 50, default: 0, optional: true }, rice(120)],
    seasonings: [{ foodId: '17045', grams: 12 }, { foodId: '17028', grams: 1 }],
    steps: [
      { text: '{protein}と{veg1}を食べやすい大きさに切る。' },
      { text: '{veg2}も食べやすく切る。', needs: 'veg2' },
      { text: '鍋に水250ml（分量外）と和風だしを入れて煮立て、{protein}と野菜を入れて6〜8分煮る。' },
      { text: '溶いた{egg}を回し入れてふんわり固める。', needs: 'egg' },
      { text: '火を弱めて味噌を溶き入れる（煮立たせない）。具材に十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['汁物にすることで満腹感が得やすい', '野菜ときのこで食物繊維を補える'],
    heated: true,
  },
  {
    id: 'jp-natto-rice',
    name: '{veg1}入り納豆ごはん',
    description: '火を使わず5分。朝食向けの高たんぱくな組み合わせ。',
    genre: '和食', methods: ['加熱なし'], time: 5, difficulty: 'easy', mealTypes: ['朝食', '昼食'],
    slots: [{ key: 'protein', role: 'protein', preferred: ['04046'], accepts: ['04046'], min: 45, max: 90, step: 45, default: 45 }, { key: 'egg', role: 'protein', preferred: ['12014', EGG], accepts: ['12014', EGG], min: 0, max: 60, step: 30, default: 30, optional: true }, veg('veg1', ['06226'], 10, 5, 30), rice(150, false, 100, 220)],
    seasonings: [{ foodId: '17007', grams: 4 }],
    steps: [
      { text: '{veg1}を小口切りにする。' },
      { text: '{protein}をよく混ぜ、しょうゆと{veg1}を加える。' },
      { text: '{egg}を加えて混ぜる（生食用の新鮮なものを使う）。', needs: 'egg' },
      { text: '{carb}にのせる。' },
    ],
    points: ['発酵食品と卵でたんぱく質を手軽に補える', '火を使わずすぐ作れる'],
    heated: false,
  },
  {
    id: 'cn-steam',
    name: '{protein}と{veg1}の中華蒸し',
    description: 'しょうがとごま油の香りで食欲をそそる蒸し料理。',
    genre: '中華', methods: ['蒸す', '電子レンジ'], time: 20, methodTime: { 電子レンジ: 15 }, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, COD, PORK_FILLET]), veg('veg1', ['06061', '06233', '06291']), veg('veg2', ['06226', '08001'], 40, 0, 100, true), rice()],
    seasonings: [{ foodId: '17093', grams: 1.5 }, { foodId: '17007', grams: 5 }, { foodId: '06103', grams: 3 }, { foodId: '14002', grams: 2 }, { foodId: '16001', grams: 5 }],
    steps: [
      { text: '{protein}をそぎ切りにし、しょうがはせん切りにする。' },
      { text: '{veg1}はざく切り、{veg2}は斜め切りにする。' },
      { text: '鶏がらスープの素・しょうゆ・酒を混ぜてたれを作る。' },
      { text: 'フライパンに野菜を敷いて{protein}をのせ、たれとしょうがをかける。' },
      { text: 'ふたをして中火で8〜10分蒸し焼きにする。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認し、仕上げにごま油をたらす。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    methodSteps: {
      電子レンジ: [
        { text: '{protein}をそぎ切りにし、しょうがはせん切りにする。' },
        { text: '{veg1}はざく切り、{veg2}は斜め切りにする。' },
        { text: '鶏がらスープの素・しょうゆ・酒を混ぜてたれを作る。' },
        { text: '耐熱容器に野菜を敷いて{protein}をのせ、たれとしょうがをかける。' },
        { text: 'ふんわりラップをして600Wで5〜6分加熱する。' },
        { text: '{protein}の中心まで十分に火が通っていることを確認し（足りなければ30秒ずつ追加加熱）、ごま油をたらす。' },
        { text: '{carb}を添える。', needs: 'carb' },
      ],
    },
    points: ['ごま油は仕上げに少量だけ使い、香りで満足感を出す', '蒸すことで余分な油を使わない'],
    heated: true,
  },
  {
    id: 'cn-oyster',
    name: '{protein}と{veg1}のオイスター炒め',
    description: 'オイスターソースのコクで、少ない油でも満足できる炒め物。',
    genre: '中華', methods: ['炒める'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, BEEF, SHRIMP], 130), veg('veg1', ['06263', '06245', '06291']), veg('veg2', ['06153', '06214', '08025'], 50, 0, 120, true), rice()],
    seasonings: [{ foodId: '17031', grams: 8 }, { foodId: '17007', grams: 3 }, { foodId: '16001', grams: 5 }, { foodId: '02034', grams: 3 }, { foodId: '14006', grams: 3 }],
    steps: [
      { text: '{protein}を細切りにし、酒と片栗粉をもみ込む。' },
      { text: '{veg1}と{veg2}を食べやすく切る。' },
      { text: 'フライパンに油を熱し、{protein}を中火で色が変わるまで炒める。' },
      { text: '野菜を加えて炒め合わせ、ふたをして1〜2分蒸し焼きにする。' },
      { text: 'オイスターソースとしょうゆを加えて全体にからめる。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['片栗粉をまぶすことで少ない油でもしっとり仕上がる', '野菜をたっぷり使いボリュームを出している'],
    heated: true,
  },
  {
    id: 'cn-shio',
    name: '{protein}と{veg1}の塩炒め',
    description: '鶏がらとしょうがで仕上げる、あっさり味の炒め物。',
    genre: '中華', methods: ['炒める'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([SHRIMP, CHICKEN, SQUID], 120), veg('veg1', ['06263', '06233', '06061']), veg('veg2', ['06214', '08001', '06226'], 40, 0, 100, true), rice()],
    seasonings: [{ foodId: '17093', grams: 2 }, { foodId: '06103', grams: 3 }, { foodId: '16001', grams: 5 }, { foodId: '02034', grams: 2 }, { foodId: '14006', grams: 3 }],
    steps: [
      { text: '{protein}は食べやすく切り、酒と片栗粉をまぶす。しょうがはみじん切りにする。' },
      { text: '{veg1}と{veg2}を食べやすく切る。' },
      { text: 'フライパンに油としょうがを入れて熱し、{protein}を炒める。' },
      { text: '野菜を加え、ふたをして2分ほど蒸し焼きにする。' },
      { text: '鶏がらスープの素で味を調える。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['低脂質のたんぱく質源を使った炒め物', '蒸し焼きを組み合わせて油の量を抑えている'],
    heated: true,
  },
  {
    id: 'cn-mabo',
    name: 'ヘルシー麻婆{protein}',
    description: '豆腐と少量のひき肉で作る、脂質控えめの麻婆。',
    genre: '中華', methods: ['煮る', '炒める'], time: 20, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [{ key: 'protein', role: 'protein', preferred: [TOFU, SILKEN], accepts: [TOFU, SILKEN], min: 100, max: 300, step: 10, default: 200 }, { key: 'meat', role: 'protein', preferred: [CHICKEN, '11230', PORK_FILLET], accepts: [CHICKEN, '11230', PORK_FILLET, SASAMI], min: 0, max: 120, step: 10, default: 50, optional: true }, veg('veg1', ['06226', '06207'], 40, 20, 100), rice()],
    seasonings: [{ foodId: '17004', grams: 4 }, { foodId: '17093', grams: 1.5 }, { foodId: '17007', grams: 5 }, { foodId: '06223', grams: 3 }, { foodId: '06103', grams: 3 }, { foodId: '02034', grams: 4 }, { foodId: '14002', grams: 2 }],
    steps: [
      { text: '{protein}をさいの目に切る。{veg1}、にんにく、しょうがはみじん切りにする。' },
      { text: '{meat}は細かく刻む。', needs: 'meat' },
      { text: 'フライパンににんにく・しょうが・豆板醤を入れて弱火で香りを出し、{meat}を加えて炒める。', needs: 'meat' },
      { text: '水150ml（分量外）・鶏がらスープの素・しょうゆを加えて煮立て、{protein}を入れて3〜4分煮る。' },
      { text: '{veg1}を加え、水溶き片栗粉でとろみをつける。仕上げにごま油をたらす。' },
      { text: '全体が十分に加熱されていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['ひき肉を減らし、脂質の少ない肉で置き換えている', '豆腐でかさを出し満腹感を得やすい'],
    heated: true,
  },
  {
    id: 'cn-chinjao',
    name: '{protein}の青椒肉絲風',
    description: 'ピーマンをたっぷり使った定番中華を、脂質控えめに。',
    genre: '中華', methods: ['炒める'], time: 20, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [protein([BEEF, PORK_FILLET, CHICKEN], 120), { key: 'veg1', role: 'veg', preferred: ['06245'], accepts: ['06245', '06247'], min: 40, max: 150, step: 10, default: 80 }, veg('veg2', ['06153', '06214', '06247'], 40, 0, 100, true), rice()],
    seasonings: [{ foodId: '17031', grams: 6 }, { foodId: '17007', grams: 4 }, { foodId: '16001', grams: 5 }, { foodId: '02034', grams: 3 }, { foodId: '14006', grams: 3 }],
    steps: [
      { text: '{protein}を細切りにし、酒と片栗粉をもみ込む。' },
      { text: '{veg1}と{veg2}を細切りにする。' },
      { text: 'フライパンに油を熱し、{protein}をほぐしながら炒める。' },
      { text: '野菜を加えて強めの中火で手早く炒める。' },
      { text: 'オイスターソースとしょうゆを加えて全体にからめる。' },
      { text: '{protein}に十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['赤身の部位を使い脂質を抑えている', 'ピーマンでビタミンと食物繊維を補える'],
    heated: true,
  },
  {
    id: 'west-tomato',
    name: '{protein}と{veg1}のトマト煮',
    description: 'トマトのうま味で煮込む、洋風の主菜。',
    genre: '洋食', methods: ['煮る'], time: 25, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, COD, SALMON]), { key: 'veg1', role: 'veg', preferred: ['06182'], accepts: ['06182'], min: 80, max: 250, step: 10, default: 150 }, veg('veg2', ['06153', '08016', '06191'], 60, 0, 150, true), veg('veg3', ['06263', '06247', '06007'], 50, 0, 120, true), { key: 'carb', role: 'carb', preferred: [RICE, '01026'], accepts: [RICE, '01168', '01026'], min: 60, max: 250, step: 10, default: 150, optional: true }],
    seasonings: [{ foodId: '17027', grams: 2 }, { foodId: '17036', grams: 10 }, { foodId: '06223', grams: 3 }, { foodId: '14001', grams: 3 }],
    steps: [
      { text: '{protein}を一口大に切る。にんにくはみじん切りにする。' },
      { text: '{veg1}はざく切り、{veg2}は食べやすく切る。' },
      { text: '{veg3}も食べやすく切る。', needs: 'veg3' },
      { text: '鍋にオリーブオイルとにんにくを入れて弱火で香りを出し、{protein}の表面を焼く。' },
      { text: '野菜・コンソメ・ケチャップ・水100ml（分量外）を加え、ふたをして10〜12分煮込む。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['トマトのうま味で油を控えてもコクが出る', '野菜をたっぷり煮込み、満足感を高めている'],
    heated: true,
  },
  {
    id: 'west-lemon',
    name: '{protein}のレモンソテー {veg1}添え',
    description: 'レモンの酸味でさっぱり食べられるソテー。',
    genre: '洋食', methods: ['焼く'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, SALMON]), veg('veg1', ['06007', '06263', '06247']), veg('veg2', ['06312', '06182'], 50, 0, 120, true), { key: 'carb', role: 'carb', preferred: [RICE, '01026', '02017'], accepts: [RICE, '01168', '01026', '02017', '06048'], min: 60, max: 250, step: 10, default: 150, optional: true }],
    seasonings: [{ foodId: '07156', grams: 10 }, { foodId: '17012', grams: 1 }, { foodId: '01015', grams: 4 }, { foodId: '14001', grams: 3 }],
    steps: [
      { text: '{protein}をそぎ切りにして塩をふり、薄力粉を薄くまぶす。' },
      { text: '{veg1}は食べやすく切る。{veg2}も食べやすく切る。' },
      { text: 'フライパンにオリーブオイルを熱し、{protein}を中火で両面焼く。' },
      { text: '{veg1}を加え、ふたをして弱火で4〜5分焼く。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認し、レモン果汁を回しかける。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['薄力粉をまぶすことで少ない油でもしっとり焼ける', 'レモンの酸味で塩分を控えめにできる'],
    heated: true,
  },
  {
    id: 'west-soup',
    name: '{protein}と野菜の具だくさんスープ',
    description: '野菜をたっぷり煮込んだ、食べるスープ。',
    genre: '洋食', methods: ['煮る'], time: 20, difficulty: 'easy', mealTypes: ALL_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, SHRIMP], 120), veg('veg1', ['06061', '06233']), veg('veg2', ['06214', '06153'], 50, 0, 120, true), veg('veg3', ['08016', '06263', '06191'], 50, 0, 120, true), { key: 'carb', role: 'carb', preferred: ['01026', RICE], accepts: ['01026', RICE, '01168', '02017'], min: 60, max: 220, step: 10, default: 60, optional: true }],
    seasonings: [{ foodId: '17027', grams: 3 }, { foodId: '16001', grams: 5 }],
    steps: [
      { text: '{protein}と{veg1}を一口大に切る。' },
      { text: '{veg2}と{veg3}も食べやすく切る。' },
      { text: '鍋に水300ml（分量外）・コンソメ・酒を入れて煮立て、{protein}と野菜を入れる。' },
      { text: 'ふたをして弱めの中火で10分ほど煮る。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['油を使わないスープで脂質を抑えている', '温かい汁物は満腹感が得やすい'],
    heated: true,
  },
  {
    id: 'west-pasta',
    name: '{protein}と{veg1}のトマトパスタ',
    description: '具材のうま味で作る、オイル控えめのパスタ。',
    genre: '洋食', methods: ['煮る', '炒める'], time: 20, difficulty: 'normal', mealTypes: ['昼食', '夕食'],
    slots: [protein([TUNA, CHICKEN, SHRIMP], 70, 50, 200), { key: 'veg1', role: 'veg', preferred: ['06182'], accepts: ['06182'], min: 60, max: 200, step: 10, default: 100 }, veg('veg2', ['06267', '08016', '06153'], 50, 0, 120, true), { key: 'carb', role: 'carb', preferred: ['01063'], accepts: ['01063'], min: 50, max: 110, step: 10, default: 80 }],
    seasonings: [{ foodId: '17027', grams: 2 }, { foodId: '06223', grams: 3 }, { foodId: '14001', grams: 3 }],
    steps: [
      { text: '{carb}を表示時間どおりにゆでる（ゆで湯の塩は使わない）。' },
      { text: 'にんにくはみじん切り、{veg1}はざく切り、{veg2}は食べやすく切る。' },
      { text: 'フライパンにオリーブオイルとにんにくを入れて弱火で香りを出す。' },
      { text: '{protein}と野菜・コンソメ・ゆで汁大さじ2を加えて5分ほど煮る。' },
      { text: '具材に十分に火が通っていることを確認し、ゆで上がった{carb}を加えてからめる。' },
    ],
    points: ['オイルを少量にし、トマトの水分でソースを作る', 'ゆで湯に塩を入れないことで塩分を控えている'],
    heated: true,
  },
  {
    id: 'west-omelet',
    name: '{veg1}入りふわふわオムレツ',
    description: '卵白を加えて脂質を抑えた、朝にうれしいオムレツ。',
    genre: '洋食', methods: ['焼く'], time: 10, difficulty: 'easy', mealTypes: ['朝食', '昼食'],
    slots: [{ key: 'protein', role: 'protein', preferred: ['12014'], accepts: ['12014'], min: 30, max: 120, step: 30, default: 60 }, { key: 'egg', role: 'protein', preferred: [EGG], accepts: [EGG], min: 50, max: 100, step: 50, default: 50 }, veg('veg1', ['06267', '08016', '06182']), veg('veg2', ['06153', '06182'], 30, 0, 80, true), { key: 'carb', role: 'carb', preferred: ['01026'], accepts: ['01026', RICE], min: 0, max: 120, step: 30, default: 60, optional: true }],
    seasonings: [{ foodId: '17012', grams: 0.5 }, { foodId: '14001', grams: 2 }],
    steps: [
      { text: '{veg1}と{veg2}を細かく切る。' },
      { text: '{egg}と{protein}を溶きほぐし、塩を加える。' },
      { text: 'フライパンにオリーブオイルを熱して野菜を炒め、卵液を流し入れる。' },
      { text: '大きく混ぜて半熟になったら形を整え、中まで加熱する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['卵白を合わせることで、ボリュームはそのまま脂質を抑えている'],
    heated: true,
  },
  {
    id: 'west-yogurt',
    name: '{protein}のオーツボウル',
    description: '混ぜるだけ。たんぱく質と食物繊維がとれる朝食・間食。',
    genre: '洋食', methods: ['加熱なし'], time: 5, difficulty: 'easy', mealTypes: ['朝食', '間食'],
    slots: [{ key: 'protein', role: 'dairy', preferred: ['13025', '13033'], accepts: ['13025', '13033'], min: 80, max: 250, step: 10, default: 150 }, { key: 'veg1', role: 'fruit', preferred: ['07107', '07054', '07124', '07148'], min: 0, max: 120, step: 10, default: 60, optional: true }, { key: 'carb', role: 'carb', preferred: ['01004'], accepts: ['01004'], min: 10, max: 50, step: 5, default: 25 }],
    seasonings: [],
    steps: [
      { text: '器に{protein}を入れる。' },
      { text: '{carb}を加えて混ぜ、2〜3分おいてなじませる。', needs: 'carb' },
      { text: '{veg1}を食べやすく切ってのせる。', needs: 'veg1' },
    ],
    points: ['火を使わずに用意できる', '果物の甘みで砂糖を使わない'],
    heated: false,
  },
  {
    id: 'kr-kimchi',
    name: '{protein}とキムチの炒め物',
    description: 'キムチのうま味と辛みで、少ない調味料でも味が決まる。',
    genre: '韓国料理', methods: ['炒める'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([PORK_FILLET, CHICKEN, SQUID], 120), { key: 'veg1', role: 'veg', preferred: ['06236'], accepts: ['06236'], min: 40, max: 120, step: 10, default: 60 }, veg('veg2', ['06291', '06207', '06153'], 60, 0, 150, true), rice()],
    seasonings: [{ foodId: '17007', grams: 3 }, { foodId: '14002', grams: 3 }],
    steps: [
      { text: '{protein}を食べやすく切る。{veg2}も食べやすく切る。' },
      { text: 'フライパンにごま油を熱し、{protein}を中火で炒める。' },
      { text: '色が変わったら{veg1}と{veg2}を加えて炒め合わせる。' },
      { text: 'しょうゆで味を調える。' },
      { text: '{protein}の中心まで十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['キムチのうま味で調味料を最小限にできる', '赤身・低脂質の部位で脂質を抑えている'],
    heated: true,
  },
  {
    id: 'kr-bibimbap',
    name: '{protein}のビビンバ風丼',
    description: '野菜のナムルをたっぷりのせた、彩りのよい丼。',
    genre: '韓国料理', methods: ['電子レンジ', '炒める'], time: 20, difficulty: 'normal', mealTypes: MAIN_MEALS,
    slots: [protein([BEEF, CHICKEN, PORK_FILLET], 100, 50, 200), veg('veg1', ['06291']), veg('veg2', ['06267', '06086'], 50, 0, 120, true), veg('veg3', ['06214'], 30, 0, 80, true), rice(150, false)],
    seasonings: [{ foodId: '17007', grams: 8 }, { foodId: '03003', grams: 2 }, { foodId: '06223', grams: 2 }, { foodId: '14002', grams: 3 }, { foodId: '05018', grams: 2 }],
    steps: [
      { text: '{veg1}・{veg2}・{veg3}をそれぞれ食べやすく切り、耐熱容器に入れてラップをし600Wで2〜3分加熱する。' },
      { text: '水気をしぼり、ごま油の半量・白ごま・しょうゆ少々であえてナムルにする。' },
      { text: '{protein}を細切りにし、にんにく・残りのしょうゆ・砂糖をもみ込む。' },
      { text: 'フライパンに残りのごま油を熱し、{protein}を炒めて中まで十分に火を通す。' },
      { text: '{carb}にナムルと{protein}をのせる。' },
    ],
    points: ['野菜を3種類使い、食物繊維とボリュームを確保している', 'ごま油は香りづけ程度に抑えている'],
    heated: true,
  },
  {
    id: 'kr-sundubu',
    name: '{protein}のスンドゥブ風スープ',
    description: '豆腐たっぷりのピリ辛スープ。体が温まる。',
    genre: '韓国料理', methods: ['煮る'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [{ key: 'protein', role: 'protein', preferred: [SILKEN, TOFU], accepts: [SILKEN, TOFU], min: 100, max: 300, step: 10, default: 150 }, { key: 'meat', role: 'protein', preferred: [SHRIMP, SQUID, CHICKEN], min: 0, max: 120, step: 10, default: 60, optional: true }, { key: 'egg', role: 'protein', preferred: [EGG], accepts: [EGG], min: 0, max: 50, step: 50, default: 50, optional: true }, { key: 'veg1', role: 'veg', preferred: ['06236'], accepts: ['06236'], min: 30, max: 100, step: 10, default: 50 }, veg('veg2', ['06226', '06207', '08001'], 30, 0, 80, true), rice()],
    seasonings: [{ foodId: '17093', grams: 1.5 }, { foodId: '17004', grams: 3 }, { foodId: '17007', grams: 3 }, { foodId: '06223', grams: 2 }],
    steps: [
      { text: '{meat}を食べやすく切る。{veg2}は斜め切りにする。', needs: 'meat' },
      { text: '鍋に水250ml（分量外）・鶏がらスープの素・豆板醤・にんにく・しょうゆを入れて煮立てる。' },
      { text: '{veg1}と{meat}を加えて3〜4分煮る。', needs: 'meat' },
      { text: '{protein}をスプーンで大きくすくって加え、{veg2}も入れて2分ほど煮る。' },
      { text: '{egg}を割り入れ、好みのかたさまで加熱する。', needs: 'egg' },
      { text: '具材に十分に火が通っていることを確認する。' },
      { text: '{carb}を添える。', needs: 'carb' },
    ],
    points: ['豆腐と魚介でたんぱく質を補い、脂質を抑えている', 'スープで満腹感を得やすい'],
    heated: true,
  },
  {
    id: 'eth-gapao',
    name: '{protein}のガパオ風ライス',
    description: 'ナンプラー香るエスニック丼を、低脂質にアレンジ。',
    genre: 'エスニック', methods: ['炒める'], time: 15, difficulty: 'easy', mealTypes: MAIN_MEALS,
    slots: [protein([CHICKEN, PORK_FILLET, SHRIMP], 120), veg('veg1', ['06245', '06247', '06153']), veg('veg2', ['06247', '06153'], 40, 0, 100, true), { key: 'egg', role: 'protein', preferred: [EGG], accepts: [EGG], min: 0, max: 50, step: 50, default: 0, optional: true }, rice(150, false)],
    seasonings: [{ foodId: '17107', grams: 6 }, { foodId: '17031', grams: 4 }, { foodId: '03003', grams: 2 }, { foodId: '06223', grams: 3 }, { foodId: '14006', grams: 3 }],
    steps: [
      { text: '{protein}を粗く刻み、にんにくはみじん切りにする。' },
      { text: '{veg1}と{veg2}を1cm角に切る。' },
      { text: 'フライパンに油とにんにくを入れて熱し、{protein}を炒める。' },
      { text: '野菜を加えて炒め、ナンプラー・オイスターソース・砂糖で味を調える。' },
      { text: '{protein}に十分に火が通っていることを確認する。' },
      { text: '{egg}を目玉焼き（中まで加熱）にする。', needs: 'egg' },
      { text: '{carb}に盛り付ける。' },
    ],
    points: ['ひき肉の代わりに脂質の少ない肉を刻んで使っている', 'ナンプラーの風味で油を控えても満足感がある'],
    heated: true,
  },
  {
    id: 'eth-yum',
    name: '{protein}の春雨エスニックサラダ',
    description: 'ナンプラーとレモンで和える、ヤムウンセン風サラダ。',
    genre: 'エスニック', methods: ['煮る'], time: 15, difficulty: 'easy', mealTypes: ['昼食', '夕食', '間食'],
    slots: [protein([SHRIMP, SQUID, SASAMI], 100, 50, 200), veg('veg1', ['06065', '06182', '06312']), veg('veg2', ['06182', '06153'], 50, 0, 120, true), { key: 'carb', role: 'carb', preferred: ['02039'], accepts: ['02039'], min: 10, max: 40, step: 5, default: 20 }],
    seasonings: [{ foodId: '17107', grams: 6 }, { foodId: '07156', grams: 10 }, { foodId: '03003', grams: 3 }],
    steps: [
      { text: '{carb}を熱湯で表示時間どおりにゆでて水気をきる。' },
      { text: '同じ湯で{protein}をゆで、中心まで十分に火が通っていることを確認して冷ます。' },
      { text: '{veg1}と{veg2}を食べやすく切る。' },
      { text: 'ナンプラー・レモン果汁・砂糖を混ぜ、すべての材料とあえる。' },
    ],
    points: ['油を使わないドレッシングで脂質を抑えている', 'ゆで調理で余分な脂を落としている'],
    heated: true,
  },
  {
    id: 'eth-soup',
    name: '{protein}と春雨のエスニックスープ',
    description: 'レモンとナンプラーの酸味が爽やかな、軽めのスープ。',
    genre: 'エスニック', methods: ['煮る'], time: 15, difficulty: 'easy', mealTypes: ['昼食', '夕食', '間食'],
    slots: [protein([CHICKEN, SHRIMP, SASAMI], 100, 50, 200), veg('veg1', ['06291', '06233', '06061']), veg('veg2', ['06207', '06226', '08001'], 30, 0, 80, true), { key: 'carb', role: 'carb', preferred: ['02039'], accepts: ['02039'], min: 0, max: 40, step: 5, default: 15, optional: true }],
    seasonings: [{ foodId: '17093', grams: 1.5 }, { foodId: '17107', grams: 4 }, { foodId: '07156', grams: 5 }, { foodId: '06103', grams: 3 }],
    steps: [
      { text: '{protein}をそぎ切りにし、しょうがはせん切りにする。' },
      { text: '{veg1}と{veg2}を食べやすく切る。' },
      { text: '鍋に水300ml（分量外）・鶏がらスープの素・しょうがを入れて煮立て、{protein}を入れて5分煮る。' },
      { text: '野菜と{carb}を加えて3分ほど煮る。', needs: 'carb' },
      { text: '{protein}の中心まで十分に火が通っていることを確認し、ナンプラーとレモン果汁で味を調える。' },
    ],
    points: ['油を使わないスープで脂質を抑えている', '春雨で少量でも満足感を出している'],
    heated: true,
  },
]

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]))
