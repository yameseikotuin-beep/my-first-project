import { defineConfig, devices } from '@playwright/test';

// 画面の自動テスト（E2E）。scripts/test-e2e.sh が設定の異なる 2 つの本番ビルドを作ってから実行する。
//   configured：予約URL・GA4・Meta Pixel を設定したビルド（テスト用の値）
//   unset     ：何も設定していないビルド
// 外部への通信（予約ページ・広告スクリプト）はテスト内で差し止め、実際には送らない。

export const CONFIGURED_PORT = 3301;
export const UNSET_PORT = 3302;
export const TEST_RESERVATION_URL = 'https://reserve.example.com/booking';
export const TEST_GA4_ID = 'G-TEST12345';
export const TEST_PIXEL_ID = '1234567890';

const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    trace: 'retain-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: /unset\.spec\.ts/,
      use: { ...devices['Pixel 7'], browserName: 'chromium', baseURL: `http://127.0.0.1:${CONFIGURED_PORT}` },
    },
    {
      name: 'desktop',
      testIgnore: /unset\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, baseURL: `http://127.0.0.1:${CONFIGURED_PORT}` },
    },
    {
      name: 'unset',
      testMatch: /unset\.spec\.ts/,
      use: { ...devices['Pixel 7'], browserName: 'chromium', baseURL: `http://127.0.0.1:${UNSET_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx next start -p ${CONFIGURED_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${CONFIGURED_PORT}/pelvis/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_DIST_DIR: '.next-e2e-configured' },
    },
    {
      command: `npx next start -p ${UNSET_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${UNSET_PORT}/pelvis/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { NEXT_DIST_DIR: '.next-e2e-unset' },
    },
  ],
});
