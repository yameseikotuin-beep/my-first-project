import { expect, test, type Page } from '@playwright/test';
import { ADMIN, addDaysStr, login, NOT_ADMIN, resetData, serviceId, sql, sqlAsAnon, testMonday } from './helpers';

// 店舗管理者向け管理画面（パソコンの画面サイズで操作する）

test.beforeEach(async () => {
  await resetData();
});

async function webBooking(service: string, date: string, time: string, name: string, phone: string) {
  const [row] = await sqlAsAnon(
    `select booking_number from public.create_booking($1, ($2::date + $3::time) at time zone 'Asia/Tokyo', $4, $5)`,
    [await serviceId(service), date, time, name, phone],
  );
  return row.booking_number as string;
}

async function registerByPhone(page: Page, opts: { service: string; date: string; time: string; name: string; phone: string }) {
  await page.goto('/admin/bookings/new');
  await page.getByRole('combobox', { name: /^メニュー/ }).selectOption(await serviceId(opts.service));
  await page.getByLabel('日付').fill(opts.date);
  await page.getByLabel('開始時刻').fill(opts.time);
  await page.getByLabel('お名前').fill(opts.name);
  await page.getByLabel('電話番号').fill(opts.phone);
  await page.getByRole('button', { name: 'この内容で予約を登録する' }).click();
}

