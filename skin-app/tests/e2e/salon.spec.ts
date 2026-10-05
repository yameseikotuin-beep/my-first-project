import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { createUser, login, logout, uniq, type TestUser } from './helpers';

// サロンの1回の来店を、メニュー登録から印刷まで通して確認する

const photo = path.resolve('tests/e2e/fixtures/face.jpg');
let staff: TestUser;
let admin: TestUser;
const menuName = uniq('フェイシャルE2E');

test.beforeAll(async () => {
  [staff, admin] = await Promise.all([createUser('staff', 'salon-staff'), createUser('admin', 'salon-admin')]);
});

async function uploadFrontPhoto(page: Page) {
  await page.getByRole('button', { name: '写真を選ぶ' }).click();
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('button', { name: /この写真を使う/ }).click();
  await page.getByRole('button', { name: '左側の撮影を省略する' }).click();
  await page.getByRole('button', { name: '右側の撮影を省略する' }).click();
  await page.getByRole('button', { name: '保存する', exact: true }).click();
  await expect(page.getByText('写真を保存しました')).toBeVisible({ timeout: 20_000 });
}

test('管理者：効果を約束する説明は保存できず、通常のメニューは登録できる', async ({ page }) => {
  await login(page, admin);
  await page.goto('/admin/menus/new');
  await page.getByLabel('メニュー名').fill(menuName);
  await page.getByLabel('料金（円・税込）').fill('8800');
  await page.getByLabel('所要時間（分）').fill('60');
  await page.getByLabel('説明').fill('必ず毛穴が消えます。');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.getByText('効果の断定や医療的な表現')).toBeVisible();

  await page.getByLabel('説明').fill('肌を整えるお手入れです。');
  await page.getByLabel('注意事項').fill('施術後は日焼けにご注意ください');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page).toHaveURL(/\/admin\/menus\?saved=created/);
  await expect(page.getByText(menuName)).toBeVisible();
});

