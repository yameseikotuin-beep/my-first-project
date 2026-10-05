import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// テスト用の利用者を、手元の Supabase の管理用キーで作る（本番では使わない）

export const PASSWORD = 'e2e-password-123';
const runId = Date.now().toString(36);

function admin() {
  const url = process.env.E2E_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY が必要です（scripts/test-e2e.sh から実行）');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type TestUser = { id: string; email: string; name: string };

export async function createUser(role: 'user' | 'staff' | 'admin', label: string): Promise<TestUser> {
  const email = `${label}-${runId}@example.test`;
  const name = `${label} ${runId}`;
  const client = admin();
  const { data, error } = await client.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, adult_confirmed: 'true' },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  if (role !== 'user') {
    const { error: roleError } = await client.from('profiles').update({ role }).eq('id', data.user.id);
    if (roleError) throw new Error(`role update failed: ${roleError.message}`);
  }
  return { id: data.user.id, email, name };
}

export async function userExists(id: string): Promise<boolean> {
  const { data } = await admin().auth.admin.getUserById(id);
  return Boolean(data.user);
}

export async function login(page: Page, user: TestUser) {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export async function logout(page: Page) {
  await page.context().clearCookies();
}

export const uniq = (s: string) => `${s}${runId}`;
