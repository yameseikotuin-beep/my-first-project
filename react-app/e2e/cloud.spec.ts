/// <reference lib="dom" />
import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * クラウド機能（ログイン・同期・AIレシピ・料理画像）の画面操作のテスト。
 * Supabase・AI・画像生成の通信はすべてここで模擬し、実際のサービスは呼ばない。
 */

const SB = 'http://supabase.test'
const USER_ID = '11111111-2222-4333-8444-555555555555'
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600
const ACCESS_TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp, email: 'test@example.com' })}.sig`
// 1x1 の PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

const aiResponse = {
  recipes: [
    {
      recipe_name: '鶏むね肉と小松菜の生姜あんかけ',
      description: 'しょうがの香るあんで食べる、さっぱりした主菜。',
      genre: '和食', method: '煮る', cooking_time_minutes: 20, difficulty: 'easy',
      ingredients: [
        { food_id: '11220', amount_g: 150, role: 'main' },
        { food_id: '06086', amount_g: 80, role: 'side' },
        { food_id: '08016', amount_g: 50, role: 'side' },
        { food_id: '01088', amount_g: 120, role: 'carb' },
        { food_id: '17007', amount_g: 8, role: 'seasoning' },
        { food_id: '16025', amount_g: 6, role: 'seasoning' },
        { food_id: '02034', amount_g: 4, role: 'seasoning' },
      ],
      steps: ['鶏むね肉をそぎ切りにする。', '野菜を切る。', '煮て、中心まで十分に火が通っていることを確認する。'],
      points: ['皮なしのむね肉で脂質を抑えている'],
    },
  ],
  dropped: [],
}

interface MockState {
  pushed: { collection: string; record_id: string }[]
  aiCalls: number
  aiFail: number | null
  imageCalls: number
}

async function mockSupabase(page: Page): Promise<MockState> {
  const state: MockState = { pushed: [], aiCalls: 0, aiFail: null, imageCalls: 0 }
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/auth/v1/token') {
      const body = req.postDataJSON() as { password?: string }
      if (body.password !== 'correct-password') return json(route, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
      return json(route, {
        access_token: ACCESS_TOKEN, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'refresh',
        user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
      })
    }
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: cors })
    if (url.pathname === '/rest/v1/sync_records') return json(route, [])
    if (url.pathname === '/rest/v1/rpc/push_sync_records') {
      const { records } = req.postDataJSON() as { records: { collection: string; record_id: string }[] }
      state.pushed.push(...records)
      return json(route, records.length)
    }
    if (url.pathname === '/functions/v1/generate-recipe') {
      state.aiCalls++
      if (state.aiFail) return json(route, { error: '1日の利用上限（AIレシピ 30回）に達しました。明日また利用してください。' }, state.aiFail)
      const body = req.postDataJSON() as { targets: { maxCalories: number }; count: number }
      expect(body.targets.maxCalories).toBe(500)
      expect(body.count).toBe(3)
      expect(req.headers()['authorization']).toBe(`Bearer ${ACCESS_TOKEN}`)
      return json(route, aiResponse)
    }
    if (url.pathname === '/functions/v1/generate-image') {
      state.imageCalls++
      const body = req.postDataJSON() as { recipeId: string }
      return json(route, { path: `${USER_ID}/${body.recipeId}.png` })
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/recipe-images/') && req.method() === 'POST') {
      const path = url.pathname.replace('/storage/v1/object/sign/', '')
      return json(route, { signedURL: `/object/sign/${path}?token=t` })
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/')) return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'image/png' }, body: PNG })
    return json(route, { error: `unmocked ${req.method()} ${url.pathname}` }, 404)
  })
  return state
}

async function login(page: Page) {
  await page.goto('./#/account')
  await page.locator('label:has-text("メールアドレス") input').fill('test@example.com')
  await page.locator('label:has-text("パスワード") input').fill('correct-password')
  await page.getByRole('button', { name: 'ログイン', exact: true }).last().click()
  await expect(page.getByText('ログイン中')).toBeVisible()
}

test('ログイン失敗・成功と、変更のクラウド同期', async ({ page }) => {
  const state = await mockSupabase(page)
  await page.goto('./#/account')
  await page.locator('label:has-text("メールアドレス") input').fill('test@example.com')
  await page.locator('label:has-text("パスワード") input').fill('wrong-password')
  await page.getByRole('button', { name: 'ログイン', exact: true }).last().click()
  await expect(page.getByText('メールアドレスまたはパスワードが正しくありません。')).toBeVisible()

  await login(page)
  await expect(page.locator('.header-account .badge')).toHaveText('同期済み')
  // ログイン中のヘッダー（同期状態の表示つき）でもスマートフォン幅に収まる
  for (const p of ['', 'calorie', 'account']) {
    await page.goto(`./#/${p}`)
    const [scroll, width] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
    expect(scroll, `#/${p}`).toBeLessThanOrEqual(width)
  }
  await page.screenshot({ path: 'test-results/cloud-header.png' })

  // レシピを保存すると同期で送信される
  await page.goto('./#/calorie')
  await page.getByRole('button', { name: 'レシピを考える' }).click()
  await page.locator('.recipe-card').first().click()
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => state.pushed.filter((r) => r.collection === 'recipes').length, { timeout: 10_000 }).toBeGreaterThan(0)
  await expect(page.locator('.header-account .badge')).toHaveText('同期済み')
})

