import { expect, test } from '@playwright/test';
import { TEST_RESERVATION_URL } from '../../playwright.config';
import { answerSurvey, count, expectNoHorizontalOverflow, expectNoSensitive, ga4Events, pixelCalls, stubExternal } from './helpers';

test('アンケート → 結果 → 記事 → オファー → 予約ページ（計測・プライバシーも確認）', async ({ page }) => {
  const external = await stubExternal(page);
  const visited: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) visited.push(f.url());
  });

  // ページ1：ファーストビュー
  await page.goto('/pelvis/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('気になっていること');
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: 'セルフチェックを始める' }).click();

  // ページ2：アンケート
  const progress = page.getByTestId('progress-text');
  const next = page.getByRole('button', { name: '次へ' });
  const back = page.getByRole('button', { name: '戻る' });
  await expect(progress).toHaveText('質問 1 / 5');

  // 必須未回答では進めない
  await next.click();
  await expect(page.locator('#survey-error')).toHaveText('当てはまるものを1つ以上選んでください。');
  await expect(progress).toHaveText('質問 1 / 5');

  // 複数回答
  await page.getByText('反り腰が気になる', { exact: true }).click();
  await page.getByText('下腹部の見た目が気になる', { exact: true }).click();
  await expect(page.locator('#survey-error')).toHaveText('');
  await expect(page.getByRole('checkbox', { name: '反り腰が気になる' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '猫背が気になる' })).not.toBeChecked();
  await next.click();

  await expect(progress).toHaveText('質問 2 / 5');
  await page.getByText('横から見たときの体型が気になる', { exact: true }).click();

  // 戻る操作で回答を保持
  await back.click();
  await expect(progress).toHaveText('質問 1 / 5');
  await expect(page.getByRole('checkbox', { name: '反り腰が気になる' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: '下腹部の見た目が気になる' })).toBeChecked();
  await next.click();
  await expect(page.getByRole('checkbox', { name: '横から見たときの体型が気になる' })).toBeChecked();
  await next.click();

  // 単一回答の必須
  await expect(progress).toHaveText('質問 3 / 5');
  await next.click();
  await expect(page.locator('#survey-error')).toHaveText('当てはまるものを1つ選んでください。');
  await page.getByText('最近（1か月以内）', { exact: true }).click();
  await page.getByText('1年以上前から', { exact: true }).click();
  await expect(page.getByRole('radio', { name: '1年以上前から' })).toBeChecked();
  await expect(page.getByRole('radio', { name: '最近（1か月以内）' })).not.toBeChecked();
  await next.click();

  await expect(progress).toHaveText('質問 4 / 5');
  await page.getByText('整体で何をするのか', { exact: true }).click();
  await next.click();

  // Q5 は任意。最終質問には「結果を見る」
  await expect(progress).toHaveText('質問 5 / 5');
  await expect(page.getByRole('button', { name: '次へ' })).toHaveCount(0);
  await page.getByRole('button', { name: '結果を見る' }).click();

  // ページ3：結果
  await expect(page).toHaveURL(/\/pelvis\/result\/$/);
  await expect(page.getByTestId('main-theme')).toHaveText('体型の見え方に関する関心');
  await expect(page.getByText('ほかに選ばれたテーマ：反り腰・骨盤の傾きに関する関心')).toBeVisible();
  const selected = page.getByTestId('selected-list').getByRole('listitem');
  await expect(selected).toHaveText([/反り腰が気になる/, /下腹部の見た目が気になる/, /横から見たときの体型が気になる/]);
  await expect(page.getByText('医学的な診断ではありません').first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // ページ4：記事
  await page.getByRole('link', { name: '記事を読む' }).click();
  await expect(page).toHaveURL(/\/pelvis\/article\/$/);
  await expect(page.getByTestId('article-intro')).toHaveAttribute('data-theme', 'bodyShape');
  await expect(page.getByTestId('article-title')).toHaveText('体型の見え方が気になる方へ｜骨盤と姿勢の基礎知識');
  for (const title of ['骨盤と姿勢に関する基礎知識', '姿勢を確認する際のポイント', '自己判断の限界と、専門家による評価', '来店から施術までの流れ', '初回料金のご案内', 'よくある質問']) {
    await expect(page.getByRole('heading', { name: title, level: 2 })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);

  // ページ5：オファー
  const price = page.getByTestId('offer-price');
  await price.scrollIntoViewIfNeeded();
  await expect(price).toHaveText('1,980円（税込）');
  await expect.poll(async () => count(await ga4Events(page), 'offer_view')).toBe(1);
  await expect(page.getByText('通常価格')).toHaveCount(0);

  // ページ6：予約導線（記事中・サービス紹介・記事末尾・画面下）
  for (const placement of ['article_middle', 'service', 'article_end', 'sticky']) {
    await expect(page.locator(`a[data-placement="${placement}"]`)).toHaveAttribute('href', TEST_RESERVATION_URL);
  }

  // 連打しても予約クリックは 1 回（遷移はこのボタンだけ止めて計測を確認する）
  const middle = page.locator('a[data-placement="article_middle"]');
  await middle.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
  await middle.scrollIntoViewIfNeeded();
  await middle.click();
  await middle.click();

  const events = await ga4Events(page);
  for (const name of ['lp_view', 'survey_start', 'survey_complete', 'result_view', 'article_view', 'offer_view']) {
    expect(count(events, name), name).toBe(1);
  }
  expect(events.filter((e) => e.name === 'reserve_click')).toEqual([{ name: 'reserve_click', params: { placement: 'article_middle' } }]);
  expect(count(events, 'reserve_complete')).toBe(0);
  for (const e of events) expect(Object.keys(e.params).every((k) => k === 'placement')).toBe(true);

  const pixel = await pixelCalls(page);
  expect(pixel.filter((c) => c[0] === 'init')).toEqual([['init', '1234567890']]);
  expect(pixel.filter((c) => c[1] === 'PageView')).toHaveLength(1);
  expect(pixel.filter((c) => c[1] === 'ReserveClick')).toEqual([['trackCustom', 'ReserveClick', { placement: 'article_middle' }]]);
  expect(pixel.filter((c) => c[1] === 'Schedule')).toHaveLength(0);

  // 健康情報（回答・テーマ）がイベント・URL・外部通信に含まれない
  expectNoSensitive(events);
  expectNoSensitive(pixel);
  expectNoSensitive(visited);
  expect(visited.every((u) => !new URL(u).search)).toBe(true);

  // 実際に予約ページへ移動する
  const end = page.locator('a[data-placement="article_end"]');
  await end.scrollIntoViewIfNeeded();
  await end.click();
  await expect(page).toHaveURL(TEST_RESERVATION_URL);
  await expect(page.getByRole('heading', { name: 'テスト用の予約ページ' })).toBeVisible();
  expectNoSensitive(external);
});