test('スタッフ：来店を最初から最後まで記録できる', async ({ page }) => {
  await login(page, staff);

  // 顧客の登録と同意
  await page.goto('/staff/customers/new');
  await page.getByLabel('氏名').fill('来店 花子');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page).toHaveURL(/saved=created/);
  const customerPath = new URL(page.url()).pathname;
  await page.goto(`${customerPath}/consent`);
  // 本人確認のチェックを忘れると保存できないが、入れたチェックは消えない
  await expect(page.getByRole('button', { name: '同意内容を保存する' })).toBeVisible();
  const items = page.getByRole('checkbox', { name: 'お客さまが内容を確認し、同意しました' });
  for (const box of await items.all()) await box.check();
  await page.getByRole('button', { name: '同意内容を保存する' }).click();
  await expect(page.getByText('お客さまご本人による確認が必要です')).toBeVisible();
  await expect(items.first()).toBeChecked();
  await page.getByRole('checkbox', { name: /お客さまご本人がこの画面で/ }).check();
  await page.getByRole('button', { name: '同意内容を保存する' }).click();
  await expect(page.getByText('同意を記録しました')).toBeVisible();

  // 来店を開始
  await page.getByRole('button', { name: '来店を記録する' }).first().click();
  await expect(page).toHaveURL(/\/staff\/visits\/[0-9a-f-]{36}$/);
  const visitPath = new URL(page.url()).pathname;

  // 1. 問診（通院中 → 医師への確認の案内が出る）
  await page.getByRole('link', { name: '問診をする' }).click();
  await page.getByLabel('毛穴').check();
  await page.getByRole('group', { name: /ふだんの肌の感じ方/ }).getByLabel('乾燥しやすい').check();
  await page.getByRole('group', { name: /肌に合わなかった/ }).getByLabel('いいえ').check();
  await page.getByRole('group', { name: /2週間/ }).getByLabel('いいえ').check();
  await page.getByRole('group', { name: /通院・治療中/ }).getByLabel('はい').check();
  await page.getByLabel('ご希望').fill('しっとりした仕上がりにしたい');
  await page.getByRole('button', { name: '保存して来店の記録に戻る' }).click();
  await expect(page.getByText('問診を保存しました')).toBeVisible();
  await expect(page.getByText('施術の前に、医師への確認をおすすめしてください')).toBeVisible();

  // 2. 来店時の撮影（来店にひも付く）と分析
  await page.getByRole('link', { name: '撮影する', exact: true }).click();
  await expect(page.getByText('（来店時の撮影）')).toBeVisible();
  await uploadFrontPhoto(page);
  await page.goto(visitPath);
  await page.getByRole('link', { name: 'この撮影で分析する' }).click();
  await page.getByRole('button', { name: 'AI に送らずに分析する' }).click();
  await expect(page).toHaveURL(/\/analyses\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.goto(visitPath);
  await expect(page.getByRole('link', { name: '分析結果を見る' })).toBeVisible();

  // 3. カウンセリング（問診の内容が初期値に入る）
  await page.getByRole('link', { name: '記入する' }).click();
  await expect(page.getByLabel('お悩み')).toHaveValue('毛穴');
  await expect(page.getByLabel('お客さまのご希望')).toHaveValue('しっとりした仕上がりにしたい');
  await page.getByLabel('ご提案').fill('確実に若返ります');
  await page.getByLabel('スタッフのメモ').fill('社内メモ：印刷に出ないこと');
  await page.getByRole('button', { name: '保存して来店の記録に戻る' }).click();
  await expect(page.getByText('効果の断定や医療的な表現')).toBeVisible();
  await page.getByLabel('ご提案').fill('保湿中心のメニューをご提案しました');
  await page.getByRole('button', { name: '保存して来店の記録に戻る' }).click();
  await expect(page.getByText('カウンセリングシートを保存しました')).toBeVisible();

  // 4. 施術案内：下書き → 承認
  await page.getByRole('link', { name: '案内文を作る' }).click();
  await page.getByLabel(new RegExp(menuName)).check();
  await page.getByRole('button', { name: '下書きを作る' }).click();
  await expect(page.getByText('下書きを作りました')).toBeVisible();
  const draft = page.getByLabel('案内文');
  await expect(draft).toContainText(`■ ${menuName}　8,800円（税込）・約60分`);
  await expect(draft).toContainText('かかりつけの医師にご確認ください');
  await page.getByRole('button', { name: '確認して承認する' }).click();
  await expect(page.getByText('案内文を承認しました')).toBeVisible();
  await expect(page.getByRole('button', { name: '承認を取り消して編集する' })).toBeVisible();

  // 5. 施術の記録と次回メモ
  await page.goto(`${visitPath}/treatment`);
  await page.getByRole('combobox', { name: /^メニュー/ }).selectOption({ label: `${menuName}（8,800円）` });
  await page.getByRole('textbox', { name: /^メモ/ }).fill('保湿パックを使用');
  await page.getByRole('button', { name: '施術を記録する' }).click();
  await expect(page.getByText('施術を記録しました')).toBeVisible();
  await expect(page.getByText('合計（施術時点の料金）')).toBeVisible();
  await page.getByLabel('次回来店メモ').fill('3週間後に保湿の相談');
  await page.getByRole('button', { name: 'メモを保存する' }).click();
  await expect(page.getByText('次回来店メモを保存しました')).toBeVisible();

  // 完了と印刷用の画面（スタッフのメモは載らない）
  await page.goto(visitPath);
  await expect(page.getByText('記入済み', { exact: true })).toHaveCount(5);
  await page.getByRole('button', { name: '来店を完了にする' }).click();
  await expect(page.getByText('完了した来店')).toBeVisible();
  await page.goto(`${visitPath}/print`);
  await expect(page.getByRole('heading', { name: /来店 花子 様\s*カウンセリングシート/ })).toBeVisible();
  await expect(page.getByText('保湿中心のメニューをご提案しました')).toBeVisible();
  await expect(page.getByText('8,800円').first()).toBeVisible();
  await expect(page.getByText('社内メモ：印刷に出ないこと')).toHaveCount(0);

  // ダッシュボードに次回来店メモ
  await page.goto('/staff');
  await expect(page.getByText('3週間後に保湿の相談')).toBeVisible();

  // 実測値（AI の推定とは別）
  await page.goto(`${customerPath}?tab=measurements`);
  await expect(page.getByText('測定機器で測った値です')).toBeVisible();
  await page.getByLabel('測定機器').fill('肌水分計E2E');
  await page.getByLabel('項目').fill('水分（ほお）');
  await page.getByLabel('値').fill('42.5');
  await page.getByLabel('単位').fill('%');
  await page.getByRole('button', { name: '実測値を記録する' }).click();
  await expect(page.getByText('水分（ほお） を記録しました')).toBeVisible();
  await expect(page.getByRole('cell', { name: '42.5%' })).toBeVisible();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: '削除' }).click();
  await expect(page.getByText('まだ実測値の記録がありません。')).toBeVisible();

  // 管理者の利用状況に来店が数えられる
  await logout(page);
  await login(page, admin);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /利用状況/ })).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(staff.name) });
  await expect(row.getByRole('cell').nth(1)).toHaveText('1');
});
