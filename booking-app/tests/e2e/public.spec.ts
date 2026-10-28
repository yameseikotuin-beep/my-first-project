import { expect, test, type Page } from '@playwright/test';
import { addDaysStr, dayLabel, expectNoHorizontalOverflow, fault, resetData, serviceId, sql, sqlAsAnon, testMonday } from './helpers';

// お客様向け予約画面（スマートフォンの画面サイズで操作する）

test.beforeEach(async () => {
  await resetData();
});

function monthOf(date: string) {
  return date.slice(0, 7);
}

async function openSlots(page: Page, service: string, date: string) {
  await page.goto(`/book/${await serviceId(service)}?date=${date}`);
  await expect(page.getByRole('heading', { name: /の空き時間/ })).toBeVisible();
}

async function fillCustomer(page: Page, name = '山田 太郎', phone = '090-1234-5678', email = 'customer@example.com') {
  await page.getByLabel('お名前').fill(name);
  await page.getByLabel('電話番号').fill(phone);
  await page.getByLabel('メールアドレス').fill(email);
}

test('メニュー一覧が表示され、メニューを選んで日付選択へ進める', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'メニューを選んでください' })).toBeVisible();
  for (const name of ['慢性痛改善整体', '肩こり整体', '腰痛整体', '肩甲骨はがし', '骨盤起こし整体', '姿勢改善整体']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByText('テスト整骨院')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole('link', { name: /肩こり整体/ }).click();
  await expect(page.getByRole('heading', { name: '日付を選んでください' })).toBeVisible();
  await expect(page.getByText('肩こり整体（40分・4,400円）')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('受付停止したメニューは表示されない', async ({ page }) => {
  await sql(`update public.services set is_active = false where name = '姿勢改善整体'`);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /肩こり整体/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /姿勢改善整体/ })).toHaveCount(0);
});

test('カレンダー：定休日（日曜）と臨時休業日は選べない', async ({ page }) => {
  const monday = await testMonday();
  const tuesday = addDaysStr(monday, 1);
  const sunday = addDaysStr(monday, -1);
  await sql(`insert into public.business_date_overrides (business_date, is_closed) values ($1, true)`, [tuesday]);
  for (const month of new Set([monthOf(monday), monthOf(tuesday), monthOf(sunday)])) {
    await page.goto(`/book/${await serviceId('肩こり整体')}?month=${month}`);
    if (monthOf(monday) === month) await expect(page.getByRole('link', { name: dayLabel(monday), exact: true })).toBeVisible();
    if (monthOf(tuesday) === month) {
      await expect(page.getByLabel(`${dayLabel(tuesday)}（予約不可）`, { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: dayLabel(tuesday), exact: true })).toHaveCount(0);
    }
    if (monthOf(sunday) === month) {
      await expect(page.getByLabel(`${dayLabel(sunday)}（予約不可）`, { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: dayLabel(sunday), exact: true })).toHaveCount(0);
    }
    await expectNoHorizontalOverflow(page);
  }
});

