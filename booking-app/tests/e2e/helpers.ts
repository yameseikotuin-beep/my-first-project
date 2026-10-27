import { expect, type Page } from '@playwright/test';
import pg from 'pg';

// テスト用データベースへの直接接続（scripts/test-e2e.sh が起動した一時的な PostgreSQL）

let pool: pg.Pool | null = null;
export async function sql<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  pool ??= new pg.Pool({ host: process.env.E2E_PGHOST, port: Number(process.env.E2E_PGPORT), user: 'postgres', database: 'postgres', max: 2 });
  return (await pool.query<T>(text, values)).rows;
}

export async function fault(mode: 'none' | 'rpc-error' | 'rpc-reset') {
  await fetch(`${process.env.E2E_SUPABASE_URL}/__fault?mode=${mode}`);
}

/** 8日以上先の月曜日（日本時間）YYYY-MM-DD */
export async function testMonday(weeksLater = 0): Promise<string> {
  const [row] = await sql<{ d: string }>(
    `select to_char(d + ((8 - extract(dow from d)::int) % 7) + $1 * 7, 'YYYY-MM-DD') as d
       from (select (now() at time zone 'Asia/Tokyo')::date + 8 as d) x`,
    [weeksLater],
  );
  return row.d;
}

export async function serviceId(name: string): Promise<string> {
  const [row] = await sql<{ id: string }>('select id from public.services where name = $1', [name]);
  return row.id;
}

export async function resetData() {
  await sql(`delete from public.bookings;
             delete from public.business_date_overrides;
             delete from public.service_rooms;
             update public.rooms set is_active = true;
             update public.services set is_active = true;
             delete from public.services where name like 'E2E%';
             delete from public.practitioners;
             update public.app_settings set use_practitioners = false, slot_interval_minutes = 15, min_lead_minutes = 0,
                    booking_window_days = 60, max_active_bookings_per_phone = 3;`);
  await fault('none');
}

export const ADMIN = { email: 'admin@example.test', password: 'admin-password-123' };
export const NOT_ADMIN = { email: 'not-admin@example.test', password: 'staff-password-123' };

export async function login(page: Page, user = ADMIN, expectSuccess = user === ADMIN) {
  await page.goto('/admin/login');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(user.password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  if (expectSuccess) await expect(page).toHaveURL(/\/admin$/);
}

/** ページが横にはみ出していない（スマートフォンで横スクロールが出ない）ことを確認する */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** 未ログインのお客様の権限で SQL を実行する（ほかのお客様の WEB 予約を再現する） */
export async function sqlAsAnon(text: string, values: unknown[] = []) {
  pool ??= new pg.Pool({ host: process.env.E2E_PGHOST, port: Number(process.env.E2E_PGPORT), user: 'postgres', database: 'postgres', max: 2 });
  const client = await pool.connect();
  try {
    await client.query('set role anon');
    return (await client.query(text, values)).rows;
  } finally {
    await client.query('reset role');
    client.release();
  }
}

export function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** カレンダーの日付の読み上げ名（例：11月9日(月)） */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日(${'日月火水木金土'[d.getUTCDay()]})`;
}