test('管理画面はログインが必要で、管理者以外はログインできない', async ({ page }) => {
  for (const path of ['/admin', '/admin/bookings', '/admin/calendar', '/admin/services', '/admin/settings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/admin\/login$/);
  }
  await login(page, { email: ADMIN.email, password: 'wrong-password' });
  await expect(page.getByText('メールアドレスまたはパスワードが違います。')).toBeVisible();
  await login(page, NOT_ADMIN);
  await expect(page.getByText('このアカウントには管理画面を使う権限がありません。')).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('管理画面のサーバー処理は、ログインしていない要求を受け付けない', async ({ request }) => {
  // 画面を通さずに直接要求しても、予約一覧などの個人情報は返らない
  const res = await request.get('/admin/bookings', { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()['location']).toContain('/admin/login');
  // Supabase の API に未ログインの権限で直接アクセスしても、予約は読めない
  const api = await request.get(`${process.env.E2E_SUPABASE_URL}/rest/v1/bookings?select=*`, {
    headers: { apikey: process.env.E2E_SUPABASE_ANON_KEY!, authorization: `Bearer ${process.env.E2E_SUPABASE_ANON_KEY}` },
  });
  expect(api.status()).toBe(401);
  expect(await api.text()).not.toContain('customer_phone');
});

test('ダッシュボード：本日の予約件数・一覧・直近の予約', async ({ page }) => {
  const monday = await testMonday();
  await webBooking('肩こり整体', monday, '10:00', 'WEB 花子', '09012340000');
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'ダッシュボード' })).toBeVisible();
  await expect(page.getByTestId('today-count')).toContainText('0');
  await expect(page.getByRole('heading', { name: '直近の予約' })).toBeVisible();
  await expect(page.getByRole('link', { name: /WEB 花子/ })).toBeVisible();
  await expect(page.getByRole('link', { name: '予約カレンダー' })).toBeVisible();
});

test('電話予約の手動登録：WEB 予約と同じ重複防止ルールで連動する', async ({ page }) => {
  const monday = await testMonday();
  await sql(`update public.rooms set is_active = (name = '施術ベッド1')`);
  await webBooking('肩こり整体', monday, '10:00', 'WEB 花子', '09012340000');
  await login(page);

  // WEB 予約と重なる時間は登録できない
  await registerByPhone(page, { service: '肩こり整体', date: monday, time: '10:15', name: '電話 太郎', phone: '03-1234-5678' });
  await expect(page.getByText(/この時間は予約できません/)).toBeVisible();
  // 入力内容は残っている
  await expect(page.getByLabel('お名前')).toHaveValue('電話 太郎');

  // 空き時間の一覧から選んで登録する
  await page.getByRole('button', { name: '11:00', exact: true }).click();
  await expect(page.getByLabel('開始時刻')).toHaveValue('11:00');
  await page.getByLabel('メールアドレス').fill('denwa@example.com');
  await page.getByRole('button', { name: 'この内容で予約を登録する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  await expect(page.getByText('管理画面（電話・来店）')).toBeVisible();
  await expect(page.getByRole('link', { name: 'denwa@example.com' })).toHaveAttribute('href', 'mailto:denwa@example.com');

  // WEB の空き時間から消えている
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByRole('link', { name: '09:15', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '11:00', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '11:30', exact: true })).toHaveCount(0);
});

test('予約一覧の日付絞り込み・予約の変更・キャンセル', async ({ page }) => {
  const monday = await testMonday();
  const number = await webBooking('肩こり整体', monday, '10:00', '変更 一郎', '09011112222');
  await webBooking('腰痛整体', addDaysStr(monday, 1), '10:00', '別の日 二郎', '09011113333');
  await login(page);

  await page.goto(`/admin/bookings?from=${monday}`);
  await expect(page.getByRole('link', { name: /変更 一郎/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /別の日 二郎/ })).toHaveCount(0);
  await page.goto(`/admin/bookings?from=${monday}&to=${addDaysStr(monday, 1)}`);
  await expect(page.getByRole('link', { name: /別の日 二郎/ })).toBeVisible();
  await page.goto(`/admin/bookings?from=${monday}&to=${addDaysStr(monday, 6)}&q=1111222`);
  await expect(page.getByRole('link', { name: /変更 一郎/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /別の日 二郎/ })).toHaveCount(0);

  // 詳細 → 時間とメニューの変更
  await page.getByRole('link', { name: /変更 一郎/ }).click();
  await expect(page.getByText(number)).toBeVisible();
  await page.getByRole('combobox', { name: /^メニュー/ }).selectOption({ label: '慢性痛改善整体（60分・6,600円）' });
  await page.getByLabel('開始時刻').fill('15:00');
  await page.getByLabel('備考').fill('時間変更の連絡あり');
  await page.getByRole('button', { name: '変更を保存する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  await expect(page.getByText(/15:00〜16:00/).first()).toBeVisible();
  await expect(page.getByText('慢性痛改善整体（6,600円）')).toBeVisible();

  // 昼休みへの変更はできない
  await page.getByLabel('開始時刻').fill('12:00');
  await page.getByRole('button', { name: '変更を保存する' }).click();
  await expect(page.getByText(/受付停止時間/)).toBeVisible();

  // キャンセル
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '予約をキャンセルする' }).click();
  await expect(page.getByText('キャンセル日時')).toBeVisible();
  const [row] = await sql<{ status: string }>('select status from public.bookings where booking_number = $1', [number]);
  expect(row.status).toBe('cancelled');

  // キャンセルした予約を確定に戻す（ステータスの管理）
  await page.getByLabel('予約ステータス').selectOption('confirmed');
  await page.getByLabel('開始時刻').fill('15:00');
  await page.getByRole('button', { name: '変更を保存する' }).click();
  await expect
    .poll(async () => (await sql<{ status: string }>('select status from public.bookings where booking_number = $1', [number]))[0].status)
    .toBe('confirmed');
  await expect(page.getByText('キャンセル日時')).toHaveCount(0);
});

test('予約カレンダー：日別・週別に表示し、予約から詳細へ移動できる', async ({ page }) => {
  const monday = await testMonday();
  await webBooking('肩こり整体', monday, '10:00', 'カレンダー 三郎', '09011114444');
  await webBooking('肩甲骨はがし', addDaysStr(monday, 2), '14:00', '水曜 四郎', '09011115555');
  await login(page);

  await page.goto(`/admin/calendar?date=${monday}`);
  await expect(page.getByRole('link', { name: '施術ベッド1' }).or(page.getByText('施術ベッド1')).first()).toBeVisible();
  const block = page.getByRole('link', { name: /10:00〜10:40.*カレンダー 三郎/ });
  await expect(block).toBeVisible();
  await expect(block).toContainText('肩こり整体');

  await page.getByRole('link', { name: '週別' }).click();
  await expect(page.getByRole('link', { name: /14:00〜14:30.*水曜 四郎/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /10:00〜10:40.*カレンダー 三郎/ })).toContainText('施術ベッド1');

  await page.getByRole('link', { name: /水曜 四郎/ }).click();
  await expect(page.getByRole('heading', { name: '予約の詳細' })).toBeVisible();
  await expect(page.getByText('水曜 四郎').first()).toBeVisible();
});

test('メニュー管理：追加したメニューが予約画面に表示され、受付停止で消える', async ({ page }) => {
  await login(page);
  await page.goto('/admin/services/new');
  await page.getByLabel('メニュー名').fill('E2E 首こり整体');
  await page.getByLabel('説明').fill('テスト用のメニュー');
  await page.getByLabel('施術時間（分）').fill('50');
  await page.getByLabel('料金（円・税込）').fill('5000');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  await expect(page.getByRole('link', { name: /E2E 首こり整体/ })).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('link', { name: /E2E 首こり整体/ })).toContainText('5,000円');
  await expect(page.getByRole('link', { name: /E2E 首こり整体/ })).toContainText('50分');

  await page.goto('/admin/services');
  await page.getByRole('link', { name: /E2E 首こり整体/ }).click();
  await page.waitForLoadState('networkidle');
  await page.getByLabel('WEB予約を受け付ける').uncheck();
  await expect(page.getByLabel('WEB予約を受け付ける')).not.toBeChecked();
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('link', { name: /E2E 首こり整体/ })).toHaveCount(0);

  // 入力の検証
  await page.goto('/admin/services/new');
  await page.getByLabel('施術時間（分）').fill('0');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('メニュー名を入力してください')).toBeVisible();
  await expect(page.getByText('施術時間は5以上にしてください')).toBeVisible();
});

