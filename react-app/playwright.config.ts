import { defineConfig, devices } from '@playwright/test'

/**
 * 主要な画面操作の E2E テスト。ビルドした本番用ファイルを vite preview で配信して確認する。
 * 実行: npm run build && npm run build:e2e-cloud && npm run test:e2e
 * ブラウザは `npx playwright install chromium` で入れる（PW_CHROMIUM_PATH で既存の Chromium も指定できる）。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/',
    ...devices['Pixel 7'],
    locale: 'ja-JP',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'local', testIgnore: /cloud\.spec\.ts/ },
    // クラウド機能あり（Supabase の通信はテスト内で模擬する。npm run build:e2e-cloud でビルド）
    { name: 'cloud', testMatch: /cloud\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:4174/' } },
  ],
  webServer: [
    { command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4173/', reuseExistingServer: !process.env.CI },
    { command: 'npx vite preview --outDir dist-e2e-cloud --port 4174 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4174/', reuseExistingServer: !process.env.CI },
  ],
})
