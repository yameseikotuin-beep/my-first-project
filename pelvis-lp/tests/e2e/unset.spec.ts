import { expect, test } from '@playwright/test';
import { seedAnswers, stubExternal } from './helpers';

// 予約URL・GA4・Meta Pixel がすべて未設定の本番ビルド

test('予約URLが未設定なら、どこにも遷移しない', async ({ page }) => {
  await stubExternal(page);
  await seedAnswers(page);
  await page.goto('/pelvis/article/');
  await expect(page.getByTestId('offer-price')).toHaveText('1,980円（税込）');

  const unavailable = page.getByTestId('reserve-unavailable');
  await expect(unavailable).toHaveCount(3); // 記事中・サービス紹介・記事末尾
  await expect(unavailable.first()).toHaveText('オンライン予約は準備中です');
  await expect(page.locator('a[data-placement]')).toHaveCount(0);
  // 画面下の固定ボタンは出さない
  await expect(page.locator('[data-placement="sticky"]')).toHaveCount(0);

  // 押せない状態（aria-disabled）だが、無理に押しても遷移しない
  const before = page.url();
  await unavailable.first().click({ force: true });
  await expect(page).toHaveURL(before);

  // 本番ビルドでは開発用の「未設定」表示は出さない
  await expect(page.getByTestId('dev-notice')).toHaveCount(0);
});

test('予約ページでも未設定なら遷移しない', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/reserve/');
  await expect(page.getByTestId('reserve-unavailable')).toHaveText('オンライン予約は準備中です');
  await expect(page.locator('a[data-placement]')).toHaveCount(0);
});

test('GA4・Meta Pixel が未設定なら読み込まない', async ({ page }) => {
  const external = await stubExternal(page);
  await page.goto('/pelvis/');
  await page.getByRole('link', { name: 'セルフチェックを始める' }).click();
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
  const globals = await page.evaluate(() => ({
    gtag: typeof (window as unknown as { gtag?: unknown }).gtag,
    fbq: typeof (window as unknown as { fbq?: unknown }).fbq,
  }));
  expect(globals).toEqual({ gtag: 'undefined', fbq: 'undefined' });
});