test('施術スペース：利用停止にするとそのスペースを使う予約を受け付けない', async ({ page }) => {
  const monday = await testMonday();
  await login(page);
  await page.goto('/admin/rooms');
  for (const name of ['施術ベッド1', '施術ベッド2']) {
    await page.getByRole('link', { name: new RegExp(name) }).click();
    // 画面の準備（ハイドレーション）が終わる前にチェックを外すと元に戻ることがあるため、読み込み完了を待つ
    await page.waitForLoadState('networkidle');
    await page.getByLabel('利用可能').uncheck();
    await expect(page.getByLabel('利用可能')).not.toBeChecked();
    await page.getByRole('button', { name: '保存する' }).click();
    await expect(page.getByText('保存しました。')).toBeVisible();
    await page.goto('/admin/rooms');
  }
  await webBooking('肩こり整体', monday, '10:00', '個室の人', '09011116666');
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByRole('link', { name: '09:15', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '10:00', exact: true })).toHaveCount(0);

  // スペースを追加すると予約できるようになる
  await page.goto('/admin/rooms');
  await page.getByLabel('スペース名').fill('施術ベッド3');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.getByText('追加しました。')).toBeVisible();
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByRole('link', { name: '10:00', exact: true })).toBeVisible();
  await sql(`delete from public.rooms where name = '施術ベッド3'`);
});

