import { expect, test } from '@playwright/test';
import { createUser, login, logout, type TestUser } from './helpers';

// 権限：ログインしていない人・役割の違う人が、見てはいけない画面に入れないこと

let user: TestUser;
let staffA: TestUser;
let staffB: TestUser;
let admin: TestUser;

test.beforeAll(async () => {
  [user, staffA, staffB, admin] = await Promise.all([
    createUser('user', 'access-user'),
    createUser('staff', 'access-staff-a'),
    createUser('staff', 'access-staff-b'),
    createUser('admin', 'access-admin'),
  ]);
});

test('ログインしていなければ、どの業務画面もログイン画面へ移動する', async ({ page }) => {
  for (const path of ['/me', '/me/analyses', '/staff', '/staff/customers', '/staff/menus', '/admin', '/admin/menus', '/admin/audit-logs']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/login\?next=/);
  }
});

test('ログイン後の移動先に外部のサイトは指定できない', async ({ page }) => {
  await page.goto('/login?next=//evil.example.com');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill('e2e-password-123');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3200\/(me|consent|home)/);
});

test('一般ユーザーはサロン・管理の画面を開けない', async ({ page }) => {
  await login(page, user);
  for (const path of ['/staff', '/staff/customers', '/admin', '/admin/menus']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/forbidden/);
  }
});

test('スタッフは管理の画面とセルフ撮影の画面を開けない', async ({ page }) => {
  await login(page, staffA);
  for (const path of ['/admin', '/admin/menus', '/admin/staff', '/me', '/me/capture']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/forbidden/);
  }
});

test('スタッフは担当でない顧客とその来店を見られない', async ({ page }) => {
  // スタッフA が顧客を登録し、来店を記録する
  await login(page, staffA);
  await page.goto('/staff/customers/new');
  await page.getByLabel('氏名').fill('担当テスト 顧客');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/\/staff\/customers\/[0-9a-f-]{36}\?saved=created/);
  const customerUrl = new URL(page.url()).pathname;
  await page.getByRole('button', { name: '来店を記録する' }).first().click();
  await expect(page).toHaveURL(/\/staff\/visits\/[0-9a-f-]{36}$/);
  const visitUrl = new URL(page.url()).pathname;

  // スタッフB からは見えない（存在するかどうかも分からない）
  await logout(page);
  await login(page, staffB);
  // 読み込み中の表示を先に返すため HTTP の状態は 200 になる。画面の内容で確かめる
  for (const path of [customerUrl, `${customerUrl}/compare`, visitUrl, `${visitUrl}/intake`, `${visitUrl}/print`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'ページが見つかりません' }), path).toBeVisible();
    await expect(page.getByText('担当テスト 顧客'), path).toHaveCount(0);
  }
  await page.goto('/staff/customers');
  await expect(page.getByText('担当テスト 顧客')).toHaveCount(0);

  // 管理者は見られる
  await logout(page);
  await login(page, admin);
  await page.goto(visitUrl);
  await expect(page.getByRole('heading', { name: '来店の記録' })).toBeVisible();
});