test('空き時間：営業時間・昼休み・最終受付・施術時間が反映される', async ({ page }) => {
  const monday = await testMonday();
  await openSlots(page, '肩こり整体', monday);
  const slots = page.locator('#slots li');
  await expect(slots.first()).toHaveText('09:00');
  await expect(slots.last()).toHaveText('19:00');
  await expect(page.getByRole('link', { name: '11:15', exact: true })).toBeVisible(); // 11:15〜11:55
  await expect(page.getByRole('link', { name: '11:30', exact: true })).toHaveCount(0); // 昼休みにかかる
  await expect(page.getByRole('link', { name: '12:30', exact: true })).toHaveCount(0); // 昼休み中
  await expect(page.getByRole('link', { name: '13:00', exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // 60分のメニューは 11:15 開始（〜12:15）が選べない
  await openSlots(page, '慢性痛改善整体', monday);
  await expect(page.getByRole('link', { name: '11:00', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '11:15', exact: true })).toHaveCount(0);
});

test('予約の流れ：入力の検証 → 確認 → 確定 → 予約番号の表示', async ({ page }) => {
  const monday = await testMonday();
  await openSlots(page, '肩こり整体', monday);
  await page.getByRole('link', { name: '10:00', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'お客様情報を入力してください' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // 未入力・不正な入力は先へ進めない
  await page.getByRole('button', { name: '入力内容を確認する' }).click();
  await expect(page.getByText('お名前を入力してください')).toBeVisible();
  await expect(page.getByText('電話番号を入力してください')).toBeVisible();
  await expect(page.getByText('メールアドレスを入力してください')).toBeVisible();
  await fillCustomer(page, '山田 太郎', '1234');
  await page.getByRole('button', { name: '入力内容を確認する' }).click();
  await expect(page.getByText('電話番号は0から始まる10桁または11桁で入力してください')).toBeVisible();

  await fillCustomer(page);
  await page.getByLabel('メールアドレス').fill('yamada@example');
  await page.getByRole('button', { name: '入力内容を確認する' }).click();
  await expect(page.getByText('メールアドレスの形式が正しくありません')).toBeVisible();

  await page.getByLabel('メールアドレス').fill(' Yamada@Example.com ');
  await page.getByLabel('備考').fill('右肩が痛みます');
  await page.getByRole('button', { name: '入力内容を確認する' }).click();

  // 確認画面
  await expect(page.getByRole('heading', { name: '予約内容の確認' })).toBeVisible();
  await expect(page.getByText('肩こり整体', { exact: true })).toBeVisible();
  await expect(page.getByText('10:00〜10:40')).toBeVisible();
  await expect(page.getByText('4,400円')).toBeVisible();
  await expect(page.getByText('山田 太郎')).toBeVisible();
  await expect(page.getByText('右肩が痛みます')).toBeVisible();
  await expect(page.getByText('Yamada@Example.com')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  // 修正して戻っても入力内容が残る
  await page.getByRole('button', { name: '入力内容を修正する' }).click();
  await expect(page.getByLabel('お名前')).toHaveValue('山田 太郎');
  await page.getByRole('button', { name: '入力内容を確認する' }).click();

  await page.getByRole('button', { name: 'この内容で予約を確定する' }).click();
  await expect(page).toHaveURL(/\/book\/complete$/);
  await expect(page.getByText('ご予約が確定しました')).toBeVisible();
  const number = (await page.getByTestId('booking-number').textContent())?.trim();
  expect(number).toMatch(/^\d{6}-[A-Z2-9]{4}$/);
  await expectNoHorizontalOverflow(page);

  const rows = await sql<{ customer_phone: string; customer_email: string; status: string; source: string; notes: string }>(
    'select customer_phone, customer_email, status, source, notes from public.bookings where booking_number = $1', [number]);
  expect(rows).toEqual([
    { customer_phone: '09012345678', customer_email: 'yamada@example.com', status: 'confirmed', source: 'web', notes: '右肩が痛みます' },
  ]);

  // 予約した時間は、スペースが残っていれば引き続き表示される（3つのスペース）
  await openSlots(page, '肩こり整体', monday);
  await expect(page.getByRole('link', { name: '10:00', exact: true })).toBeVisible();
});

test('すべてのスペースが埋まった時間は表示されず、選んだ後に埋まった場合は確定できない', async ({ page }) => {
  const monday = await testMonday();
  await openSlots(page, '肩こり整体', monday);
  await page.getByRole('link', { name: '14:00', exact: true }).click();
  await fillCustomer(page, '後から来た人', '09088887777');
  await page.getByRole('button', { name: '入力内容を確認する' }).click();

  // 確認中に、ほかのお客様が3つのスペースをすべて予約した
  const svc = await serviceId('肩こり整体');
  for (const [i, phone] of ['09011110001', '09011110002', '09011110003'].entries()) {
    await sqlAsAnon(`select * from public.create_booking($1, ($2::date + time '14:00') at time zone 'Asia/Tokyo', $3, $4)`, [svc, monday, `先客${i}`, phone]);
  }
  await page.getByRole('button', { name: 'この内容で予約を確定する' }).click();
  await expect(page.getByText(/この時間は予約できません/)).toBeVisible();
  await expect(page).not.toHaveURL(/complete/);
  expect(await sql(`select 1 from public.bookings where customer_name = '後から来た人'`)).toHaveLength(0);

  await page.getByRole('link', { name: '空き時間を選び直す' }).click();
  await expect(page.getByRole('link', { name: '14:00', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '14:45', exact: true })).toBeVisible();
});

for (const mode of ['rpc-error', 'rpc-reset'] as const) {
  test(`データベース障害時（${mode === 'rpc-error' ? 'エラー応答' : '通信切断'}）に予約完了と表示しない`, async ({ page }) => {
    const monday = await testMonday();
    await openSlots(page, '肩甲骨はがし', monday);
    await page.getByRole('link', { name: '15:00', exact: true }).click();
    await fillCustomer(page, '障害 テスト', '09055556666');
    await page.getByRole('button', { name: '入力内容を確認する' }).click();
    await fault(mode);
    await page.getByRole('button', { name: 'この内容で予約を確定する' }).click();
    await expect(page.getByText('予約は確定していません')).toBeVisible();
    await expect(page).not.toHaveURL(/complete/);
    await expect(page.getByText('ご予約が確定しました')).toHaveCount(0);
    await fault('none');
    expect(await sql(`select 1 from public.bookings where customer_name = '障害 テスト'`)).toHaveLength(0);

    // 復旧後はそのまま確定できる
    await page.getByRole('button', { name: 'この内容で予約を確定する' }).click();
    await expect(page.getByText('ご予約が確定しました')).toBeVisible();
  });
}

test('予約完了画面は、予約を確定していなければ内容を表示しない', async ({ page }) => {
  await page.goto('/book/complete');
  await expect(page.getByText('予約内容を表示できません')).toBeVisible();
  await expect(page.getByTestId('booking-number')).toHaveCount(0);
});

test('存在しない・受付停止のメニューの URL はページが見つからない', async ({ page }) => {
  await page.goto('/book/00000000-0000-0000-0000-000000000000');
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
  await page.goto('/book/not-a-uuid');
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
});

test('過去・受付締切後の時間を URL で直接指定しても予約へ進めない', async ({ page }) => {
  const svc = await serviceId('肩こり整体');
  await page.goto(`/book/${svc}/confirm?start=${encodeURIComponent('2020-01-06T10:00:00+09:00')}`);
  await expect(page.getByText('この時間は予約できなくなりました')).toBeVisible();
});
