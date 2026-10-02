/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'

/** ページ内の JavaScript エラーを集め、テストの最後に無いことを確認する */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

async function fillPfc(page: Page, values: (string | null)[]) {
  const inputs = page.locator('.card:has-text("PFC目標") input[type=number]')
  for (let i = 0; i < values.length; i++) if (values[i] !== null) await inputs.nth(i).fill(values[i]!)
}

const kcalOf = async (page: Page) => Number((await page.locator('.kcal-big').first().textContent())!.replace(/[^\d]/g, ''))

test('テスト1: カロリー指定で条件を満たすレシピを生成し、詳細で条件達成を確認できる', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./')
  await page.getByRole('link', { name: /カロリーからレシピを考える/ }).click()
  await page.locator('input[type=number]').first().fill('400')
  await fillPfc(page, ['35', '10'])
  await page.getByRole('radio', { name: '和食' }).click()
  await page.getByRole('radio', { name: '20分' }).click()
  await page.getByRole('button', { name: 'レシピを考える' }).click()

  await expect(page.getByRole('heading', { name: 'レシピ候補' })).toBeVisible()
  const cards = page.locator('.recipe-card')
  expect(await cards.count()).toBeGreaterThanOrEqual(3)
  await cards.first().click()
  await expect(page.getByText('目標値との比較')).toBeVisible()
  expect(await kcalOf(page)).toBeLessThanOrEqual(400)
  await expect(page.locator('.badge.ok').first()).toHaveText('条件達成')
  expect(errors).toEqual([])
})

test('レシピの調整・人数変更・保存・お気に入り・置き換え・検索', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/calorie')
  await page.locator('input[type=number]').first().fill('500')
  await page.getByRole('button', { name: 'レシピを考える' }).click()
  await page.locator('.recipe-card').first().click()
  const before = await kcalOf(page)

  await page.getByRole('button', { name: 'カロリー -100kcal' }).click()
  await expect(page.locator('.banner.info').first()).toContainText('再計算しました')
  expect(await kcalOf(page)).toBeLessThanOrEqual(before - 100)

  await page.locator('select').filter({ hasText: '1人前' }).selectOption('2')
  await expect(page.getByText('2人前の合計')).toBeVisible()

  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByRole('button', { name: /お気に入り/ }).click()
  const name = (await page.locator('h1').first().textContent())!.trim()

  await page.getByRole('button', { name: '置き換え' }).first().click()
  await page.locator('.banner.info button:has-text("置き換える"):not([disabled])').first().click()
  await expect(page.locator('.banner.info').first()).toContainText('再計算しました')

  await page.goto('./#/saved?tab=favorites')
  await expect(page.locator('.recipe-card h3')).toHaveText([name])
  await page.getByText('検索・絞り込み').click()
  await page.getByPlaceholder('料理名').fill('存在しない料理名')
  await expect(page.getByText('条件に合うレシピがありません')).toBeVisible()
  expect(errors).toEqual([])
})

test('テスト3: 実現できない条件では生成せず、理由と調整案を示す', async ({ page }) => {
  await page.goto('./#/calorie')
  await page.locator('input[type=number]').first().fill('100')
  await fillPfc(page, ['50', '0'])
  await page.getByRole('radio', { name: '間食' }).click()
  await page.getByRole('button', { name: 'レシピを考える' }).click()
  const banner = page.locator('.banner.failed')
  await expect(banner).toContainText('この条件ではレシピを作成できません')
  await expect(banner).toContainText(/カロリー上限を\d+kcal以上/)
  await expect(page.locator('.recipe-card')).toHaveCount(0)
})

test('テスト2・4: 食材指定と、成分データにない食材の扱い', async ({ page }) => {
  await page.goto('./#/ingredients')
  const input = page.locator('input[type=text]').first()
  for (const f of ['鶏むね肉', 'キャベツ', '玉ねぎ', '卵', 'ドラゴンフルーツ']) {
    await input.fill(f)
    await input.press('Enter')
  }
  await expect(page.getByText('食品成分データに見つからない食材があります')).toBeVisible()
  await page.getByRole('button', { name: 'レシピを考える' }).click()
  await expect(page.getByRole('heading', { name: 'レシピ候補' })).toBeVisible()
  await expect(page.locator('.banner.warn').first()).toContainText('ドラゴンフルーツ')
  const names = await page.locator('.recipe-card h3').allTextContents()
  expect(names.length).toBeGreaterThanOrEqual(3)
  expect(names.some((n) => n.includes('鶏むね肉'))).toBe(true)
})

test('利用者の目標設定 → 食事プラン → 在庫 → 買い物リスト', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('./#/profiles')
  await page.getByRole('button', { name: '＋ 利用者を追加' }).click()
  await page.locator('label:has-text("氏名") input').fill('はなこ')
  await page.locator('label:has-text("年齢") input').fill('35')
  await page.locator('label:has-text("身長") input').fill('160')
  await page.locator('label:has-text("現在体重") input').fill('62')
  await page.locator('label:has-text("目標体重") input').fill('56')
  await page.locator('label:has-text("性別") select').selectOption('female')
  await expect(page.locator('.kcal-big')).toContainText('kcal/日')
  await page.getByRole('button', { name: '保存して目標に設定' }).click()
  await expect(page.locator('header select')).toHaveValue(/.+/)

  await page.goto('./#/plan')
  await page.getByRole('button', { name: '食事プランを作る' }).click()
  await expect(page.getByText('1日の合計と目標の比較')).toBeVisible()
  // 達成率がすべて90〜110%（範囲外は赤で表示される）
  const rates = await page.locator('.compare tbody tr td:nth-child(4)').allTextContents()
  for (const r of rates) {
    const n = Number(r.replace('%', ''))
    expect(n).toBeGreaterThanOrEqual(90)
    expect(n).toBeLessThanOrEqual(110)
  }
  await page.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('button', { name: 'この食事プランで買い物リストを作る' })).toBeVisible()

  await page.goto('./#/inventory')
  await page.locator('label:has-text("食材名") input').fill('卵')
  await page.locator('label:has-text("保有量") input').fill('2')
  await page.locator('label:has-text("単位") select').selectOption('個')
  await page.getByRole('button', { name: '登録' }).click()

  await page.goto('./#/shopping')
  await page.locator('input[type=checkbox]').first().check()
  await page.getByRole('button', { name: '買い物リストを作る' }).click()
  await expect(page.locator('.shop-item').first()).toBeVisible()
  const first = page.locator('.shop-item input[type=checkbox]').first()
  await first.check()
  await expect(first).toBeChecked()
  expect(errors).toEqual([])
})

test('クラウド未設定でもアカウント画面は案内を表示し、AIの選択肢は出さない', async ({ page }) => {
  await page.goto('./#/account')
  await expect(page.getByText('クラウド機能は設定されていません')).toBeVisible()
  await page.goto('./#/calorie')
  await expect(page.getByRole('radio', { name: 'AIが自由に考案' })).toHaveCount(0)
})

test('スマートフォン幅で横スクロールが発生しない', async ({ page }) => {
  for (const p of ['', 'calorie', 'ingredients', 'saved', 'plan', 'shopping', 'inventory', 'profiles', 'settings', 'foods', 'account']) {
    await page.goto(`./#/${p}`)
    await page.waitForLoadState('networkidle')
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(scroll, `#/${p}`).toBeLessThanOrEqual(width)
  }
})
