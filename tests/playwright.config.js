const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  retries: 1,
  workers: 2,
  use: {
    baseURL: process.env.BASE_URL || 'https://yt.srv879786.hstgr.cloud',
    screenshot: 'only-on-failure',
    video: 'off',
    headless: true,
    trace: 'on-first-retry',
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});