test('AIによるレシピ考案: 結果はアプリが計算・検証し、AI考案と表示する', async ({ page }) => {
  const state = await mockSupabase(page)
  // ログイン前は AI を選ぶとログインを促す
  await page.goto('./#/calorie')
  await page.getByRole('radio', { name: 'AIが自由に考案' }).click()
  await expect(page.getByRole('button', { name: 'AIにレシピを考えてもらう' })).toBeDisabled()

  await login(page)
  await page.goto('./#/calorie')
  await page.locator('input[type=number]').first().fill('500')
  await page.getByRole('radio', { name: 'AIが自由に考案' }).click()
  await page.getByPlaceholder('例: さっぱりした味').fill('さっぱり')
  await page.getByRole('button', { name: 'AIにレシピを考えてもらう' }).click()

  await expect(page.getByRole('heading', { name: 'レシピ候補' })).toBeVisible()
  await expect(page.locator('.recipe-card h3')).toHaveText(['鶏むね肉と小松菜の生姜あんかけ'])
  await expect(page.locator('.recipe-card .badge.info')).toHaveText('AI考案')
  await page.locator('.recipe-card').first().click()
  expect(Number((await page.locator('.kcal-big').textContent())!.replace(/[^\d]/g, ''))).toBeLessThanOrEqual(500)
  await expect(page.getByText('料理の構成（食材・手順）はAIが考案し')).toBeVisible()
  expect(state.aiCalls).toBe(1)
})

test('AIの利用上限などのエラーは内容を表示し、再試行できる', async ({ page }) => {
  const state = await mockSupabase(page)
  await login(page)
  state.aiFail = 429
  await page.goto('./#/calorie')
  await page.locator('input[type=number]').first().fill('500')
  await page.getByRole('radio', { name: 'AIが自由に考案' }).click()
  await page.getByRole('button', { name: 'AIにレシピを考えてもらう' }).click()
  await expect(page.locator('.banner.error')).toContainText('1日の利用上限')
  state.aiFail = null
  await page.getByRole('button', { name: '再試行' }).click()
  await expect(page.getByRole('heading', { name: 'レシピ候補' })).toBeVisible()
})

test('料理写真風の画像を生成して表示する', async ({ page }) => {
  const state = await mockSupabase(page)
  await login(page)
  await page.goto('./#/calorie')
  await page.getByRole('button', { name: 'レシピを考える' }).click()
  await page.locator('.recipe-card').first().click()
  await expect(page.locator('svg[aria-label$="のイメージ図"]').first()).toBeVisible()
  await page.getByRole('button', { name: '📷 画像を生成' }).click()
  await expect(page.locator('img[alt$="のAI生成イメージ"]')).toBeVisible()
  await expect(page.getByText('AIが作ったイメージのため')).toBeVisible()
  expect(state.imageCalls).toBe(1)
  await expect(page.getByRole('button', { name: '画像を作り直す' })).toBeVisible()
})