test('ブラウザの戻る操作でも回答が残っている', async ({ page }) => {
  await stubExternal(page);
  await answerSurvey(page, { concern: ['猫背が気になる'], scene: ['デスクワークやスマホで背中が丸くなる'] });
  await page.goBack();
  await expect(page).toHaveURL(/\/pelvis\/check\/$/);
  await expect(page.getByTestId('progress-text')).toHaveText('質問 5 / 5');
  await page.getByRole('button', { name: '戻る' }).click();
  await page.getByRole('button', { name: '戻る' }).click();
  await page.getByRole('button', { name: '戻る' }).click();
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(page.getByRole('checkbox', { name: '猫背が気になる' })).toBeChecked();
});

test('ページを再読み込みしても回答と結果が残る', async ({ page }) => {
  await stubExternal(page);
  await answerSurvey(page, { concern: ['腰まわりの違和感が気になる'], scene: ['長く座った後、腰まわりが気になる'] });
  await page.reload();
  await expect(page.getByTestId('main-theme')).toHaveText('腰まわりの違和感に関する関心');
});

test('未回答で結果画面を開くと、アンケートへ案内する', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/result/');
  await expect(page.getByRole('heading', { name: 'まだ結果がありません' })).toBeVisible();
  await page.getByRole('link', { name: 'セルフチェックに進む' }).click();
  await expect(page).toHaveURL(/\/pelvis\/check\/$/);
});

test('アンケートを経ずに記事を開いても表示できる（全般向けの導入）', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/article/');
  await expect(page.getByTestId('article-intro')).toHaveAttribute('data-theme', 'general');
  expect(count(await ga4Events(page), 'article_view')).toBe(1);
});

test('予約ページ（/pelvis/reserve/）から予約先へ移動できる', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/reserve/');
  await expect(page.getByTestId('offer-price')).toHaveText('1,980円（税込）');
  await expect.poll(async () => count(await ga4Events(page), 'offer_view')).toBe(1);
  await page.locator('a[data-placement="reserve_page"]').click();
  await expect(page).toHaveURL(TEST_RESERVATION_URL);
});

test('予約完了を確認できない設定では、完了ページでも予約完了を送らない', async ({ page }) => {
  await stubExternal(page);
  await page.goto('/pelvis/reserve/complete/');
  await expect(page.getByRole('heading', { name: 'ご予約ありがとうございます' })).toBeVisible();
  expect(count(await ga4Events(page), 'reserve_complete')).toBe(0);
  expect((await pixelCalls(page)).filter((c) => c[1] === 'Schedule')).toHaveLength(0);
});
