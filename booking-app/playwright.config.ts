import { defineConfig, devices } from '@playwright/test';

// 画面の自動テスト（E2E）。scripts/test-e2e.sh が一時的なデータベースとテスト用の Supabase 互換サーバーを用意する。
// 実行：npm run build && npm run test:e2e

const PORT = 3300;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' }, testMatch: /public\.spec|mobile\.spec/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /admin\.spec/ },
  ],
  webServer: {
    command: `npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? '',
      // メールはテスト用の SMTP サーバー（scripts/e2e/fake-smtp.mjs）に送る
      GMAIL_ADDRESS: 'sender@example.test',
      GMAIL_APP_PASSWORD: 'test-app-password',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: process.env.FAKE_SMTP_PORT ?? '2525',
    },
  },
});
