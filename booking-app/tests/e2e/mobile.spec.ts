import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, login, resetData, serviceId, sqlAsAnon, testMonday } from './helpers';

// 管理画面をスマートフォンの画面サイズで表示しても、横にはみ出さず操作できること

test.beforeEach(async () => {
  await resetData();
});

test('管理画面の各ページがスマートフォンで横にはみ出さない', async ({ page }) => {
  const monday = await testMonday();
  await sqlAsAnon(
    `select * from public.create_booking($1, ($2::date + time '10:00') at time zone 'Asia/Tokyo', 'スマホ 確認', '09012121212')`,
    [await serviceId('肩こり整体'), monday],
  );
  await login(page);
  for (const path of [
    '/admin',
    `/admin/bookings?from=${monday}`,
    '/admin/bookings/new',
    `/admin/calendar?date=${monday}`,
    `/admin/calendar?view=week&date=${monday}`,
    '/admin/services',
    '/admin/services/new',
    '/admin/rooms',
    '/admin/practitioners',
    '/admin/hours',
    '/admin/settings',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  // 予約の詳細も開ける
  await page.goto(`/admin/bookings?from=${monday}`);
  await page.getByRole('link', { name: /スマホ 確認/ }).click();
  await expect(page.getByRole('heading', { name: '予約の詳細' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  // ボタンが押しやすい大きさ（高さ 40px 以上）
  const box = await page.getByRole('button', { name: '変更を保存する' }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(40);
});
