import { defineConfig, devices } from '@playwright/test';

// 画面の自動テスト（E2E）。手元の Supabase（npx supabase start）に対して、本番ビルドのアプリを動かして確認する。
// 実行：npm run test:e2e（scripts/test-e2e.sh が Supabase の接続情報を設定する）

const PORT = 3200;

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
    { name: 'mobile', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
  ],
  webServer: {
    command: `npx next start -p ${PORT} -H 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? '',
      SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? '',
      SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '',
      SITE_URL: `http://127.0.0.1:${PORT}`,
      // 自動テストでは AI を使わない
      ANTHROPIC_API_KEY: '',
    },
  },
});
