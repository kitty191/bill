import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8765',
    viewport: { width: 390, height: 844 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || (process.env.CI ? undefined : '/usr/bin/chromium'),
      args: ['--no-sandbox'],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 8765 --bind 127.0.0.1 --directory dist',
    url: 'http://127.0.0.1:8765',
    reuseExistingServer: !process.env.CI,
  },
});
