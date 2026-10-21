import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, seedAnswers, stubExternal } from './helpers';

const pages = ['/pelvis/', '/pelvis/check/', '/pelvis/result/', '/pelvis/article/', '/pelvis/reserve/', '/pelvis/reserve/complete/'];

test('ページ内リンク・アンカーにリンク切れがない', async ({ page, request }) => {
  await stubExternal(page);
  await seedAnswers(page);
  const checked = new Set<string>();
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.hostname !== '127.0.0.1') continue;
      if (url.hash) {
        // 同じページ内のアンカーは対応する要素があること
        const target = await page.request.get(url.pathname).then((r) => r.text());
        expect(target, `${href} のアンカー先`).toContain(`id="${url.hash.slice(1)}"`);
      }
      if (checked.has(url.pathname)) continue;
      checked.add(url.pathname);
      const res = await request.get(url.pathname);
      expect(res.status(), `${href}（${path} から）`).toBe(200);
    }
  }
  expect([...checked]).toEqual(expect.arrayContaining(['/pelvis/', '/pelvis/check/', '/pelvis/article/']));
  // リンクされていないページ（広告から直接開く想定のものを含む）も開けること
  for (const path of pages) expect((await request.get(path)).status(), path).toBe(200);
});

test('トップ（/）は /pelvis/ へ移動する', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/pelvis\/$/);
});

test('各ページで表示崩れ（横はみ出し）がなく、ボタンが押しやすい大きさ', async ({ page }, info) => {
  await stubExternal(page);
  await seedAnswers(page);
  for (const path of pages) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
    // 選択肢・主要ボタンの高さ（タップしやすさ）
    const heights = await page
      .locator('main label, main button, main a.rounded-full, a[data-placement]')
      .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect().height));
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: `test-results/screens/${info.project.name}${path.replaceAll('/', '_')}.png`,
      fullPage: true,
    });
  }
});

test('画像は遅延読み込みされる（設定済みの場合）', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/article/');
  const eagerImages = await page.locator('main img[loading="eager"]').count();
  expect(eagerImages).toBe(0);
});