test('施術者管理：有効にすると施術者の空きも判定され、重複しない', async ({ page }) => {
  const monday = await testMonday();
  await login(page);
  await page.goto('/admin/practitioners');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '有効にする' }).click();
  await expect(page.getByTestId('use-practitioners')).toHaveText('有効');
  await expect(page.getByText('利用可能な施術者がいないため')).toBeVisible();
  await page.getByLabel('施術者名').fill('施術者A');
  await page.getByRole('button', { name: '追加する' }).click();
  await expect(page.getByText('追加しました。')).toBeVisible();

  await webBooking('肩こり整体', monday, '10:00', '担当A', '09011117777');
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  // スペースは空いているが、施術者が1人なので同じ時間は予約できない
  await expect(page.getByRole('link', { name: '10:00', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '10:45', exact: true })).toBeVisible();

  // 出勤時間・休みの設定
  await page.goto('/admin/practitioners');
  await page.getByRole('link', { name: /施術者A/ }).click();
  await page.getByLabel('日付').fill(monday);
  await page.getByRole('button', { name: '休みを追加' }).click();
  await expect(page.getByText('休みを追加しました。')).toBeVisible();
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByText('この日は予約できる時間がありません')).toBeVisible();

  // 予約詳細に担当施術者が表示される
  await page.goto('/admin/bookings?from=' + monday);
  await expect(page.getByRole('link', { name: /担当A/ })).toContainText('施術者A');
});

test('営業時間・休業日：臨時休業日と受付停止時間が予約画面に反映される', async ({ page }) => {
  const monday = await testMonday();
  await login(page);
  await page.goto('/admin/hours');

  // 臨時休業
  await page.locator('input[name="businessDate"]').fill(monday);
  await page.getByLabel('メモ').fill('臨時休業');
  await page.getByRole('button', { name: '特定日の設定を保存' }).click();
  await expect(page.getByText('特定日の設定を保存しました。')).toBeVisible();
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByText('この日は予約できる時間がありません')).toBeVisible();
  await sql('delete from public.business_date_overrides');

  // 特定の日だけの受付停止時間
  await page.goto('/admin/hours');
  await page.getByLabel('繰り返し').selectOption('date');
  await page.getByLabel('日付（特定の日の場合）').fill(monday);
  await page.locator('input[name="startTime"]').fill('15:00');
  await page.locator('input[name="endTime"]').fill('16:00');
  await page.getByLabel('名前').fill('研修');
  await page.getByRole('button', { name: '受付停止時間を追加' }).click();
  await expect(page.getByText('受付停止時間を追加しました。')).toBeVisible();
  await page.goto(`/book/${await serviceId('肩甲骨はがし')}?date=${monday}`);
  await expect(page.getByRole('link', { name: '14:30', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '15:00', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: '16:00', exact: true })).toBeVisible();
  await sql(`delete from public.breaks where label = '研修'`);

  // 営業時間の検証
  await page.goto('/admin/hours');
  await page.getByLabel('月曜日の終了時刻').fill('08:00');
  await page.getByRole('button', { name: '営業時間を保存する' }).click();
  await expect(page.getByText('月曜日：終了時刻は開始時刻より後にしてください')).toBeVisible();
});

test('予約受付の設定：予約枠の間隔を変更できる', async ({ page }) => {
  const monday = await testMonday();
  await login(page);
  await page.goto('/admin/settings');
  await page.getByLabel('予約枠の開始間隔').selectOption('30');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  await page.goto(`/book/${await serviceId('肩こり整体')}?date=${monday}`);
  await expect(page.getByRole('link', { name: '09:30', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '09:15', exact: true })).toHaveCount(0);
});

test('予約受付の設定：通知メールの送り先を追加・確認できる', async ({ page }) => {
  await login(page);
  await page.goto('/admin/settings');
  await expect(page.getByText('メールの送信は設定済みです')).toBeVisible();
  const field = page.getByLabel('新しい予約の通知メールの送り先');
  await field.fill('not-an-email');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('通知メールの送り先に、形式の正しくないメールアドレスがあります')).toBeVisible();
  await field.fill('Clinic@Example.test\nstaff@example.test');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました。')).toBeVisible();
  const [row] = await sql<{ notify_emails: string[] }>('select notify_emails from public.app_settings');
  expect(row.notify_emails).toEqual(['clinic@example.test', 'staff@example.test']);
  await page.reload();
  await expect(page.getByLabel('新しい予約の通知メールの送り先')).toHaveValue('clinic@example.test\nstaff@example.test');
});
