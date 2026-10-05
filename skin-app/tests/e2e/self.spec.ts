import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PASSWORD, createUser, login, userExists, type TestUser } from './helpers';

// 一般ユーザー：同意 → 撮影 → 分析 → セルフケア → 退会

const photo = path.resolve('tests/e2e/fixtures/face.jpg');
let user: TestUser;

test.beforeAll(async () => {
  user = await createUser('user', 'self-user');
});

test('一般ユーザー：撮影から退会まで', async ({ page }) => {
  await login(page, user);

  // 同意しないと撮影できない
  await page.goto('/me/capture');
  await expect(page.getByRole('link', { name: /同意/ }).first()).toBeVisible();
  await page.goto('/consent');
  // 読み込み中の表示が消えてから、すべての同意のチェックを入れる
  await expect(page.getByRole('button', { name: '同意内容を保存する' })).toBeVisible();
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await page.getByRole('button', { name: '同意内容を保存する' }).click();
  await expect(page).not.toHaveURL(/\/consent/);

  // 写真を選んで保存
  await page.goto('/me/capture');
  await page.getByRole('button', { name: '写真を選ぶ' }).click();
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('button', { name: /この写真を使う/ }).click();
  await page.getByRole('button', { name: '左側の撮影を省略する' }).click();
  await page.getByRole('button', { name: '右側の撮影を省略する' }).click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.getByText('写真を保存しました')).toBeVisible({ timeout: 20_000 });

  // 分析（AI なし）。仮の分析であることが表示される
  await page.getByRole('link', { name: /分析/ }).first().click();
  await page.getByRole('button', { name: 'AI に送らずに分析する' }).click();
  await expect(page).toHaveURL(/\/me\/analyses\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByText(/モック|仮の分析/).first()).toBeVisible();
  await expect(page.getByText(/診断/).first()).toBeVisible();

  // セルフケアの記録
  await page.goto('/me/care');
  await page.getByLabel('保湿').check();
  await page.getByLabel('メモ').fill('E2E の記録');
  await page.getByRole('button', { name: '記録する' }).click();
  await expect(page.getByText(/の記録を保存しました/)).toBeVisible();

  // 退会（パスワードの再入力と確認の文字が必要）
  await page.goto('/me/settings');
  await page.getByLabel('パスワード（本人確認のため）').fill(PASSWORD);
  await page.getByLabel('確認のため「退会する」と入力してください').fill('退会する');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: /退会/ }).last().click();
  await expect(page).toHaveURL(/\/\?account=deleted/, { timeout: 30_000 });
  expect(await userExists(user.id)).toBe(false);

  // 退会後はログインできない
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/login/);
});
